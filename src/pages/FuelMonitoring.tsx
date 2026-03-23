import { useQuery } from "@tanstack/react-query";
import { api, type FuelLive } from "@/lib/api";
import { useWSData } from "@/components/AppLayout";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Fuel, Droplets, TrendingDown, TrendingUp } from "lucide-react";

export default function FuelMonitoring() {
  const { fuelUpdates } = useWSData();

  const { data: fuelLive = [] } = useQuery({
    queryKey: ["fuel-live"],
    queryFn: api.getLiveFuel,
    refetchInterval: 15000,
  });

  // Merge REST + WS data
  // Note: REST API returns fuel_level in liters, WebSocket returns fuelLevel as percentage
  const mergedFuel = useMemo(() => {
    const map = new Map<number, FuelLive & { _fuelPct?: number }>();
    fuelLive.forEach((f) =>
      map.set(f.vehicle_id, { ...f, _fuelPct: undefined })
    );
    Object.values(fuelUpdates).forEach((wu) => {
      const existing = map.get(wu.vehicleId);
      if (existing) {
        // WebSocket fuelLevel is already a percentage, store it separately
        existing._fuelPct = wu.fuelLevel;
        existing.voltage = wu.voltage;
      }
    });
    return Array.from(map.values());
  }, [fuelLive, fuelUpdates]);

  // History
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [histFrom, setHistFrom] = useState("");
  const [histTo, setHistTo] = useState("");

  const { data: history = [] } = useQuery({
    queryKey: ["fuel-history", selectedVehicle, histFrom, histTo],
    queryFn: () =>
      api.getFuelHistory(Number(selectedVehicle), histFrom, histTo),
    enabled: !!selectedVehicle && !!histFrom && !!histTo,
  });

  const { data: consumption } = useQuery({
    queryKey: ["fuel-consumption", selectedVehicle, histFrom, histTo],
    queryFn: () =>
      api.getFuelConsumption(Number(selectedVehicle), histFrom, histTo),
    enabled: !!selectedVehicle && !!histFrom && !!histTo,
  });

  const chartData = history.map((h: any) => ({
    time: new Date(h.received_at || h.timestamp).toLocaleTimeString(),
    fuel: Number(h.fuel_level) || 0,
  }));

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Fuel Monitoring</h1>

      {/* Live fuel gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {mergedFuel.map((f) => {
          const fuelLevel = Number(f.fuel_level) || 0;
          const tankCapacity = Number(f.fuel_tank_capacity) || 0;
          // Use WebSocket percentage if available, otherwise calculate from REST data
          const pct =
            f._fuelPct !== undefined
              ? f._fuelPct
              : tankCapacity > 0
              ? (fuelLevel / tankCapacity) * 100
              : fuelLevel;
          return (
            <Card key={f.vehicle_id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Fuel className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">
                      {f.vehicle_number}
                    </span>
                  </div>
                  <span className="text-lg font-bold">
                    {fuelLevel.toFixed(1)}L
                  </span>
                </div>
                <Progress value={Math.min(pct, 100)} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {pct.toFixed(0)}% • {tankCapacity}L capacity
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
          <CardTitle className="text-base">Fuel History & Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="w-48">
              <Label>Vehicle</Label>
              <Select
                value={selectedVehicle}
                onValueChange={setSelectedVehicle}
              >
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
            <div>
              <Label>From</Label>
              <Input
                type="datetime-local"
                value={histFrom}
                onChange={(e) => setHistFrom(e.target.value)}
              />
            </div>
            <div>
              <Label>To</Label>
              <Input
                type="datetime-local"
                value={histTo}
                onChange={(e) => setHistTo(e.target.value)}
              />
            </div>
          </div>

          {consumption && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: "Min Fuel",
                  value: `${Number(consumption.min_fuel || 0).toFixed(1)}L`,
                  icon: TrendingDown,
                  color: "text-red-500",
                },
                {
                  label: "Max Fuel",
                  value: `${Number(consumption.max_fuel || 0).toFixed(1)}L`,
                  icon: TrendingUp,
                  color: "text-emerald-500",
                },
                {
                  label: "Avg Fuel",
                  value: `${Number(consumption.avg_fuel || 0).toFixed(1)}L`,
                  icon: Droplets,
                  color: "text-blue-500",
                },
                {
                  label: "Consumed",
                  value: `${Number(consumption.fuel_consumed || 0).toFixed(
                    1
                  )}L`,
                  icon: Fuel,
                  color: "text-amber-500",
                },
              ].map((s) => (
                <div key={s.label} className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-1">
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                    <span className="text-xs text-muted-foreground">
                      {s.label}
                    </span>
                  </div>
                  <p className="text-lg font-bold">{s.value}</p>
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
                  <Tooltip />
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
        </CardContent>
      </Card>
    </div>
  );
}
