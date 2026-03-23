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
import { MapContainer, TileLayer, Circle, Polygon, useMap } from "react-leaflet";
import { Plus, Trash2, Edit2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";

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
    radius_meters: "500",
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
      setCreateForm({ name: "", description: "", fence_type: "circle", center_lat: "", center_lon: "", radius_meters: "500" });
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
                    <TableCell className="text-xs">{new Date(e.timestamp).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="lat">Center Latitude</Label>
                <Input 
                  id="lat"
                  type="number" 
                  step="any"
                  placeholder="e.g. 20.5937"
                  value={createForm.center_lat} 
                  onChange={(e) => setCreateForm({ ...createForm, center_lat: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lon">Center Longitude</Label>
                <Input 
                  id="lon"
                  type="number" 
                  step="any"
                  placeholder="e.g. 78.9629"
                  value={createForm.center_lon} 
                  onChange={(e) => setCreateForm({ ...createForm, center_lon: e.target.value })} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="radius">Radius (meters)</Label>
              <Input 
                id="radius"
                type="number"
                placeholder="500"
                value={createForm.radius_meters} 
                onChange={(e) => setCreateForm({ ...createForm, radius_meters: e.target.value })} 
              />
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
