import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Geofence } from "@/lib/api";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MapContainer, TileLayer, Circle, Polygon, Marker, useMap, useMapEvents } from "react-leaflet";
import { Plus, Trash2, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { haversineMeters } from "@/lib/routeAnalysis";
import { detectVisits } from "@/lib/geofenceAnalysis";
import { istTodayString, istDayRange, addDays, formatIST, formatISTTime } from "@/lib/datetime";

// --- Draggable circle editor (item 10) ---
const centerHandleIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,.4)"></div>`,
  className: "gf-center-handle",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});
const radiusHandleIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;background:white;border:3px solid #2563eb;border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,.4);cursor:ew-resize"></div>`,
  className: "gf-radius-handle",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// Leaflet renders 0-size when mounted inside an animating dialog; force a resize after mount.
function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function ClickToSetCenter({ onSet }: { onSet: (c: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      onSet([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function CircleEditor({
  center,
  radius,
  onChange,
}: {
  center: [number, number] | null;
  radius: number;
  onChange: (center: [number, number], radius: number) => void;
}) {
  if (!center) {
    return <ClickToSetCenter onSet={(c) => onChange(c, radius)} />;
  }
  const [lat, lng] = center;
  const metersPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180) || 111320;
  const edge: [number, number] = [lat, lng + radius / metersPerDegLng];
  return (
    <>
      <ClickToSetCenter onSet={(c) => onChange(c, radius)} />
      <Circle center={center} radius={radius} pathOptions={{ color: "#2563eb", fillOpacity: 0.2 }} />
      <Marker
        position={center}
        icon={centerHandleIcon}
        draggable
        eventHandlers={{
          drag: (e) => {
            const m = (e.target as L.Marker).getLatLng();
            onChange([m.lat, m.lng], radius);
          },
        }}
      />
      <Marker
        position={edge}
        icon={radiusHandleIcon}
        draggable
        eventHandlers={{
          drag: (e) => {
            const m = (e.target as L.Marker).getLatLng();
            const r = Math.max(10, Math.round(haversineMeters(lat, lng, m.lat, m.lng)));
            onChange(center, r);
          },
        }}
      />
    </>
  );
}

function MapController({ selectedGeofence }: { selectedGeofence: Geofence | null }) {
  const map = useMap();

  useEffect(() => {
    if (selectedGeofence) {
      if (selectedGeofence.fence_type === "circle" && selectedGeofence.center_lat && selectedGeofence.center_lon) {
        map.flyTo([selectedGeofence.center_lat, selectedGeofence.center_lon], 14, {
          animate: true,
          duration: 1.5,
        });
      } else if (selectedGeofence.fence_type === "polygon" && selectedGeofence.geometry) {
        const positions = selectedGeofence.geometry.map((c) => [c[1], c[0]] as [number, number]);
        const bounds = positions.reduce(
          (acc, pos) => {
            acc.minLat = Math.min(acc.minLat, pos[0]);
            acc.maxLat = Math.max(acc.maxLat, pos[0]);
            acc.minLon = Math.min(acc.minLon, pos[1]);
            acc.maxLon = Math.max(acc.maxLon, pos[1]);
            return acc;
          },
          { minLat: Infinity, maxLat: -Infinity, minLon: Infinity, maxLon: -Infinity }
        );
        const center: [number, number] = [
          (bounds.minLat + bounds.maxLat) / 2,
          (bounds.minLon + bounds.maxLon) / 2,
        ];
        map.flyTo(center, 13, { animate: true, duration: 1.5 });
      }
    }
  }, [selectedGeofence, map]);

  return null;
}

export default function Geofences() {
  const queryClient = useQueryClient();
  const { data: geofences = [], isLoading } = useQuery({
    queryKey: ["geofences"],
    queryFn: () => api.getGeofences(),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [selectedGeofenceId, setSelectedGeofenceId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    fence_type: "circle" as "circle" | "polygon",
    center_lat: "",
    center_lon: "",
    radius_meters: "50",
  });

  const selectedGeofence = useMemo(
    () => geofences.find((g) => g.id === selectedGeofenceId) || null,
    [geofences, selectedGeofenceId]
  );

  // Calculate map center based on geofences
  const mapCenter: [number, number] = useMemo(() => {
    if (geofences.length === 0) return [20.5937, 78.9629];
    
    const validGeofences = geofences.filter(
      (g) => g.center_lat != null && g.center_lon != null
    );
    
    if (validGeofences.length === 0) return [20.5937, 78.9629];
    
    const avgLat = validGeofences.reduce((sum, g) => sum + g.center_lat!, 0) / validGeofences.length;
    const avgLon = validGeofences.reduce((sum, g) => sum + g.center_lon!, 0) / validGeofences.length;
    
    return [avgLat, avgLon];
  }, [geofences]);

  const mapZoom = geofences.length > 0 ? 10 : 5;

  // Initial center for the create-dialog editor map.
  const editorCenter: [number, number] =
    createForm.center_lat && createForm.center_lon
      ? [Number(createForm.center_lat), Number(createForm.center_lon)]
      : mapCenter;

  const createMutation = useMutation({
    mutationFn: () =>
      api.createGeofence({
        name: createForm.name,
        description: createForm.description,
        fence_type: createForm.fence_type,
        center_lat: Number(createForm.center_lat),
        center_lon: Number(createForm.center_lon),
        radius_meters: Number(createForm.radius_meters),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geofences"] });
      toast.success("Geofence created");
      setShowCreate(false);
      setCreateForm({ name: "", description: "", fence_type: "circle", center_lat: "", center_lon: "", radius_meters: "50" });
    },
    onError: () => toast.error("Failed to create geofence"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.updateGeofence(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["geofences"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteGeofence(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geofences"] });
      toast.success("Geofence deleted");
    },
  });

  // Geofence events
  const [eventsId, setEventsId] = useState<number | null>(null);
  const { data: events = [] } = useQuery({
    queryKey: ["geofence-events", eventsId],
    queryFn: () => api.getGeofenceEvents(eventsId!, { limit: 50 }),
    enabled: !!eventsId,
  });

  // Per-day geofence activity, computed on the frontend (item 9).
  const { data: vehicles = [] } = useQuery({ queryKey: ["vehicles"], queryFn: api.getVehicles });
  const [activityVehicle, setActivityVehicle] = useState<string>("");
  const [activityDate, setActivityDate] = useState<string>(istTodayString());
  const activityRange = useMemo(() => istDayRange(activityDate), [activityDate]);
  const { data: activityRoute = [] } = useQuery({
    queryKey: ["geofence-activity", activityVehicle, activityRange.fromUTC],
    // ±1h margin so a visit straddling midnight is captured. getVehicleRoute orders ascending.
    queryFn: () =>
      api.getVehicleRoute(
        Number(activityVehicle),
        new Date(new Date(activityRange.fromUTC).getTime() - 3600_000).toISOString(),
        new Date(new Date(activityRange.toUTC).getTime() + 3600_000).toISOString()
      ),
    enabled: !!activityVehicle && !!activityDate,
  });
  const activeGeofences = useMemo(() => geofences.filter((g) => g.is_active), [geofences]);
  const dayVisits = useMemo(
    () =>
      detectVisits(activityRoute as any[], activeGeofences).filter(
        (v) => istDayRange(activityDate).fromUTC <= v.enterTime && v.enterTime < istDayRange(activityDate).toUTC
      ),
    [activityRoute, activeGeofences, activityDate]
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Geofences</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Create Geofence
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map showing all geofences */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Geofence Map</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[400px] rounded-b-lg overflow-hidden relative z-0">
              <MapContainer 
                center={mapCenter} 
                zoom={mapZoom} 
                className="h-full w-full"
                key={`${mapCenter[0]}-${mapCenter[1]}`}
              >
                <MapController selectedGeofence={selectedGeofence} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {geofences.map((g) => {
                  const isSelected = g.id === selectedGeofenceId;
                  if (g.fence_type === "circle" && g.center_lat && g.center_lon && g.radius_meters) {
                    return (
                      <Circle
                        key={g.id}
                        center={[g.center_lat, g.center_lon]}
                        radius={g.radius_meters}
                        pathOptions={{
                          color: isSelected 
                            ? "#3b82f6" 
                            : g.is_active 
                            ? "hsl(174, 62%, 38%)" 
                            : "#9ca3af",
                          fillOpacity: isSelected ? 0.3 : 0.15,
                          weight: isSelected ? 3 : 2,
                        }}
                      />
                    );
                  }
                  if (g.fence_type === "polygon" && g.geometry) {
                    const positions = g.geometry.map((c) => [c[1], c[0]] as [number, number]);
                    return (
                      <Polygon
                        key={g.id}
                        positions={positions}
                        pathOptions={{
                          color: isSelected 
                            ? "#3b82f6" 
                            : g.is_active 
                            ? "hsl(174, 62%, 38%)" 
                            : "#9ca3af",
                          fillOpacity: isSelected ? 0.3 : 0.15,
                          weight: isSelected ? 3 : 2,
                        }}
                      />
                    );
                  }
                  return null;
                })}
              </MapContainer>
            </div>
          </CardContent>
        </Card>

        {/* Geofence list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Geofence List</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6">Loading...</TableCell></TableRow>
                ) : geofences.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No geofences</TableCell></TableRow>
                ) : (
                  geofences.map((g) => (
                    <TableRow 
                      key={g.id}
                      className={selectedGeofenceId === g.id ? "bg-muted" : ""}
                    >
                      <TableCell>
                        <button 
                          className="font-medium hover:underline flex items-center gap-2" 
                          onClick={() => {
                            setSelectedGeofenceId(g.id);
                            setEventsId(g.id);
                          }}
                        >
                          <MapPin className="h-3 w-3" />
                          {g.name}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{g.fence_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={g.is_active}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: g.id, is_active: checked })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(g.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Events */}
      {eventsId && events.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Events for {geofences.find((g) => g.id === eventsId)?.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.vehicle_number}</TableCell>
                    <TableCell>
                      <Badge variant={e.event_type === "inside" ? "default" : "secondary"}>
                        {e.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{e.latitude.toFixed(4)}, {e.longitude.toFixed(4)}</TableCell>
                    <TableCell className="text-xs">{formatIST(e.timestamp)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Per-day geofence activity (computed on the frontend) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Per-Day Geofence Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <Label>Vehicle</Label>
              <Select value={activityVehicle} onValueChange={setActivityVehicle}>
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
            <div className="flex gap-2">
              <Button
                variant={activityDate === istTodayString() ? "default" : "outline"}
                onClick={() => setActivityDate(istTodayString())}
              >
                Today
              </Button>
              <Button
                variant={activityDate === addDays(istTodayString(), -1) ? "default" : "outline"}
                onClick={() => setActivityDate(addDays(istTodayString(), -1))}
              >
                Yesterday
              </Button>
            </div>
            <div>
              <Label htmlFor="actDate">Date</Label>
              <Input
                id="actDate"
                type="date"
                max={istTodayString()}
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                className="w-44"
              />
            </div>
          </div>

          {activityVehicle && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Geofence</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Exit</TableHead>
                  <TableHead className="text-right">Dwell</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayVisits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                      {activeGeofences.length === 0
                        ? "No active geofences defined"
                        : "No geofence visits for this day"}
                    </TableCell>
                  </TableRow>
                ) : (
                  dayVisits.map((v, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{v.geofenceName}</TableCell>
                      <TableCell className="text-xs">{formatISTTime(v.enterTime)}</TableCell>
                      <TableCell className="text-xs">{formatISTTime(v.exitTime)}</TableCell>
                      <TableCell className="text-right text-xs font-semibold">{v.durationMin} min</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md z-[10000]">
          <DialogHeader>
            <DialogTitle>Create Geofence</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input 
                id="name"
                placeholder="Enter geofence name"
                value={createForm.name} 
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input 
                id="description"
                placeholder="Enter description"
                value={createForm.description} 
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label>Location & Radius</Label>
              <p className="text-xs text-muted-foreground">
                Tap the map to place the circle, drag the blue center to move it, and drag the small
                edge handle to resize.
              </p>
              <div className="h-64 rounded-lg overflow-hidden border relative z-0">
                <MapContainer
                  center={editorCenter}
                  zoom={createForm.center_lat ? 15 : 11}
                  className="h-full w-full"
                >
                  <InvalidateOnMount />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <CircleEditor
                    center={
                      createForm.center_lat && createForm.center_lon
                        ? [Number(createForm.center_lat), Number(createForm.center_lon)]
                        : null
                    }
                    radius={Number(createForm.radius_meters) || 50}
                    onChange={(c, r) =>
                      setCreateForm((f) => ({
                        ...f,
                        center_lat: String(c[0]),
                        center_lon: String(c[1]),
                        radius_meters: String(r),
                      }))
                    }
                  />
                </MapContainer>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {createForm.center_lat
                    ? `${Number(createForm.center_lat).toFixed(5)}, ${Number(createForm.center_lon).toFixed(5)}`
                    : "No center set"}
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="radius" className="text-xs whitespace-nowrap">Radius (m)</Label>
                  <Input
                    id="radius"
                    type="number"
                    className="w-24"
                    value={createForm.radius_meters}
                    onChange={(e) => setCreateForm({ ...createForm, radius_meters: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createMutation.mutate()} 
              disabled={createMutation.isPending || !createForm.name || !createForm.center_lat || !createForm.center_lon}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
