import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import { MapPin, Clock, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Create custom marker icons
const createStartIcon = () => {
  return L.divIcon({
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background-color: #10b981;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      </div>
    `,
    className: 'custom-marker-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

const createEndIcon = () => {
  return L.divIcon({
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background-color: #ef4444;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    `,
    className: 'custom-marker-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

const createPointIcon = () => {
  return L.divIcon({
    html: `
      <div style="
        width: 28px;
        height: 28px;
        background-color: #3b82f6;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="8"/>
        </svg>
      </div>
    `,
    className: 'custom-marker-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  
  useMemo(() => {
    map.flyTo(center, zoom, { animate: true, duration: 1.5 });
  }, [center, zoom, map]);

  return null;
}

export default function RouteHistory() {
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: api.getVehicles,
  });

  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [routeFrom, setRouteFrom] = useState("");
  const [routeTo, setRouteTo] = useState(new Date().toISOString().slice(0, 16));
  const [pointInTime, setPointInTime] = useState("");

  // Route history query
  const { data: route = [], isLoading: routeLoading } = useQuery({
    queryKey: ["route", selectedVehicle, routeFrom, routeTo],
    queryFn: () => api.getVehicleRoute(Number(selectedVehicle), routeFrom, routeTo),
    enabled: !!selectedVehicle && !!routeFrom && !!routeTo,
  });

  // Point in time query
  const { data: pointLocations = [], isLoading: pointLoading } = useQuery({
    queryKey: ["location-at-time", pointInTime, selectedVehicle],
    queryFn: () => api.getLocationsAtTime(pointInTime, selectedVehicle ? Number(selectedVehicle) : undefined),
    enabled: !!pointInTime,
  });

  const routePositions = route
    .filter((p: any) => p.latitude && p.longitude)
    .map((p: any) => [p.latitude, p.longitude] as [number, number]);

  const selectedVehicleData = vehicles.find((v) => v.id === Number(selectedVehicle));

  const routeCenter: [number, number] = useMemo(() => {
    if (routePositions.length > 0) {
      return routePositions[Math.floor(routePositions.length / 2)];
    }
    if (selectedVehicleData?.last_lat && selectedVehicleData?.last_lon) {
      return [selectedVehicleData.last_lat, selectedVehicleData.last_lon];
    }
    return [20.5937, 78.9629];
  }, [routePositions, selectedVehicleData]);

  const pointCenter: [number, number] = useMemo(() => {
    if (pointLocations.length > 0) {
      const loc = pointLocations[0];
      return [loc.latitude, loc.longitude];
    }
    return [20.5937, 78.9629];
  }, [pointLocations]);

  return (
    <div className="p-6 space-y-6">
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 rounded-xl p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <RouteIcon className="h-8 w-8" />
          Route History
        </h1>
        <p className="text-slate-300 mt-1">Track vehicle routes and locations over time</p>
      </div>

      {/* Vehicle Selection */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-800 text-white">
          <CardTitle className="text-lg">Select Vehicle</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="max-w-md">
            <Label htmlFor="vehicle">Vehicle</Label>
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger id="vehicle">
                <SelectValue placeholder="Choose a vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.vehicle_number} - {v.vehicle_type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedVehicle && (
        <Tabs defaultValue="route" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="route">Route History</TabsTrigger>
            <TabsTrigger value="point">Point in Time</TabsTrigger>
          </TabsList>

          {/* Route History Tab */}
          <TabsContent value="route" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-800 text-white">
                <CardTitle className="text-lg flex items-center gap-2">
                  <RouteIcon className="h-5 w-5" />
                  Route Between Times
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="from">From</Label>
                    <Input
                      id="from"
                      type="datetime-local"
                      value={routeFrom}
                      onChange={(e) => setRouteFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="to">To</Label>
                    <Input
                      id="to"
                      type="datetime-local"
                      value={routeTo}
                      onChange={(e) => setRouteTo(e.target.value)}
                    />
                  </div>
                </div>

                {routeLoading && (
                  <p className="text-sm text-muted-foreground">Loading route...</p>
                )}

                {!routeLoading && routePositions.length === 0 && routeFrom && routeTo && (
                  <p className="text-sm text-muted-foreground">No route data found for this time period</p>
                )}

                {routePositions.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Points:</span>
                      <span className="font-semibold">{routePositions.length}</span>
                    </div>

                    {/* Legend */}
                    <Card className="bg-slate-50 border-slate-200">
                      <CardContent className="p-3">
                        <p className="text-xs font-semibold text-slate-700 mb-2">Legend</p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white shadow-md flex items-center justify-center">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                              </svg>
                            </div>
                            <span className="text-xs text-slate-700">Start Point</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-red-500 border-2 border-white shadow-md flex items-center justify-center">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                              </svg>
                            </div>
                            <span className="text-xs text-slate-700">End Point</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-1 bg-blue-500 rounded"></div>
                            <span className="text-xs text-slate-700">Route Path</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="h-[500px] rounded-lg overflow-hidden border-2 border-slate-200 relative">
                      <MapContainer
                        center={routeCenter}
                        zoom={13}
                        className="h-full w-full"
                      >
                        <MapController center={routeCenter} zoom={13} />
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <Polyline
                          positions={routePositions}
                          pathOptions={{ color: "#3b82f6", weight: 4, opacity: 0.7 }}
                        />
                        <Marker position={routePositions[0]} icon={createStartIcon()}>
                          <Popup>
                            <div className="text-sm">
                              <p className="font-bold text-emerald-600">Start Point</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(route[0].timestamp).toLocaleString()}
                              </p>
                            </div>
                          </Popup>
                        </Marker>
                        <Marker
                          position={routePositions[routePositions.length - 1]}
                          icon={createEndIcon()}
                        >
                          <Popup>
                            <div className="text-sm">
                              <p className="font-bold text-red-600">End Point</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(route[route.length - 1].timestamp).toLocaleString()}
                              </p>
                            </div>
                          </Popup>
                        </Marker>
                      </MapContainer>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Point in Time Tab */}
          <TabsContent value="point" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-800 text-white">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Vehicle Location at Specific Time
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="max-w-md">
                  <Label htmlFor="pointTime">Select Date & Time</Label>
                  <Input
                    id="pointTime"
                    type="datetime-local"
                    value={pointInTime}
                    onChange={(e) => setPointInTime(e.target.value)}
                    max={new Date().toISOString().slice(0, 16)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Example: 2/28/2026 3:28 PM
                  </p>
                </div>

                {pointLoading && (
                  <p className="text-sm text-muted-foreground">Loading location...</p>
                )}

                {!pointLoading && pointLocations.length === 0 && pointInTime && (
                  <p className="text-sm text-muted-foreground">
                    No location data found for this time
                  </p>
                )}

                {pointLocations.length > 0 && (
                  <div className="space-y-3">
                    {pointLocations.map((loc: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-slate-800">
                              {loc.vehicle_number || `Vehicle #${loc.vehicle_id}`}
                            </p>
                            <p className="text-sm text-slate-600 mt-1">
                              Speed: {loc.speed} km/h • Satellites: {loc.satellites}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                            </p>
                          </div>
                          <MapPin className="h-5 w-5 text-blue-600" />
                        </div>
                      </div>
                    ))}

                    <div className="h-[500px] rounded-lg overflow-hidden border-2 border-slate-200">
                      <MapContainer
                        center={pointCenter}
                        zoom={15}
                        className="h-full w-full"
                      >
                        <MapController center={pointCenter} zoom={15} />
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {pointLocations.map((loc: any, idx: number) => (
                          <Marker
                            key={idx}
                            position={[loc.latitude, loc.longitude]}
                            icon={createPointIcon()}
                          >
                            <Popup>
                              <div className="text-sm space-y-1">
                                <p className="font-bold">
                                  {loc.vehicle_number || `Vehicle #${loc.vehicle_id}`}
                                </p>
                                <p>Speed: {loc.speed} km/h</p>
                                <p>Satellites: {loc.satellites}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {new Date(loc.timestamp).toLocaleString()}
                                </p>
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
