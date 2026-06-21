import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from "react-leaflet";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";
import { format, isValid, parseISO } from "date-fns";

type VehicleDetailForm = {
  vehicle_number: string;
  vehicle_type: string;
  driver_name: string;
  driver_phone: string;
  fuel_tank_capacity: string;
  wheels_count: string;
  emi_per_month: string;
  emi_end_date: string;
  insurance_due_date: string;
  insurance_amount: string;
  road_tax_due_date: string;
  road_tax_amount: string;
  imei: string;
  is_active: boolean;
};

const EMPTY_FORM: VehicleDetailForm = {
  vehicle_number: "",
  vehicle_type: "",
  driver_name: "",
  driver_phone: "",
  fuel_tank_capacity: "",
  wheels_count: "",
  emi_per_month: "",
  emi_end_date: "",
  insurance_due_date: "",
  insurance_amount: "",
  road_tax_due_date: "",
  road_tax_amount: "",
  imei: "",
  is_active: true,
};

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toInputValue(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function getDueMeta(dateValue: string | null, label: string) {
  if (!dateValue) {
    return {
      label,
      dateText: "Not set",
      statusText: "No due date",
      className: "border-transparent bg-muted text-muted-foreground",
    };
  }

  const parsed = parseISO(dateValue);
  if (!isValid(parsed)) {
    return {
      label,
      dateText: "Invalid date",
      statusText: "Check value",
      className: "border-transparent bg-muted text-muted-foreground",
    };
  }

  const today = new Date();
  const currentDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.ceil((dueDay.getTime() - currentDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label,
      dateText: format(parsed, "dd MMM yyyy"),
      statusText: "Overdue",
      className: "border-transparent bg-red-100 text-red-700",
    };
  }

  if (diffDays <= 7) {
    return {
      label,
      dateText: format(parsed, "dd MMM yyyy"),
      statusText: `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
      className: "border-transparent bg-orange-100 text-orange-700",
    };
  }

  if (diffDays <= 30) {
    return {
      label,
      dateText: format(parsed, "dd MMM yyyy"),
      statusText: `Due in ${diffDays} days`,
      className: "border-transparent bg-amber-100 text-amber-800",
    };
  }

  return {
    label,
    dateText: format(parsed, "dd MMM yyyy"),
    statusText: `Due in ${diffDays} days`,
    className: "border-transparent bg-emerald-100 text-emerald-700",
  };
}

function formatCurrency(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "NA";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return "NA";
  return `Rs. ${parsed.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

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

  const [form, setForm] = useState<VehicleDetailForm>(EMPTY_FORM);

  useEffect(() => {
    if (!vehicle) return;

    setForm({
      vehicle_number: vehicle.vehicle_number ?? "",
      vehicle_type: vehicle.vehicle_type ?? "",
      driver_name: vehicle.driver_name ?? "",
      driver_phone: vehicle.driver_phone ?? "",
      fuel_tank_capacity: toInputValue(vehicle.fuel_tank_capacity),
      wheels_count: toInputValue(vehicle.wheels_count),
      emi_per_month: toInputValue(vehicle.emi_per_month),
      emi_end_date: vehicle.emi_end_date ?? "",
      insurance_due_date: vehicle.insurance_due_date ?? "",
      insurance_amount: toInputValue(vehicle.insurance_amount),
      road_tax_due_date: vehicle.road_tax_due_date ?? "",
      road_tax_amount: toInputValue(vehicle.road_tax_amount),
      imei: vehicle.imei ?? "",
      is_active: vehicle.is_active,
    });
  }, [vehicle]);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateVehicle(vehicleId, {
        vehicle_number: form.vehicle_number.trim(),
        vehicle_type: form.vehicle_type.trim() || null,
        driver_name: form.driver_name.trim() || null,
        driver_phone: form.driver_phone.trim() || null,
        fuel_tank_capacity: parseOptionalNumber(form.fuel_tank_capacity),
        wheels_count: parseOptionalNumber(form.wheels_count),
        emi_per_month: parseOptionalNumber(form.emi_per_month),
        emi_end_date: form.emi_end_date || null,
        insurance_due_date: form.insurance_due_date || null,
        insurance_amount: parseOptionalNumber(form.insurance_amount),
        road_tax_due_date: form.road_tax_due_date || null,
        road_tax_amount: parseOptionalNumber(form.road_tax_amount),
        is_active: form.is_active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Vehicle updated");
    },
    onError: () => toast.error("Update failed"),
  });

  const imeiMutation = useMutation({
    mutationFn: () => api.updateVehicleImei(vehicleId, form.imei),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
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

  const dueItems = useMemo(
    () => [
      {
        ...getDueMeta(vehicle?.insurance_due_date ?? null, "Insurance"),
        amount: formatCurrency(vehicle?.insurance_amount),
      },
      {
        ...getDueMeta(vehicle?.road_tax_due_date ?? null, "Road Tax"),
        amount: formatCurrency(vehicle?.road_tax_amount),
      },
      {
        ...getDueMeta(vehicle?.emi_end_date ?? null, "EMI End"),
        amount: `${formatCurrency(vehicle?.emi_per_month)}/mo`,
      },
    ],
    [vehicle],
  );

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

      <div className="grid gap-4 md:grid-cols-3">
        {dueItems.map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{item.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Badge className={item.className}>{item.statusText}</Badge>
              <div className="text-sm text-muted-foreground">{item.dateText}</div>
              <div className="font-medium">{item.amount}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Edit form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vehicle Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                <Input type="number" value={form.fuel_tank_capacity} onChange={(e) => setForm({ ...form, fuel_tank_capacity: e.target.value })} />
              </div>
              <div>
                <Label>Wheels Count</Label>
                <Input type="number" value={form.wheels_count} onChange={(e) => setForm({ ...form, wheels_count: e.target.value })} />
              </div>
              <div>
                <Label>EMI Per Month</Label>
                <Input type="number" step="0.01" value={form.emi_per_month} onChange={(e) => setForm({ ...form, emi_per_month: e.target.value })} />
              </div>
              <div>
                <Label>EMI End Date</Label>
                <Input type="date" value={form.emi_end_date} onChange={(e) => setForm({ ...form, emi_end_date: e.target.value })} />
              </div>
              <div>
                <Label>Insurance Amount</Label>
                <Input type="number" step="0.01" value={form.insurance_amount} onChange={(e) => setForm({ ...form, insurance_amount: e.target.value })} />
              </div>
              <div>
                <Label>Insurance Due Date</Label>
                <Input type="date" value={form.insurance_due_date} onChange={(e) => setForm({ ...form, insurance_due_date: e.target.value })} />
              </div>
              <div>
                <Label>Road Tax Amount</Label>
                <Input type="number" step="0.01" value={form.road_tax_amount} onChange={(e) => setForm({ ...form, road_tax_amount: e.target.value })} />
              </div>
              <div>
                <Label>Road Tax Due Date</Label>
                <Input type="date" value={form.road_tax_due_date} onChange={(e) => setForm({ ...form, road_tax_due_date: e.target.value })} />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input
                  id="vehicle-active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="vehicle-active">Active</Label>
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
