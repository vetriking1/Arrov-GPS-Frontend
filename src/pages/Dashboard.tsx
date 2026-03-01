import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useWSData } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Activity, MapPin, Hexagon, AlertTriangle } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function Dashboard() {
  const { data: dashboard } = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.getDashboard,
    refetchInterval: 30000,
  });

  const { vehicleLocations, geofenceAlerts, vehicleStatuses } = useWSData();
  const locations = Object.values(vehicleLocations);

  const stats = [
    {
      label: "Total Vehicles",
      value: dashboard?.total_vehicles ?? "—",
      icon: Truck,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Active Vehicles",
      value: dashboard?.active_vehicles ?? "—",
      icon: Activity,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Tracked Today",
      value: dashboard?.vehicles_tracked_today ?? "—",
      icon: MapPin,
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "Active Geofences",
      value: dashboard?.active_geofences ?? "—",
      icon: Hexagon,
      color: "text-purple-600 bg-purple-50",
    },
  ];

  const defaultCenter: [number, number] =
    locations.length > 0
      ? [
          locations.reduce((s, l) => s + l.latitude, 0) / locations.length,
          locations.reduce((s, l) => s + l.longitude, 0) / locations.length,
        ]
      : [20.5937, 78.9629];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-3 rounded-lg ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mini map */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vehicle Locations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[350px] rounded-b-lg overflow-hidden">
              <MapContainer
                center={defaultCenter}
                zoom={5}
                className="h-full w-full"
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {locations.map((loc) => {
                  const status = vehicleStatuses[loc.vehicleId]?.status;
                  const color =
                    loc.speed > 0
                      ? "#10b981"
                      : status === "online"
                      ? "#f59e0b"
                      : "#ef4444";
                  return (
                    <CircleMarker
                      key={loc.vehicleId}
                      center={[loc.latitude, loc.longitude]}
                      radius={7}
                      pathOptions={{ color, fillColor: color, fillOpacity: 0.8 }}
                    >
                      <Popup>
                        <strong>{loc.vehicleNumber}</strong>
                        <br />
                        Speed: {loc.speed} km/h
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Recent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[350px] overflow-auto">
            {geofenceAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No recent alerts
              </p>
            ) : (
              <div className="space-y-3">
                {geofenceAlerts.slice(0, 10).map((alert, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-2 rounded-md bg-muted/50 text-sm"
                  >
                    <div
                      className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                        alert.eventType === "inside"
                          ? "bg-emerald-500"
                          : "bg-red-500"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        Vehicle #{alert.vehicleId} — {alert.geofenceName}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {alert.eventType} •{" "}
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
