import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Expense, type ExpenseCategory, type PaymentMode } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Plus, Search, Trash2, Wallet, Fuel, Wrench, Users, Truck, FileText, Check, X } from "lucide-react";
import { toast } from "sonner";
import { istTodayString } from "@/lib/datetime";

const PAYMENT_MODES: PaymentMode[] = ["Cash", "UPI", "Bank Transfer"];
const TYPE_COLORS = ["#3b82f6", "#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#6366f1"];
const rupee = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const EMPTY_FORM = {
  expense_category: "vehicle" as ExpenseCategory,
  vehicle_id: "",
  vehicle_number: "",
  name: "",
  expense_type_id: "",
  quantity: "",
  amount: "",
  payment_mode: "" as PaymentMode | "",
  expense_date: istTodayString(),
  notes: "",
};

export default function Expenses() {
  const qc = useQueryClient();

  // Date period
  const [period, setPeriod] = useState<"monthly" | "all" | "custom">("monthly");
  const today = istTodayString();
  const [customFrom, setCustomFrom] = useState(`${today.slice(0, 7)}-01`);
  const [customTo, setCustomTo] = useState(today);
  const { from, to } = useMemo(() => {
    if (period === "all") return { from: undefined, to: undefined };
    if (period === "custom") return { from: customFrom, to: customTo };
    return { from: `${today.slice(0, 7)}-01`, to: today }; // monthly
  }, [period, customFrom, customTo, today]);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", from, to],
    queryFn: () => api.getExpenses({ from, to }),
  });
  const { data: types = [] } = useQuery({ queryKey: ["expense-types"], queryFn: api.getExpenseTypes });
  const { data: vehicles = [] } = useQuery({ queryKey: ["vehicles"], queryFn: api.getVehicles });

  // Filters
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterPayment, setFilterPayment] = useState("All");

  const filtered = useMemo(
    () =>
      expenses.filter((e) => {
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          (e.vehicle_number || "").toLowerCase().includes(q) ||
          (e.name || "").toLowerCase().includes(q) ||
          (e.notes || "").toLowerCase().includes(q);
        const matchType = filterType === "All" || e.expense_type === filterType;
        const matchPay = filterPayment === "All" || e.payment_mode === filterPayment;
        return matchSearch && matchType && matchPay;
      }),
    [expenses, search, filterType, filterPayment]
  );

  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);
  const totalBy = (typeName: string) =>
    filtered.filter((e) => e.expense_type === typeName).reduce((s, e) => s + Number(e.amount), 0);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => {
      const k = e.expense_type || "Others";
      map[k] = (map[k] || 0) + Number(e.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // Record dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const setF = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // Add-type inline (item 14)
  const [addingType, setAddingType] = useState(false);
  const [newType, setNewType] = useState("");

  const createTypeMutation = useMutation({
    mutationFn: (name: string) => api.createExpenseType(name),
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: ["expense-types"] });
      setF("expense_type_id", String(created.id));
      setAddingType(false);
      setNewType("");
      toast.success(`Added type "${created.name}"`);
    },
    onError: () => toast.error("Failed to add type"),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const vehicle = vehicles.find((v) => String(v.id) === form.vehicle_id);
      return api.createExpense({
        expense_category: form.expense_category,
        vehicle_id: form.expense_category === "vehicle" && form.vehicle_id ? Number(form.vehicle_id) : null,
        vehicle_number: form.expense_category === "vehicle" ? vehicle?.vehicle_number ?? form.vehicle_number : null,
        name: form.name || null,
        expense_type_id: form.expense_type_id ? Number(form.expense_type_id) : null,
        quantity: form.quantity ? Number(form.quantity) : null,
        amount: Number(form.amount),
        payment_mode: (form.payment_mode || null) as PaymentMode | null,
        expense_date: form.expense_date || null,
        notes: form.notes || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense recorded");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save expense"),
  });

  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteExpense(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense deleted");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Delete failed"),
  });

  const submit = () => {
    if (form.expense_category === "vehicle" && !form.vehicle_id && !form.vehicle_number) {
      toast.error("Vehicle is required");
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error("Amount is required");
      return;
    }
    if (!form.payment_mode) {
      toast.error("Payment mode is required");
      return;
    }
    createMutation.mutate();
  };

  const openDialog = () => {
    setForm({ ...EMPTY_FORM, expense_date: istTodayString() });
    setAddingType(false);
    setNewType("");
    setDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-rose-500 flex items-center justify-center shadow">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Expenses</h1>
            <p className="text-sm text-muted-foreground">Track all vehicle and other expenses (IST).</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v: "monthly" | "all" | "custom") => setPeriod(v)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openDialog} className="gap-2">
            <Plus className="h-4 w-4" /> Record Expense
          </Button>
        </div>
      </div>

      {period === "custom" && (
        <div className="flex items-end gap-3">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" max={today} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-44" />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" max={today} value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-44" />
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Expenses", value: total, sub: `${filtered.length} records`, icon: Wallet, color: "text-rose-500" },
          { label: "Fuel", value: totalBy("Fuel"), sub: "Fuel costs", icon: Fuel, color: "text-blue-500" },
          { label: "Maintenance / Repair", value: totalBy("Maintenance / Repair"), sub: "Repairs", icon: Wrench, color: "text-amber-500" },
          { label: "Driver Bata", value: totalBy("Driver Bata"), sub: "Allowances", icon: Users, color: "text-emerald-500" },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <c.icon className={`h-4 w-4 ${c.color}`} />
                <span className="text-xs text-muted-foreground">{c.label}</span>
              </div>
              <p className="text-xl font-bold">{rupee(c.value)}</p>
              <p className="text-xs text-muted-foreground">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category chart */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-semibold mb-4">Expense by Type</p>
          {categoryData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No expense data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip formatter={(v: number) => [rupee(v), "Amount"]} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {categoryData.map((e, i) => (
                    <Cell key={e.name} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-3 p-3 border-b flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vehicle, name, notes" className="pl-8 h-9" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Types</SelectItem>
                {types.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPayment} onValueChange={setFilterPayment}>
              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Payments</SelectItem>
                {PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="ml-auto text-sm font-bold tabular-nums">{rupee(total)}</div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Vehicle / Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qty (NOS)</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No expenses recorded</TableCell></TableRow>
              ) : (
                filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm tabular-nums">{fmtDate(e.expense_date)}</TableCell>
                    <TableCell>
                      <Badge variant={e.expense_category === "vehicle" ? "default" : "secondary"}>
                        {e.expense_category === "vehicle" ? "Vehicle" : "Others"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {e.expense_category === "vehicle" ? (
                          <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        {e.expense_category === "vehicle" ? e.vehicle_number || "—" : e.name || "—"}
                      </div>
                      {e.name && e.expense_category === "vehicle" && (
                        <span className="text-xs text-muted-foreground">{e.name}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{e.expense_type || "—"}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {e.quantity != null ? Number(e.quantity) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{rupee(Number(e.amount))}</TableCell>
                    <TableCell>
                      {e.payment_mode ? <Badge variant="outline">{e.payment_mode}</Badge> : "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(e)}>
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

      {/* Record dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Expense</DialogTitle>
            <DialogDescription>Fields marked * are required.</DialogDescription>
          </DialogHeader>

          {/* Category toggle */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            {(["vehicle", "others"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setF("expense_category", c)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition ${
                  form.expense_category === c ? "bg-background shadow" : "text-muted-foreground"
                }`}
              >
                {c === "vehicle" ? <Truck className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                {c === "vehicle" ? "Vehicle" : "Others"}
              </button>
            ))}
          </div>

          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {form.expense_category === "vehicle" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Vehicle *</Label>
                    <Select value={form.vehicle_id} onValueChange={(v) => setF("vehicle_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                      <SelectContent>
                        {vehicles.map((v) => (
                          <SelectItem key={v.id} value={String(v.id)}>{v.vehicle_number}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Driver Name</Label>
                    <Input value={form.name} onChange={(e) => setF("name", e.target.value)} placeholder="Driver name" />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setF("name", e.target.value)} placeholder="e.g. Office supplies" />
              </div>
            )}

            {/* Expense type + add-option (item 14) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Expense Type</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setAddingType((a) => !a)}
                >
                  <Plus className="h-3 w-3" /> Add type
                </Button>
              </div>
              {addingType ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    placeholder="New type name"
                    onKeyDown={(e) => e.key === "Enter" && newType.trim() && createTypeMutation.mutate(newType.trim())}
                  />
                  <Button
                    type="button"
                    size="icon"
                    disabled={!newType.trim() || createTypeMutation.isPending}
                    onClick={() => createTypeMutation.mutate(newType.trim())}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="outline" onClick={() => { setAddingType(false); setNewType(""); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Select value={form.expense_type_id} onValueChange={(v) => setF("expense_type_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {types.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Quantity NOS (item 15) */}
              <div className="space-y-1.5">
                <Label>Quantity (NOS)</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={form.quantity}
                  onChange={(e) => setF("quantity", e.target.value)}
                  placeholder="e.g. 4 (tyres)"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setF("amount", e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" max={today} value={form.expense_date} onChange={(e) => setF("expense_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Mode *</Label>
                <Select value={form.payment_mode} onValueChange={(v) => setF("payment_mode", v)}>
                  <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setF("notes", e.target.value)} placeholder="Optional notes" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={createMutation.isPending} className="gap-2">
              <Plus className="h-4 w-4" /> {createMutation.isPending ? "Saving…" : "Save Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  {rupee(Number(deleteTarget.amount))} ·{" "}
                  {deleteTarget.expense_category === "vehicle" ? deleteTarget.vehicle_number : deleteTarget.name} ·{" "}
                  {fmtDate(deleteTarget.expense_date)}. This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
