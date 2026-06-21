import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import { MapPin, Clock, Route as RouteIcon, OctagonPause } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { istTodayString, istDayRange, addDays, formatIST, formatISTTime, toUTCISOFromISTLocal, shiftHours, istDateOf } from "@/lib/datetime";
import { detectHalts, type RoutePoint } from "@/lib/routeAnalysis";
import { detectTrips, filterHaltsOutsideGeofences } from "@/lib/geofenceAnalysis";

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

const createHaltIcon = (highlighted: boolean) => {
  const bg = highlighted ? "#f97316" : "#f59e0b";
  const size = highlighted ? 34 : 26;
  return L.divIcon({
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${bg};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      ">
        <svg width="${size / 2}" height="${size / 2}" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="5" width="4" height="14" rx="1"/>
          <rect x="14" y="5" width="4" height="14" rx="1"/>
        </svg>
      </div>
    `,
    className: 'custom-marker-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

const createScrubIcon = () => {
  return L.divIcon({
    html: `
      <div style="
        width: 26px;
        height: 26px;
        background-color: #8b5cf6;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid white;
        box-shadow: 0 2px 10px rgba(139,92,246,0.6);
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="6"/>
        </svg>
      </div>
    `,
    className: 'custom-marker-icon',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  });
};

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, zoom, { animate: true, duration: 1.2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], zoom]);

  return null;
}

// Frame the map to a selected trip's path.
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length >= 2) {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40], animate: true });
    } else if (positions.length === 1) {
      map.flyTo(positions[0], 15, { animate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);
  return null;
}

export default function RouteHistory() {
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: api.getVehicles,
  });

  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(istTodayString());
  const [pointInTime, setPointInTime] = useState("");

  // Map focus (clicking a halt) and timeline scrubber position.
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [scrubIndex, setScrubIndex] = useState(0);
  const [selectedTripIndex, setSelectedTripIndex] = useState<number | null>(null);

  const today = istTodayString();
  const dayRange = useMemo(() => istDayRange(selectedDate), [selectedDate]);

  // Route history query (single IST day -> UTC range)
  const { data: route = [], isLoading: routeLoading } = useQuery({
    queryKey: ["route", selectedVehicle, dayRange.fromUTC, dayRange.toUTC],
    queryFn: () => api.getVehicleRoute(Number(selectedVehicle), dayRange.fromUTC, dayRange.toUTC),
    enabled: !!selectedVehicle && !!selectedDate,
  });

  // Active geofences (for halt suppression + trip detection)
  const { data: activeGeofences = [] } = useQuery({
    queryKey: ["geofences-active"],
    queryFn: () => api.getGeofences(true),
  });

  // Trip detection uses a margin-extended window so trips crossing the day boundary close cleanly.
  const tripFrom = useMemo(() => shiftHours(dayRange.fromUTC, -3), [dayRange.fromUTC]);
  const tripTo = useMemo(() => shiftHours(dayRange.toUTC, 3), [dayRange.toUTC]);
  const { data: tripRoute = [] } = useQuery({
    queryKey: ["route-trips", selectedVehicle, tripFrom, tripTo],
    queryFn: () => api.getVehicleRoute(Number(selectedVehicle), tripFrom, tripTo),
    enabled: !!selectedVehicle && !!selectedDate,
  });

  // Point in time query
  const { data: pointLocations = [], isLoading: pointLoading } = useQuery({
    queryKey: ["location-at-time", pointInTime, selectedVehicle],
    queryFn: () =>
      api.getLocationsAtTime(
        toUTCISOFromISTLocal(pointInTime),
        selectedVehicle ? Number(selectedVehicle) : undefined
      ),
    enabled: !!pointInTime,
  });

  const routePoints = route as RoutePoint[];

  const routePositions = routePoints
    .filter((p) => p.latitude && p.longitude)
    .map((p) => [p.latitude, p.longitude] as [number, number]);

  // Halts inside an active geofence are expected visits, not suspicious halts → filtered out.
  const halts = useMemo(
    () => filterHaltsOutsideGeofences(detectHalts(routePoints), activeGeofences),
    [routePoints, activeGeofences]
  );

  // Trips for the selected day, attributed by the IST date of each trip's start point.
  const trips = useMemo(
    () =>
      detectTrips(tripRoute as RoutePoint[], activeGeofences).filter(
        (t) => istDateOf(t.startTime) === selectedDate
      ),
    [tripRoute, activeGeofences, selectedDate]
  );

  const selectedTrip = useMemo(
    () => trips.find((t) => t.index === selectedTripIndex) ?? null,
    [trips, selectedTripIndex]
  );

  // The timeline scrubs the whole day by default, or just the selected trip's points.
  const timelinePoints = useMemo(() => {
    if (selectedTrip) {
      const s = new Date(selectedTrip.startTime).getTime();
      const e = new Date(selectedTrip.endTime).getTime();
      return (tripRoute as RoutePoint[]).filter((p) => {
        const t = new Date(p.received_at).getTime();
        return t >= s && t <= e;
      });
    }
    return routePoints;
  }, [selectedTrip, tripRoute, routePoints]);

  // Reset scrubber + focus + selected trip whenever the underlying route changes.
  useEffect(() => {
    setScrubIndex(0);
    setFocus(null);
    setSelectedTripIndex(null);
  }, [selectedVehicle, dayRange.fromUTC]);

  // Restart the scrubber when switching between full-day and a trip.
  useEffect(() => {
    setScrubIndex(0);
  }, [selectedTripIndex]);

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

  // What the map should currently look at: a focused halt, else the route center.
  const view = useMemo<{ center: [number, number]; zoom: number }>(() => {
    if (focus) return { center: [focus.lat, focus.lng], zoom: focus.zoom };
    return { center: routeCenter, zoom: 13 };
  }, [focus, routeCenter]);

  const scrubPoint = timelinePoints[Math.min(scrubIndex, timelinePoints.length - 1)];

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
        <p className="text-slate-300 mt-1">Track vehicle routes and locations over time (IST)</p>
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
                  Route for a Day
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {/* Date filters: Today / Yesterday / single date */}
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex gap-2">
                    <Button
                      variant={selectedDate === today ? "default" : "outline"}
                      onClick={() => setSelectedDate(today)}
                    >
                      Today
                    </Button>
                    <Button
                      variant={selectedDate === addDays(today, -1) ? "default" : "outline"}
                      onClick={() => setSelectedDate(addDays(today, -1))}
                    >
                      Yesterday
                    </Button>
                  </div>
                  <div>
                    <Label htmlFor="date">Pick a date</Label>
                    <Input
                      id="date"
                      type="date"
                      max={today}
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-44"
                    />
                  </div>
                </div>

                {routeLoading && (
                  <p className="text-sm text-muted-foreground">Loading route...</p>
                )}

                {!routeLoading && routePositions.length === 0 && (
                  <p className="text-sm text-muted-foreground">No route data found for this day</p>
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
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-emerald-500 border-2 border-white shadow-md" />
                            <span className="text-xs text-slate-700">Start</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-white shadow-md" />
                            <span className="text-xs text-slate-700">End</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-amber-500 border-2 border-white shadow-md" />
                            <span className="text-xs text-slate-700">Halt</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-violet-500 border-2 border-white shadow-md" />
                            <span className="text-xs text-slate-700">Timeline position</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-1 bg-blue-500 rounded" />
                            <span className="text-xs text-slate-700">Route path</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Selected-trip info banner */}
                    {selectedTrip && (
                      <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-violet-50 border border-violet-200">
                        <div className="text-sm">
                          <span className="font-semibold text-violet-800">
                            Trip #{selectedTrip.index}:{" "}
                          </span>
                          <span className="text-violet-700">
                            {selectedTrip.startFence ?? "Open location"} →{" "}
                            {selectedTrip.endFence ?? "Open location"}
                          </span>
                          <span className="text-xs text-violet-600 ml-2">
                            {selectedTrip.distanceKm} km • {formatISTTime(selectedTrip.startTime)}–
                            {formatISTTime(selectedTrip.endTime)}
                            {selectedTrip.status !== "complete" && ` • ${selectedTrip.status}`}
                          </span>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setSelectedTripIndex(null)}>
                          Show full day
                        </Button>
                      </div>
                    )}

                    <div className="h-[500px] rounded-lg overflow-hidden border-2 border-slate-200 relative">
                      <MapContainer
                        center={routeCenter}
                        zoom={13}
                        className="h-full w-full"
                      >
                        <MapController center={view.center} zoom={view.zoom} />
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <Polyline
                          positions={routePositions}
                          pathOptions={{ color: "#3b82f6", weight: 4, opacity: selectedTrip ? 0.2 : 0.7 }}
                        />

                        {/* Highlighted single-trip route */}
                        {selectedTrip && selectedTrip.path.length >= 2 && (
                          <>
                            <FitBounds positions={selectedTrip.path} />
                            <Polyline
                              positions={selectedTrip.path}
                              pathOptions={{ color: "#7c3aed", weight: 6, opacity: 0.95 }}
                            />
                            <Marker position={selectedTrip.path[0]} icon={createStartIcon()}>
                              <Popup>
                                <div className="text-sm">
                                  <p className="font-bold text-violet-700">Trip #{selectedTrip.index} start</p>
                                  <p className="text-xs text-gray-600">{selectedTrip.startFence ?? "Open location"}</p>
                                  <p className="text-xs text-gray-500">{formatIST(selectedTrip.startTime)}</p>
                                </div>
                              </Popup>
                            </Marker>
                            <Marker
                              position={selectedTrip.path[selectedTrip.path.length - 1]}
                              icon={createEndIcon()}
                            >
                              <Popup>
                                <div className="text-sm">
                                  <p className="font-bold text-violet-700">Trip #{selectedTrip.index} end</p>
                                  <p className="text-xs text-gray-600">{selectedTrip.endFence ?? "Open location"}</p>
                                  <p className="text-xs text-gray-500">{formatIST(selectedTrip.endTime)}</p>
                                </div>
                              </Popup>
                            </Marker>
                          </>
                        )}
                        <Marker position={routePositions[0]} icon={createStartIcon()}>
                          <Popup>
                            <div className="text-sm">
                              <p className="font-bold text-emerald-600">Start Point</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {formatIST(routePoints[0].received_at)}
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
                                {formatIST(routePoints[routePoints.length - 1].received_at)}
                              </p>
                            </div>
                          </Popup>
                        </Marker>

                        {/* Halt markers */}
                        {halts.map((h, idx) => {
                          const highlighted = !!focus && focus.lat === h.lat && focus.lng === h.lng;
                          return (
                            <Marker
                              key={`halt-${idx}`}
                              position={[h.lat, h.lng]}
                              icon={createHaltIcon(highlighted)}
                            >
                              <Popup>
                                <div className="text-sm">
                                  <p className="font-bold text-amber-600">Halt #{idx + 1}</p>
                                  <p className="text-xs text-gray-600 mt-1">
                                    {h.durationMin} min stop
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {formatISTTime(h.startTime)} – {formatISTTime(h.endTime)}
                                  </p>
                                </div>
                              </Popup>
                            </Marker>
                          );
                        })}

                        {/* Timeline scrubber position */}
                        {scrubPoint && (
                          <Marker
                            position={[scrubPoint.latitude, scrubPoint.longitude]}
                            icon={createScrubIcon()}
                          >
                            <Popup>
                              <div className="text-sm">
                                <p className="font-bold text-violet-600">Position</p>
                                <p className="text-xs text-gray-600 mt-1">{scrubPoint.speed} km/h</p>
                                <p className="text-xs text-gray-500">
                                  {formatIST(scrubPoint.received_at)}
                                </p>
                              </div>
                            </Popup>
                          </Marker>
                        )}
                      </MapContainer>
                    </div>

                    {/* Draggable timeline (whole day, or the selected trip) */}
                    {timelinePoints.length > 1 && (
                      <Card className="bg-slate-50 border-slate-200">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {selectedTrip ? `Trip #${selectedTrip.index} timeline` : "Timeline"}
                            </span>
                            <span className="text-xs text-slate-600">
                              {scrubPoint ? formatIST(scrubPoint.received_at) : "—"} •{" "}
                              {scrubPoint?.speed ?? 0} km/h
                            </span>
                          </div>
                          <Slider
                            min={0}
                            max={timelinePoints.length - 1}
                            step={1}
                            value={[Math.min(scrubIndex, timelinePoints.length - 1)]}
                            onValueChange={(v) => setScrubIndex(v[0])}
                          />
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>{formatISTTime(timelinePoints[0].received_at)}</span>
                            <span>{formatISTTime(timelinePoints[timelinePoints.length - 1].received_at)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Trips (geofence-based) */}
                    <Card className="border-blue-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <RouteIcon className="h-4 w-4 text-blue-500" />
                          Trips ({trips.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {trips.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            No trips detected for this day{activeGeofences.length === 0 ? " (no geofences defined yet)" : ""}.
                          </p>
                        )}
                        {trips.map((t) => (
                          <button
                            key={t.index}
                            onClick={() =>
                              setSelectedTripIndex(selectedTripIndex === t.index ? null : t.index)
                            }
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              selectedTripIndex === t.index
                                ? "bg-violet-100 border-violet-300 ring-1 ring-violet-300"
                                : "bg-blue-50/50 border-blue-100 hover:bg-blue-50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-800">Trip #{t.index}</span>
                              <span className="text-sm font-bold text-blue-700">
                                {t.distanceKm} km
                                {t.status !== "complete" && (
                                  <span className="text-amber-600 font-normal"> • {t.status}</span>
                                )}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1">
                              <span className="font-medium">{t.startFence ?? "Open location"}</span>{" "}
                              {formatISTTime(t.startTime)} →{" "}
                              <span className="font-medium">{t.endFence ?? "Open location"}</span>{" "}
                              {formatISTTime(t.endTime)}
                            </p>
                          </button>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Suspicious / halt cards */}
                    <Card className="border-amber-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <OctagonPause className="h-4 w-4 text-amber-500" />
                          Vehicle Halts ({halts.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {halts.length === 0 && (
                          <p className="text-sm text-muted-foreground">No notable halts detected for this day.</p>
                        )}
                        {halts.map((h, idx) => {
                          const active = !!focus && focus.lat === h.lat && focus.lng === h.lng;
                          return (
                            <button
                              key={idx}
                              onClick={() => setFocus({ lat: h.lat, lng: h.lng, zoom: 16 })}
                              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                active
                                  ? "bg-amber-100 border-amber-300"
                                  : "bg-amber-50/50 border-amber-100 hover:bg-amber-50"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-amber-600" />
                                  <span className="font-semibold text-slate-800">Halt #{idx + 1}</span>
                                </div>
                                <span className="text-sm font-bold text-amber-700">{h.durationMin} min</span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1">
                                {formatIST(h.startTime)} → {formatISTTime(h.endTime)}
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {h.lat.toFixed(5)}, {h.lng.toFixed(5)} • tap to locate
                              </p>
                            </button>
                          );
                        })}
                      </CardContent>
                    </Card>
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
                  <Label htmlFor="pointTime">Select Date & Time (IST)</Label>
                  <Input
                    id="pointTime"
                    type="datetime-local"
                    value={pointInTime}
                    onChange={(e) => setPointInTime(e.target.value)}
                  />
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
                              {loc.latitude?.toFixed(6)}, {loc.longitude?.toFixed(6)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatIST(loc.received_at)}
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
                                  {formatIST(loc.received_at)}
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
