import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from "react-leaflet";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const vehicleId = Number(id);

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ["vehicle", vehicleId],
    queryFn: () => api.getVehicle(vehicleId),
    enabled: !!vehicleId,
  });

  const [form, setForm] = useState({
    vehicle_number: "",
    vehicle_type: "",
    driver_name: "",
    driver_phone: "",
    fuel_tank_capacity: 0,
    imei: "",
  });
  const [formInit, setFormInit] = useState(false);

  if (vehicle && !formInit) {
    setForm({
      vehicle_number: vehicle.vehicle_number,
      vehicle_type: vehicle.vehicle_type,
      driver_name: vehicle.driver_name,
      driver_phone: vehicle.driver_phone,
      fuel_tank_capacity: vehicle.fuel_tank_capacity,
      imei: vehicle.imei,
    });
    setFormInit(true);
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateVehicle(vehicleId, {
        vehicle_number: form.vehicle_number,
        vehicle_type: form.vehicle_type,
        driver_name: form.driver_name,
        driver_phone: form.driver_phone,
        fuel_tank_capacity: form.fuel_tank_capacity,
        is_active: vehicle?.is_active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
      toast.success("Vehicle updated");
    },
    onError: () => toast.error("Update failed"),
  });

  const imeiMutation = useMutation({
    mutationFn: () => api.updateVehicleImei(vehicleId, form.imei),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
      toast.success("IMEI updated");
    },
    onError: () => toast.error("IMEI update failed"),
  });

  // Route history
  const [routeFrom, setRouteFrom] = useState("");
  const [routeTo, setRouteTo] = useState("");
  const { data: route = [] } = useQuery({
    queryKey: ["route", vehicleId, routeFrom, routeTo],
    queryFn: () => api.getVehicleRoute(vehicleId, routeFrom, routeTo),
    enabled: !!routeFrom && !!routeTo,
  });

  const routePositions = route
    .filter((p: any) => p.latitude && p.longitude)
    .map((p: any) => [p.latitude, p.longitude] as [number, number]);

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (!vehicle) return <div className="p-6">Vehicle not found</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/vehicles")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{vehicle.vehicle_number}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Edit form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vehicle Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vehicle Number</Label>
                <Input value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} />
              </div>
              <div>
                <Label>Type</Label>
                <Input value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} />
              </div>
              <div>
                <Label>Driver Name</Label>
                <Input value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} />
              </div>
              <div>
                <Label>Driver Phone</Label>
                <Input value={form.driver_phone} onChange={(e) => setForm({ ...form, driver_phone: e.target.value })} />
              </div>
              <div>
                <Label>Fuel Tank Capacity (L)</Label>
                <Input type="number" value={form.fuel_tank_capacity} onChange={(e) => setForm({ ...form, fuel_tank_capacity: Number(e.target.value) })} />
              </div>
            </div>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 mr-1" /> Save Changes
            </Button>

            <div className="pt-4 border-t">
              <Label>IMEI</Label>
              <div className="flex gap-2 mt-1">
                <Input value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} className="font-mono" />
                <Button variant="secondary" onClick={() => imeiMutation.mutate()} disabled={imeiMutation.isPending}>
                  Update IMEI
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Route history */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Route History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>From</Label>
                <Input type="datetime-local" value={routeFrom} onChange={(e) => setRouteFrom(e.target.value)} />
              </div>
              <div>
                <Label>To</Label>
                <Input type="datetime-local" value={routeTo} onChange={(e) => setRouteTo(e.target.value)} />
              </div>
            </div>
            <div className="h-[300px] rounded-lg overflow-hidden border">
              <MapContainer
                center={
                  routePositions.length > 0
                    ? routePositions[0]
                    : [vehicle.last_lat || 20.5937, vehicle.last_lon || 78.9629]
                }
                zoom={routePositions.length > 0 ? 13 : 5}
                className="h-full w-full"
                key={`${routeFrom}-${routeTo}`}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {routePositions.length > 0 && (
                  <>
                    <Polyline positions={routePositions} pathOptions={{ color: "hsl(174, 62%, 38%)", weight: 3 }} />
                    <CircleMarker center={routePositions[0]} radius={6} pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 1 }}>
                      <Popup>Start</Popup>
                    </CircleMarker>
                    <CircleMarker center={routePositions[routePositions.length - 1]} radius={6} pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 1 }}>
                      <Popup>End</Popup>
                    </CircleMarker>
                  </>
                )}
              </MapContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
