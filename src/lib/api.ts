const BASE_URL = "https://server.aarovbuildmart.in/api/gps";

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

// Vehicle types
export interface Vehicle {
  id: number;
  imei: string;
  vehicle_number: string;
  vehicle_type: string;
  driver_name: string;
  driver_phone: string;
  fuel_tank_capacity: number;
  wheels_count: number | null;
  emi_per_month: number | string | null;
  emi_end_date: string | null;
  insurance_due_date: string | null;
  insurance_amount: number | string | null;
  road_tax_due_date: string | null;
  road_tax_amount: number | string | null;
  is_active: boolean;
  last_lat: number;
  last_lon: number;
  last_speed: number;
  last_seen: string;
}

export interface VehiclePayload {
  imei: string;
  vehicle_number: string;
  vehicle_type?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  fuel_tank_capacity?: number | null;
  wheels_count?: number | null;
  emi_per_month?: number | null;
  emi_end_date?: string | null;
  insurance_due_date?: string | null;
  insurance_amount?: number | null;
  road_tax_due_date?: string | null;
  road_tax_amount?: number | null;
  is_active?: boolean;
}

export interface LiveLocation {
  vehicleId: number;
  vehicleNumber: string;
  imei: string;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  satellites: number;
  timestamp: string;
  receivedAt: string;
}

export interface FuelLive {
  vehicle_id: number;
  vehicle_number: string;
  imei: string;
  fuel_tank_capacity: number;
  fuel_level: number;
  voltage: number;
  raw_value: number;
  received_at: string;
}

export interface FuelConsumption {
  min_fuel: number;
  max_fuel: number;
  avg_fuel: number;
  fuel_consumed: number;
  data_points: number;
}

export interface Geofence {
  id: number;
  name: string;
  description: string;
  fence_type: "circle" | "polygon";
  center_lat: number | null;
  center_lon: number | null;
  radius_meters: number | null;
  geometry: number[][] | null;
  is_active: boolean;
  created_at: string;
}

export interface GeofenceEvent {
  id: number;
  vehicle_id: number;
  vehicle_number: string;
  event_type: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface GeofenceStat {
  vehicle_id: number;
  vehicle_number: string;
  total_events: number;
  entries: number;
  exits: number;
  first_event: string;
  last_event: string;
}

export interface DashboardOverview {
  total_vehicles: number;
  active_vehicles: number;
  vehicles_tracked_today: number;
  active_geofences: number;
}

export interface VehicleActivity {
  id: number;
  vehicle_number: string;
  data_points: number;
  avg_speed: number;
  max_speed: number;
  first_seen: string;
  last_seen: string;
}

export interface DistanceResult {
  vehicle_id: string;
  from: string;
  to: string;
  distance_km: string;
}

export interface HourlyStat {
  hour: string;
  data_points: number;
  avg_speed: number;
  max_speed: number;
  min_satellites: number;
  avg_satellites: number;
}

export interface GeofenceSummary {
  geofence_id: number;
  geofence_name: string;
  unique_vehicles: number;
  total_events: number;
  entries: number;
  exits: number;
}

export interface SpeedViolation {
  vehicle_id: number;
  vehicle_number: string;
  speed: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  received_at: string;
}

// Expenses
export interface ExpenseType {
  id: number;
  name: string;
  is_active: boolean;
}

export type ExpenseCategory = "vehicle" | "others";
export type PaymentMode = "Cash" | "UPI" | "Bank Transfer";

export interface Expense {
  id: number;
  expense_category: ExpenseCategory;
  vehicle_id: number | null;
  vehicle_number: string | null;
  name: string | null;
  expense_type_id: number | null;
  expense_type: string | null;
  quantity: number | string | null;
  amount: number | string;
  payment_mode: PaymentMode | null;
  expense_date: string;
  notes: string | null;
  created_at: string;
}

export interface ExpensePayload {
  expense_category: ExpenseCategory;
  vehicle_id?: number | null;
  vehicle_number?: string | null;
  name?: string | null;
  expense_type_id?: number | null;
  quantity?: number | null;
  amount: number;
  payment_mode?: PaymentMode | null;
  expense_date?: string | null;
  notes?: string | null;
}

// API functions
export const api = {
  // Vehicles
  getVehicles: () => apiFetch<Vehicle[]>("/vehicles"),
  getVehicle: (id: number) => apiFetch<Vehicle>(`/vehicles/${id}`),
  createVehicle: (data: VehiclePayload) =>
    apiFetch<Vehicle>("/vehicles", { method: "POST", body: JSON.stringify(data) }),
  updateVehicle: (id: number, data: Partial<VehiclePayload>) =>
    apiFetch<Vehicle>(`/vehicles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateVehicleImei: (id: number, imei: string) =>
    apiFetch<Vehicle>(`/vehicles/${id}/imei`, { method: "PUT", body: JSON.stringify({ imei }) }),
  deleteVehicle: (id: number) =>
    apiFetch<void>(`/vehicles/${id}`, { method: "DELETE" }),

  // Locations
  getLiveLocations: () => apiFetch<LiveLocation[]>("/locations/live"),
  getLocationsAtTime: (timestamp: string, vehicleId?: number) => {
    const params = new URLSearchParams({ timestamp });
    if (vehicleId) params.set("vehicle_id", String(vehicleId));
    return apiFetch<any[]>(`/locations/at-time?${params}`);
  },
  getLocationHistory: (vehicleId: number, from?: string, to?: string, limit = 1000) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return apiFetch<any[]>(`/locations/history/${vehicleId}?${params}`);
  },
  getVehicleRoute: (vehicleId: number, from: string, to: string) =>
    apiFetch<any[]>(`/locations/route/${vehicleId}?from=${from}&to=${to}`),

  // Fuel
  getLiveFuel: () => apiFetch<FuelLive[]>("/fuel/live"),
  getFuelHistory: (vehicleId: number, from?: string, to?: string, limit = 1000) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return apiFetch<any[]>(`/fuel/history/${vehicleId}?${params}`);
  },
  getFuelConsumption: (vehicleId: number, from: string, to: string) =>
    apiFetch<FuelConsumption>(`/fuel/consumption/${vehicleId}?from=${from}&to=${to}`),

  // Geofences
  getGeofences: (activeOnly = false) =>
    apiFetch<Geofence[]>(`/geofences${activeOnly ? "?active_only=true" : ""}`),
  getGeofence: (id: number) => apiFetch<Geofence>(`/geofences/${id}`),
  createGeofence: (data: Partial<Geofence> & { polygon_coords?: number[][] }) =>
    apiFetch<Geofence>("/geofences", { method: "POST", body: JSON.stringify(data) }),
  updateGeofence: (id: number, data: Partial<Geofence>) =>
    apiFetch<Geofence>(`/geofences/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteGeofence: (id: number) =>
    apiFetch<void>(`/geofences/${id}`, { method: "DELETE" }),
  getGeofenceEvents: (id: number, params?: { from?: string; to?: string; vehicle_id?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    if (params?.vehicle_id) sp.set("vehicle_id", String(params.vehicle_id));
    if (params?.limit) sp.set("limit", String(params.limit));
    return apiFetch<GeofenceEvent[]>(`/geofences/${id}/events?${sp}`);
  },
  getGeofenceStats: (id: number, from?: string, to?: string) => {
    const sp = new URLSearchParams();
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    return apiFetch<GeofenceStat[]>(`/geofences/${id}/stats?${sp}`);
  },

  // Analytics
  getDashboard: () => apiFetch<DashboardOverview>("/analytics/dashboard"),
  getVehicleActivity: (from: string, to: string) =>
    apiFetch<VehicleActivity[]>(`/analytics/vehicle-activity?from=${from}&to=${to}`),
  getDistance: (vehicleId: number, from: string, to: string) =>
    apiFetch<DistanceResult>(`/analytics/distance/${vehicleId}?from=${from}&to=${to}`),
  getHourlyStats: (vehicleId: number, from: string, to: string) =>
    apiFetch<HourlyStat[]>(`/analytics/hourly/${vehicleId}?from=${from}&to=${to}`),
  getGeofenceSummary: (from: string, to: string) =>
    apiFetch<GeofenceSummary[]>(`/analytics/geofence-summary?from=${from}&to=${to}`),
  getSpeedViolations: (params?: { speed_limit?: number; from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.speed_limit) sp.set("speed_limit", String(params.speed_limit));
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    return apiFetch<SpeedViolation[]>(`/analytics/speed-violations?${sp}`);
  },

  // Expenses
  getExpenseTypes: () => apiFetch<ExpenseType[]>("/expenses/types?active_only=true"),
  createExpenseType: (name: string) =>
    apiFetch<ExpenseType>("/expenses/types", { method: "POST", body: JSON.stringify({ name }) }),
  getExpenses: (params?: { from?: string; to?: string; vehicle_id?: number; type_id?: number }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    if (params?.vehicle_id) sp.set("vehicle_id", String(params.vehicle_id));
    if (params?.type_id) sp.set("type_id", String(params.type_id));
    return apiFetch<Expense[]>(`/expenses?${sp}`);
  },
  createExpense: (data: ExpensePayload) =>
    apiFetch<{ id: number }>("/expenses", { method: "POST", body: JSON.stringify(data) }),
  deleteExpense: (id: number) =>
    apiFetch<void>(`/expenses/${id}`, { method: "DELETE" }),
};
