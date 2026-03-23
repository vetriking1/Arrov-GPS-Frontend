import { useState, useMemo, useEffect, useRef } from "react";
import { useWSData } from "@/components/AppLayout";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Truck } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Create custom car icons with colored circle background
const createCarIcon = (color: string) => {
  return L.divIcon({
    html: `
      <div style="
        width: 40px;
        height: 40px;
        background-color: ${color};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
        </svg>
      </div>
    `,
    className: 'custom-car-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
};

function MapController({ center, zoom, selectedId }: { center: [number, number]; zoom: number; selectedId: number | null }) {
  const map = useMap();
  const prevSelectedId = useRef(selectedId);

  useEffect(() => {
    // If vehicle selection changed, fly to it with zoom
    if (selectedId !== prevSelectedId.current && selectedId !== null) {
      map.flyTo(center, zoom, { animate: true, duration: 1.5 });
      prevSelectedId.current = selectedId;
    } else if (selectedId === null && prevSelectedId.current !== null) {
      // Deselected, zoom out smoothly
      map.flyTo(center, zoom, { animate: true, duration: 1.5 });
      prevSelectedId.current = null;
    } else if (selectedId !== null) {
      // Same vehicle selected, just pan to follow movement
      map.panTo(center, { animate: true, duration: 1 });
    }
  }, [center, zoom, selectedId, map]);

  return null;
}

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

  const zoom = useMemo(() => {
    if (selectedId) return 17;
    if (locations.length > 0) return 14;
    return 5;
  }, [locations.length, selectedId]);

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
    <div className="flex h-[calc(100vh-3.5rem)] relative">
      {/* Vehicle list panel */}
      <div className="w-80 border-r bg-card flex flex-col flex-shrink-0 relative z-10">
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
      <div className="flex-1 relative">
        <MapContainer
          center={center}
          zoom={zoom}
          className="h-full w-full"
          scrollWheelZoom
          zoomControl={true}
        >
          <MapController center={center} zoom={zoom} selectedId={selectedId} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {locations.map((loc) => {
            const color = getColor(loc);
            const fuel = fuelUpdates[loc.vehicleId];
            const statusLabel = getStatusLabel(loc);
            return (
              <Marker
                key={loc.vehicleId}
                position={[loc.latitude, loc.longitude]}
                icon={createCarIcon(color)}
              >
                <Popup>
                  <div className="text-sm space-y-1 min-w-[180px]">
                    <div className="flex items-center justify-between">
                      <p className="font-bold">{loc.vehicleNumber}</p>
                      <Badge 
                        variant="secondary" 
                        className="text-xs"
                        style={{ backgroundColor: color, color: 'white', borderColor: color }}
                      >
                        {statusLabel}
                      </Badge>
                    </div>
                    <p>Speed: {loc.speed} km/h</p>
                    <p>Satellites: {loc.satellites}</p>
                    {fuel && <p>Fuel: {fuel.fuelLevel.toFixed(1)}%</p>}
                    <p className="text-xs text-gray-500">
                      IMEI: {loc.imei}
                    </p>
                    <p className="text-xs text-gray-500">
                      Position: {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Time: {new Date(loc.timestamp).toLocaleString()}
                    </p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Legend */}
        <Card className="absolute bottom-6 left-6 z-[1000] shadow-lg">
          <CardContent className="p-3">
            <h3 className="text-sm font-semibold mb-2">Vehicle Status</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#10b981]"></div>
                <span className="text-xs">Moving</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#f59e0b]"></div>
                <span className="text-xs">Stopped</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#ef4444]"></div>
                <span className="text-xs">Offline</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
