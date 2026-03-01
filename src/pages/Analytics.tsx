import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const defaultFrom = new Date(Date.now() - 86400000).toISOString().slice(0, 16);
const defaultTo = new Date().toISOString().slice(0, 16);

export default function Analytics() {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const { data: activity = [] } = useQuery({
    queryKey: ["vehicle-activity", from, to],
    queryFn: () => api.getVehicleActivity(from, to),
    enabled: !!from && !!to,
  });

  const { data: geofenceSummary = [] } = useQuery({
    queryKey: ["geofence-summary", from, to],
    queryFn: () => api.getGeofenceSummary(from, to),
    enabled: !!from && !!to,
  });

  const { data: violations = [] } = useQuery({
    queryKey: ["speed-violations", from, to],
    queryFn: () => api.getSpeedViolations({ from, to, speed_limit: 80 }),
    enabled: !!from && !!to,
  });

  // Hourly stats for selected vehicle
  const [hourlyVehicle, setHourlyVehicle] = useState<string>("");
  const { data: hourlyStats = [] } = useQuery({
    queryKey: ["hourly-stats", hourlyVehicle, from, to],
    queryFn: () => api.getHourlyStats(Number(hourlyVehicle), from, to),
    enabled: !!hourlyVehicle && !!from && !!to,
  });

  const hourlyData = hourlyStats.map((h) => ({
    hour: new Date(h.hour).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    avgSpeed: h.avg_speed,
    maxSpeed: h.max_speed,
    satellites: h.avg_satellites,
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex gap-3">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          </div>
        </div>
      </div>

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Vehicle Activity</TabsTrigger>
          <TabsTrigger value="hourly">Hourly Stats</TabsTrigger>
          <TabsTrigger value="geofence">Geofence Summary</TabsTrigger>
          <TabsTrigger value="violations">Speed Violations</TabsTrigger>
        </TabsList>

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
                      <TableCell>{a.avg_speed.toFixed(1)} km/h</TableCell>
                      <TableCell>{a.max_speed} km/h</TableCell>
                      <TableCell className="text-xs">{new Date(a.first_seen).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{new Date(a.last_seen).toLocaleString()}</TableCell>
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
                {activity.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.vehicle_number}</SelectItem>
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
                        <Badge variant="destructive">{v.speed} km/h</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}</TableCell>
                      <TableCell className="text-xs">{new Date(v.timestamp).toLocaleString()}</TableCell>
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
