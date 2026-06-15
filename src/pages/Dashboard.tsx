import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useWSData } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Activity, MapPin, Hexagon, AlertTriangle } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Create custom car icons with colored circle background
const createCarIcon = (color: string) => {
  return L.divIcon({
    html: `
      <div style="
        width: 40px;
        height: 40px;
        background-color: ${color};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
        </svg>
      </div>
    `,
    className: 'custom-car-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
};

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // Only pan to new center, don't reset zoom
    map.panTo(center, { animate: true, duration: 1 });
  }, [center, map]);

  return null;
}

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
      gradient: "from-slate-500 to-slate-700",
      iconBg: "bg-slate-100",
      iconColor: "text-slate-700",
    },
    {
      label: "Active Vehicles",
      value: dashboard?.active_vehicles ?? "—",
      icon: Activity,
      gradient: "from-emerald-500 to-emerald-700",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-700",
    },
    {
      label: "Tracked Today",
      value: dashboard?.vehicles_tracked_today ?? "—",
      icon: MapPin,
      gradient: "from-amber-500 to-amber-700",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-700",
    },
    {
      label: "Active Geofences",
      value: dashboard?.active_geofences ?? "—",
      icon: Hexagon,
      gradient: "from-purple-500 to-purple-700",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-700",
    },
  ];

  const defaultCenter: [number, number] =
    locations.length > 0
      ? [
          locations.reduce((s, l) => s + l.latitude, 0) / locations.length,
          locations.reduce((s, l) => s + l.longitude, 0) / locations.length,
        ]
      : [20.5937, 78.9629];

  const defaultZoom = locations.length > 0 ? 14 : 5;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
      <div className="p-6 space-y-6">
        {/* Summary cards with gradients */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card key={s.label} className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow">
              <div className={`h-2 bg-gradient-to-r ${s.gradient}`}></div>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground font-medium">{s.label}</p>
                    <p className="text-3xl font-bold mt-2 bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent">
                      {s.value}
                    </p>
                  </div>
                  <div className={`p-4 rounded-full ${s.iconBg}`}>
                    <s.icon className={`h-6 w-6 ${s.iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Mini map */}
          <Card className="lg:col-span-2 border-0 shadow-lg overflow-hidden">
            <CardHeader className="pb-2 bg-gradient-to-r from-slate-600 to-slate-800 text-white">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Vehicle Locations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[400px]">
                <MapContainer
                  center={defaultCenter}
                  zoom={defaultZoom}
                  className="h-full w-full"
                  scrollWheelZoom
                >
                  <MapUpdater center={defaultCenter} />
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
                      <Marker
                        key={loc.vehicleId}
                        position={[loc.latitude, loc.longitude]}
                        icon={createCarIcon(color)}
                      >
                        <Popup>
                          <div className="text-sm space-y-1">
                            <p className="font-bold">{loc.vehicleNumber}</p>
                            <p>Speed: {loc.speed} km/h</p>
                            <p className="text-xs text-gray-500">
                              {new Date(loc.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recent alerts */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardHeader className="pb-2 bg-gradient-to-r from-amber-500 to-amber-700 text-white">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Recent Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[400px] overflow-auto p-4">
              {geofenceAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-muted-foreground">No recent alerts</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {geofenceAlerts.slice(0, 10).map((alert, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 hover:shadow-md transition-shadow"
                    >
                      <div
                        className={`mt-0.5 w-3 h-3 rounded-full flex-shrink-0 ${
                          alert.eventType === "inside"
                            ? "bg-emerald-500 shadow-lg shadow-emerald-500/50"
                            : "bg-red-500 shadow-lg shadow-red-500/50"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate text-slate-800">
                          Vehicle #{alert.vehicleId}
                        </p>
                        <p className="text-sm text-slate-600 truncate">{alert.geofenceName}</p>
                        <p className="text-muted-foreground text-xs mt-1">
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

        {/* Quick Actions */}
      </div>
    </div>
  );
}
