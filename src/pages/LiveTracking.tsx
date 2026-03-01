import { useState, useMemo } from "react";
import { useWSData } from "@/components/AppLayout";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Truck } from "lucide-react";
import "leaflet/dist/leaflet.css";

export default function LiveTracking() {
  const { vehicleLocations, vehicleStatuses, fuelUpdates } = useWSData();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const locations = useMemo(
    () => Object.values(vehicleLocations),
    [vehicleLocations]
  );

  const filtered = useMemo(
    () =>
      locations.filter((l) =>
        l.vehicleNumber.toLowerCase().includes(search.toLowerCase())
      ),
    [locations, search]
  );

  const center: [number, number] = useMemo(() => {
    if (selectedId && vehicleLocations[selectedId]) {
      const v = vehicleLocations[selectedId];
      return [v.latitude, v.longitude];
    }
    if (locations.length > 0) {
      return [
        locations.reduce((s, l) => s + l.latitude, 0) / locations.length,
        locations.reduce((s, l) => s + l.longitude, 0) / locations.length,
      ];
    }
    return [20.5937, 78.9629];
  }, [locations, selectedId, vehicleLocations]);

  const getColor = (loc: (typeof locations)[0]) => {
    if (loc.speed > 0) return "#10b981";
    const status = vehicleStatuses[loc.vehicleId]?.status;
    return status === "online" ? "#f59e0b" : "#ef4444";
  };

  const getStatusLabel = (loc: (typeof locations)[0]) => {
    if (loc.speed > 0) return "Moving";
    const status = vehicleStatuses[loc.vehicleId]?.status;
    return status === "online" ? "Idle" : "Offline";
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Vehicle list panel */}
      <div className="w-80 border-r bg-card flex flex-col flex-shrink-0">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vehicles..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {locations.length} vehicles tracked
          </p>
        </div>
        <div className="flex-1 overflow-auto">
          {filtered.map((loc) => {
            const fuel = fuelUpdates[loc.vehicleId];
            const color = getColor(loc);
            const statusLabel = getStatusLabel(loc);
            return (
              <button
                key={loc.vehicleId}
                onClick={() => setSelectedId(loc.vehicleId)}
                className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors ${
                  selectedId === loc.vehicleId ? "bg-muted" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Truck className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium truncate">
                      {loc.vehicleNumber}
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-xs flex-shrink-0"
                    style={{ color, borderColor: color }}
                  >
                    {statusLabel}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground flex gap-3">
                  <span>{loc.speed} km/h</span>
                  {fuel && <span>Fuel: {fuel.fuelLevel.toFixed(1)}%</span>}
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground text-center">
              No vehicles found
            </p>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1">
        <MapContainer
          center={center}
          zoom={selectedId ? 14 : 5}
          className="h-full w-full"
          scrollWheelZoom
          key={`${center[0]}-${center[1]}-${selectedId}`}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {locations.map((loc) => {
            const color = getColor(loc);
            const fuel = fuelUpdates[loc.vehicleId];
            const isSelected = selectedId === loc.vehicleId;
            return (
              <CircleMarker
                key={loc.vehicleId}
                center={[loc.latitude, loc.longitude]}
                radius={isSelected ? 10 : 7}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.85,
                  weight: isSelected ? 3 : 1,
                }}
              >
                <Popup>
                  <div className="text-sm space-y-1">
                    <p className="font-bold">{loc.vehicleNumber}</p>
                    <p>Speed: {loc.speed} km/h</p>
                    {fuel && <p>Fuel: {fuel.fuelLevel.toFixed(1)}%</p>}
                    <p className="text-xs text-gray-500">
                      Last: {new Date(loc.receivedAt).toLocaleString()}
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
