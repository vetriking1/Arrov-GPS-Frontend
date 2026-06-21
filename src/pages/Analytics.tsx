import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  todayRange, yesterdayRange, thisWeekRange, thisMonthRange, istDayRange, istTodayString,
  formatIST, formatISTTime, shiftHours,
} from "@/lib/datetime";
import { detectTrips } from "@/lib/geofenceAnalysis";
import type { RoutePoint } from "@/lib/routeAnalysis";

type Preset = "today" | "yesterday" | "week" | "month" | "custom";
const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

export default function Analytics() {
  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState(istTodayString());
  const [customTo, setCustomTo] = useState(istTodayString());

  // Resolve the active preset into a UTC range (IST-aware).
  const range = useMemo(() => {
    switch (preset) {
      case "yesterday":
        return yesterdayRange();
      case "week":
        return thisWeekRange();
      case "month":
        return thisMonthRange();
      case "custom":
        return { fromUTC: istDayRange(customFrom).fromUTC, toUTC: istDayRange(customTo).toUTC };
      case "today":
      default:
        return todayRange();
    }
  }, [preset, customFrom, customTo]);

  const from = range.fromUTC;
  const to = range.toUTC;

  const { data: vehicles = [] } = useQuery({ queryKey: ["vehicles"], queryFn: api.getVehicles });

  const { data: activity = [] } = useQuery({
    queryKey: ["vehicle-activity", from, to],
    queryFn: () => api.getVehicleActivity(from, to),
  });

  const { data: geofenceSummary = [] } = useQuery({
    queryKey: ["geofence-summary", from, to],
    queryFn: () => api.getGeofenceSummary(from, to),
  });

  const { data: violations = [] } = useQuery({
    queryKey: ["speed-violations", from, to],
    queryFn: () => api.getSpeedViolations({ from, to, speed_limit: 80 }),
  });

  // Hourly stats for selected vehicle
  const [hourlyVehicle, setHourlyVehicle] = useState<string>("");
  const { data: hourlyStats = [] } = useQuery({
    queryKey: ["hourly-stats", hourlyVehicle, from, to],
    queryFn: () => api.getHourlyStats(Number(hourlyVehicle), from, to),
    enabled: !!hourlyVehicle,
  });

  const hourlyData = hourlyStats.map((h) => ({
    hour: formatISTTime(h.hour),
    avgSpeed: Number(h.avg_speed) || 0,
    maxSpeed: Number(h.max_speed) || 0,
    satellites: Number(h.avg_satellites) || 0,
  }));

  // --- Trips (item 13): geofence-based, computed on the frontend ---
  const [tripVehicle, setTripVehicle] = useState<string>("");
  const { data: activeGeofences = [] } = useQuery({
    queryKey: ["geofences-active"],
    queryFn: () => api.getGeofences(true),
  });
  // Margin so trips crossing the range boundary close cleanly; attribute by start within range.
  const { data: tripRoute = [] } = useQuery({
    queryKey: ["analytics-trips", tripVehicle, from, to],
    queryFn: () => api.getVehicleRoute(Number(tripVehicle), shiftHours(from, -3), shiftHours(to, 3)),
    enabled: !!tripVehicle,
  });
  const trips = useMemo(
    () =>
      detectTrips(tripRoute as RoutePoint[], activeGeofences).filter(
        (t) => t.startTime >= from && t.startTime < to
      ),
    [tripRoute, activeGeofences, from, to]
  );
  const totalTripKm = useMemo(() => trips.reduce((s, t) => s + t.distanceKm, 0), [trips]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex flex-wrap items-end gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={preset === p.key ? "default" : "outline"}
              onClick={() => setPreset(p.key)}
            >
              {p.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant={preset === "custom" ? "default" : "outline"}
            onClick={() => setPreset("custom")}
          >
            Custom
          </Button>
          {preset === "custom" && (
            <div className="flex items-end gap-2">
              <div>
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  max={istTodayString()}
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-40"
                />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  max={istTodayString()}
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-40"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="trips">
        <TabsList>
          <TabsTrigger value="trips">Trips</TabsTrigger>
          <TabsTrigger value="activity">Vehicle Activity</TabsTrigger>
          <TabsTrigger value="hourly">Hourly Stats</TabsTrigger>
          <TabsTrigger value="geofence">Geofence Summary</TabsTrigger>
          <TabsTrigger value="violations">Speed Violations</TabsTrigger>
        </TabsList>

        {/* Trips (geofence-based trip-wise filter) */}
        <TabsContent value="trips" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <Label>Vehicle</Label>
              <Select value={tripVehicle} onValueChange={setTripVehicle}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.vehicle_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tripVehicle && (
              <div className="flex gap-3">
                <div className="p-3 rounded-lg bg-muted/50 min-w-28">
                  <p className="text-xs text-muted-foreground">Trips</p>
                  <p className="text-lg font-bold">{trips.length}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 min-w-28">
                  <p className="text-xs text-muted-foreground">Total Distance</p>
                  <p className="text-lg font-bold">{totalTripKm.toFixed(2)} km</p>
                </div>
              </div>
            )}
          </div>

          {tripVehicle && (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead className="text-right">Distance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trips.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          {activeGeofences.length === 0
                            ? "No active geofences defined — trips are detected between geofences"
                            : "No trips in this period"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      trips.map((t) => (
                        <TableRow key={t.index}>
                          <TableCell className="font-semibold">{t.index}</TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{t.startFence ?? "Open location"}</div>
                            <div className="text-xs text-muted-foreground">{formatIST(t.startTime)}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">
                              {t.endFence ?? "Open location"}
                              {t.status !== "complete" && (
                                <Badge variant="secondary" className="ml-2">{t.status}</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{formatIST(t.endTime)}</div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{t.distanceKm} km</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Data Points</TableHead>
                    <TableHead>Avg Speed</TableHead>
                    <TableHead>Max Speed</TableHead>
                    <TableHead>First Seen</TableHead>
                    <TableHead>Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.vehicle_number}</TableCell>
                      <TableCell>{a.data_points}</TableCell>
                      <TableCell>
                        {a.avg_speed != null ? Number(a.avg_speed).toFixed(1) : '—'} km/h
                      </TableCell>
                      <TableCell>{a.max_speed != null ? Number(a.max_speed) : '—'} km/h</TableCell>
                      <TableCell className="text-xs">{formatIST(a.first_seen)}</TableCell>
                      <TableCell className="text-xs">{formatIST(a.last_seen)}</TableCell>
                    </TableRow>
                  ))}
                  {activity.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hourly" className="mt-4 space-y-4">
          <div className="w-56">
            <Label>Vehicle</Label>
            <Select value={hourlyVehicle} onValueChange={setHourlyVehicle}>
              <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>{v.vehicle_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hourlyData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Speed Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer>
                    <LineChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="avgSpeed" name="Avg Speed" stroke="hsl(174, 62%, 38%)" strokeWidth={2} />
                      <Line type="monotone" dataKey="maxSpeed" name="Max Speed" stroke="#ef4444" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="geofence" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Geofence</TableHead>
                    <TableHead>Unique Vehicles</TableHead>
                    <TableHead>Total Events</TableHead>
                    <TableHead>Entries</TableHead>
                    <TableHead>Exits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {geofenceSummary.map((g) => (
                    <TableRow key={g.geofence_id}>
                      <TableCell className="font-medium">{g.geofence_name}</TableCell>
                      <TableCell>{g.unique_vehicles}</TableCell>
                      <TableCell>{g.total_events}</TableCell>
                      <TableCell>{g.entries}</TableCell>
                      <TableCell>{g.exits}</TableCell>
                    </TableRow>
                  ))}
                  {geofenceSummary.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="violations" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Speed</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {violations.map((v, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{v.vehicle_number}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">
                          {v.speed != null ? Number(v.speed) : '—'} km/h
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {v.latitude != null && v.longitude != null
                          ? `${Number(v.latitude).toFixed(4)}, ${Number(v.longitude).toFixed(4)}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs">{formatIST(v.received_at)}</TableCell>
                    </TableRow>
                  ))}
                  {violations.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No violations</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
