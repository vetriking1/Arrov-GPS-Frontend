import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type VehiclePayload } from "@/lib/api";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Eye, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format, isValid, parseISO } from "date-fns";

type VehicleFormState = {
  imei: string;
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
};

const EMPTY_FORM: VehicleFormState = {
  imei: "",
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
};

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildVehiclePayload(form: VehicleFormState): VehiclePayload {
  return {
    imei: form.imei.trim(),
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
    is_active: true,
  };
}

function getDateMeta(dateValue: string | null, label: string) {
  if (!dateValue) {
    return {
      text: `${label}: Not set`,
      className: "border-transparent bg-muted text-muted-foreground",
    };
  }

  const parsed = parseISO(dateValue);
  if (!isValid(parsed)) {
    return {
      text: `${label}: Invalid`,
      className: "border-transparent bg-muted text-muted-foreground",
    };
  }

  const today = new Date();
  const currentDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.ceil((dueDay.getTime() - currentDay.getTime()) / (1000 * 60 * 60 * 24));
  const formattedDate = format(parsed, "dd MMM yyyy");

  if (diffDays < 0) {
    return {
      text: `${label}: Overdue (${formattedDate})`,
      className: "border-transparent bg-red-100 text-red-700",
    };
  }

  if (diffDays <= 7) {
    return {
      text: `${label}: ${formattedDate}`,
      className: "border-transparent bg-orange-100 text-orange-700",
    };
  }

  if (diffDays <= 30) {
    return {
      text: `${label}: ${formattedDate}`,
      className: "border-transparent bg-amber-100 text-amber-800",
    };
  }

  return {
    text: `${label}: ${formattedDate}`,
    className: "border-transparent bg-emerald-100 text-emerald-700",
  };
}

function formatCurrency(value: number | string | null) {
  if (value === null || value === undefined || value === "") return "NA";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return "NA";
  return `Rs. ${parsed.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function Vehicles() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<VehicleFormState>(EMPTY_FORM);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: api.getVehicles,
  });

  const createMutation = useMutation({
    mutationFn: () => api.createVehicle(buildVehiclePayload(createForm)),
    onSuccess: (vehicle) => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Vehicle created");
      setIsCreateOpen(false);
      setCreateForm(EMPTY_FORM);
      navigate(`/vehicles/${vehicle.id}`);
    },
    onError: () => toast.error("Failed to create vehicle"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteVehicle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Vehicle deleted");
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete vehicle"),
  });

  const filtered = useMemo(
    () =>
      vehicles.filter((vehicle) => {
        const lookup = search.toLowerCase();
        return (
          vehicle.vehicle_number?.toLowerCase().includes(lookup) ||
          vehicle.driver_name?.toLowerCase().includes(lookup) ||
          vehicle.imei?.toLowerCase().includes(lookup)
        );
      }),
    [search, vehicles],
  );

  const updateCreateForm = (key: keyof VehicleFormState, value: string) => {
    setCreateForm((current) => ({ ...current, [key]: value }));
  };

  const canCreate = createForm.imei.trim() && createForm.vehicle_number.trim();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vehicles</h1>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Vehicle
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">All Vehicles</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Wheels</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>IMEI</TableHead>
                <TableHead>Dues</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No vehicles found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.vehicle_number}</TableCell>
                    <TableCell>{v.vehicle_type}</TableCell>
                    <TableCell>{v.driver_name}</TableCell>
                    <TableCell>{v.wheels_count ?? "NA"}</TableCell>
                    <TableCell>{v.driver_phone}</TableCell>
                    <TableCell className="font-mono text-xs">{v.imei}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 py-2">
                        <Badge className={getDateMeta(v.insurance_due_date, "Insurance").className}>
                          {getDateMeta(v.insurance_due_date, "Insurance").text} | {formatCurrency(v.insurance_amount)}
                        </Badge>
                        <Badge className={getDateMeta(v.road_tax_due_date, "Road Tax").className}>
                          {getDateMeta(v.road_tax_due_date, "Road Tax").text} | {formatCurrency(v.road_tax_amount)}
                        </Badge>
                        <Badge className={getDateMeta(v.emi_end_date, "EMI End").className}>
                          {getDateMeta(v.emi_end_date, "EMI End").text} | {formatCurrency(v.emi_per_month)}/mo
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={v.is_active ? "default" : "secondary"}>
                        {v.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {v.last_seen
                        ? new Date(v.last_seen).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/vehicles/${v.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(v.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add Vehicle</DialogTitle>
            <DialogDescription>Create a vehicle with finance, insurance, and tax details.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Vehicle Number</Label>
              <Input value={createForm.vehicle_number} onChange={(e) => updateCreateForm("vehicle_number", e.target.value)} />
            </div>
            <div>
              <Label>IMEI</Label>
              <Input value={createForm.imei} onChange={(e) => updateCreateForm("imei", e.target.value)} />
            </div>
            <div>
              <Label>Vehicle Type</Label>
              <Input value={createForm.vehicle_type} onChange={(e) => updateCreateForm("vehicle_type", e.target.value)} />
            </div>
            <div>
              <Label>Driver Name</Label>
              <Input value={createForm.driver_name} onChange={(e) => updateCreateForm("driver_name", e.target.value)} />
            </div>
            <div>
              <Label>Driver Phone</Label>
              <Input value={createForm.driver_phone} onChange={(e) => updateCreateForm("driver_phone", e.target.value)} />
            </div>
            <div>
              <Label>Fuel Tank Capacity (L)</Label>
              <Input type="number" value={createForm.fuel_tank_capacity} onChange={(e) => updateCreateForm("fuel_tank_capacity", e.target.value)} />
            </div>
            <div>
              <Label>Wheels Count</Label>
              <Input type="number" value={createForm.wheels_count} onChange={(e) => updateCreateForm("wheels_count", e.target.value)} />
            </div>
            <div>
              <Label>EMI Per Month</Label>
              <Input type="number" step="0.01" value={createForm.emi_per_month} onChange={(e) => updateCreateForm("emi_per_month", e.target.value)} />
            </div>
            <div>
              <Label>EMI End Date</Label>
              <Input type="date" value={createForm.emi_end_date} onChange={(e) => updateCreateForm("emi_end_date", e.target.value)} />
            </div>
            <div>
              <Label>Insurance Amount</Label>
              <Input type="number" step="0.01" value={createForm.insurance_amount} onChange={(e) => updateCreateForm("insurance_amount", e.target.value)} />
            </div>
            <div>
              <Label>Insurance Due Date</Label>
              <Input type="date" value={createForm.insurance_due_date} onChange={(e) => updateCreateForm("insurance_due_date", e.target.value)} />
            </div>
            <div>
              <Label>Road Tax Amount</Label>
              <Input type="number" step="0.01" value={createForm.road_tax_amount} onChange={(e) => updateCreateForm("road_tax_amount", e.target.value)} />
            </div>
            <div>
              <Label>Road Tax Due Date</Label>
              <Input type="date" value={createForm.road_tax_due_date} onChange={(e) => updateCreateForm("road_tax_due_date", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={!canCreate || createMutation.isPending}>
              Create Vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
