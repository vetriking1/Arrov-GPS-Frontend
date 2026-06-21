import { useQuery } from "@tanstack/react-query";
import { api, type FuelLive } from "@/lib/api";
import { useWSData } from "@/components/AppLayout";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Fuel, Droplets, TrendingDown, TrendingUp, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { DayFilter } from "@/components/DayFilter";
import { istTodayString, istDayRange, formatIST, formatISTTime } from "@/lib/datetime";
import { cleanFuelSeries, detectFuelEvents } from "@/lib/fuelAnalysis";

export default function FuelMonitoring() {
  const { fuelUpdates } = useWSData();

  const { data: fuelLive = [] } = useQuery({
    queryKey: ["fuel-live"],
    queryFn: api.getLiveFuel,
    refetchInterval: 15000,
  });

  // Merge REST + WS data. Both fuel_level (REST) and fuelLevel (WS) are PERCENTAGES (0..100);
  // liters are derived from the tank capacity.
  const mergedFuel = useMemo(() => {
    const map = new Map<number, FuelLive & { _fuelPct?: number }>();
    fuelLive.forEach((f) => map.set(f.vehicle_id, { ...f }));
    Object.values(fuelUpdates).forEach((wu) => {
      const existing = map.get(wu.vehicleId);
      if (existing) {
        existing._fuelPct = wu.fuelLevel; // WS fuelLevel is already a percentage
        existing.voltage = wu.voltage;
      }
    });
    return Array.from(map.values());
  }, [fuelLive, fuelUpdates]);

  // History
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(istTodayString());
  const dayRange = useMemo(() => istDayRange(selectedDate), [selectedDate]);

  const { data: history = [] } = useQuery({
    queryKey: ["fuel-history", selectedVehicle, dayRange.fromUTC, dayRange.toUTC],
    queryFn: () => api.getFuelHistory(Number(selectedVehicle), dayRange.fromUTC, dayRange.toUTC),
    enabled: !!selectedVehicle && !!selectedDate,
  });

  const tankCapacity = useMemo(() => {
    const v = mergedFuel.find((f) => f.vehicle_id === Number(selectedVehicle));
    return Number(v?.fuel_tank_capacity) || 0;
  }, [mergedFuel, selectedVehicle]);

  const pctToLiters = (pct: number) => (tankCapacity > 0 ? (pct / 100) * tankCapacity : pct);

  // Cleaned series (invalid voltages dropped) + derived chart / stats / triggers.
  const cleaned = useMemo(() => cleanFuelSeries(history as any[]), [history]);

  const chartData = useMemo(
    () =>
      cleaned.map((p) => ({
        time: formatISTTime(p.time),
        fuel: Math.round(pctToLiters(p.level) * 10) / 10,
        pct: Math.round(p.level * 10) / 10,
      })),
    [cleaned, tankCapacity]
  );

  const stats = useMemo(() => {
    if (cleaned.length === 0) return null;
    const levels = cleaned.map((p) => p.level);
    const min = Math.min(...levels);
    const max = Math.max(...levels);
    const avg = levels.reduce((s, l) => s + l, 0) / levels.length;
    return {
      min: pctToLiters(min),
      max: pctToLiters(max),
      avg: pctToLiters(avg),
      consumed: pctToLiters(max - min),
    };
  }, [cleaned, tankCapacity]);

  const events = useMemo(() => detectFuelEvents(cleaned), [cleaned]);

  const unit = tankCapacity > 0 ? "L" : "%";

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Fuel Monitoring</h1>

      {/* Live fuel gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {mergedFuel.map((f) => {
          const cap = Number(f.fuel_tank_capacity) || 0;
          const fuelPct = f._fuelPct !== undefined ? f._fuelPct : Number(f.fuel_level) || 0;
          const fuelLiters = cap > 0 ? (fuelPct / 100) * cap : 0;

          return (
            <Card key={f.vehicle_id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Fuel className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{f.vehicle_number}</span>
                  </div>
                  <span className="text-lg font-bold">
                    {cap > 0 ? `${fuelLiters.toFixed(1)}L` : `${fuelPct.toFixed(0)}%`}
                  </span>
                </div>
                <Progress value={Math.min(fuelPct, 100)} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {fuelPct.toFixed(0)}% • {cap}L capacity
                </p>
              </CardContent>
            </Card>
          );
        })}
        {mergedFuel.length === 0 && (
          <p className="col-span-full text-muted-foreground text-center py-8">
            No fuel data available
          </p>
        )}
      </div>

      {/* Fuel history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fuel History & Analysis (IST)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <Label>Vehicle</Label>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {mergedFuel.map((f) => (
                    <SelectItem key={f.vehicle_id} value={String(f.vehicle_id)}>
                      {f.vehicle_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DayFilter date={selectedDate} onChange={setSelectedDate} />
          </div>

          {selectedVehicle && stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Min Fuel", value: stats.min, icon: TrendingDown, color: "text-red-500" },
                { label: "Max Fuel", value: stats.max, icon: TrendingUp, color: "text-emerald-500" },
                { label: "Avg Fuel", value: stats.avg, icon: Droplets, color: "text-blue-500" },
                { label: "Range", value: stats.consumed, icon: Fuel, color: "text-amber-500" },
              ].map((s) => (
                <div key={s.label} className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-1">
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                  </div>
                  <p className="text-lg font-bold">
                    {s.value.toFixed(1)}
                    {unit}
                  </p>
                </div>
              ))}
            </div>
          )}

          {chartData.length > 0 && (
            <div className="h-[300px]">
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${v} ${unit}`, "Fuel"]} />
                  <Line
                    type="monotone"
                    dataKey="fuel"
                    stroke="hsl(174, 62%, 38%)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {selectedVehicle && chartData.length === 0 && (
            <p className="text-sm text-muted-foreground">No valid fuel data for this day.</p>
          )}

          {/* Fuel triggers (refuel / drop) */}
          {selectedVehicle && (
            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Fuel className="h-4 w-4 text-amber-500" />
                  Fuel Triggers ({events.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {events.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No sudden refuel or drop detected for this day.
                  </p>
                )}
                {events.map((e, idx) => {
                  const isRefuel = e.type === "refuel";
                  const deltaUnit = pctToLiters(Math.abs(e.deltaLevel));
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        isRefuel ? "bg-emerald-50/60 border-emerald-200" : "bg-red-50/60 border-red-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isRefuel ? (
                            <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <ArrowDownCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-semibold text-slate-800">
                            {isRefuel ? "Refuel" : "Fuel drop"}
                          </span>
                        </div>
                        <span className={`text-sm font-bold ${isRefuel ? "text-emerald-700" : "text-red-700"}`}>
                          {isRefuel ? "+" : "-"}
                          {deltaUnit.toFixed(1)}
                          {unit}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        {formatIST(e.startTime)} → {formatISTTime(e.endTime)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {pctToLiters(e.fromLevel).toFixed(1)}
                        {unit} → {pctToLiters(e.toLevel).toFixed(1)}
                        {unit}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
