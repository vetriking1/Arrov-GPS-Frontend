import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { Wifi, WifiOff } from "lucide-react";
import { useWebSocket, type WSLocationUpdate, type WSFuelUpdate, type WSGeofenceAlert, type WSVehicleStatus, type WSInitialData } from "@/hooks/useWebSocket";
import { createContext, useContext, useState, useCallback } from "react";

interface VehicleLocationMap {
  [vehicleId: number]: WSLocationUpdate;
}

interface WebSocketContextType {
  connected: boolean;
  vehicleLocations: VehicleLocationMap;
  fuelUpdates: { [vehicleId: number]: WSFuelUpdate };
  geofenceAlerts: WSGeofenceAlert[];
  vehicleStatuses: { [vehicleId: number]: WSVehicleStatus };
}

const WebSocketContext = createContext<WebSocketContextType>({
  connected: false,
  vehicleLocations: {},
  fuelUpdates: {},
  geofenceAlerts: [],
  vehicleStatuses: {},
});

export const useWSData = () => useContext(WebSocketContext);

export function AppLayout() {
  const [vehicleLocations, setVehicleLocations] = useState<VehicleLocationMap>({});
  const [fuelUpdates, setFuelUpdates] = useState<{ [k: number]: WSFuelUpdate }>({});
  const [geofenceAlerts, setGeofenceAlerts] = useState<WSGeofenceAlert[]>([]);
  const [vehicleStatuses, setVehicleStatuses] = useState<{ [k: number]: WSVehicleStatus }>({});

  const onInitialData = useCallback((data: WSInitialData) => {
    if (data.locations) {
      const locs: VehicleLocationMap = {};
      data.locations.forEach((l: any) => {
        locs[l.vehicleId] = l;
      });
      setVehicleLocations(locs);
    }
    if (data.vehicleStatus) {
      const statuses: { [k: number]: WSVehicleStatus } = {};
      data.vehicleStatus.forEach((s: any) => {
        statuses[s.vehicleId] = s;
      });
      setVehicleStatuses(statuses);
    }
  }, []);

  const onLocationUpdate = useCallback((data: WSLocationUpdate) => {
    setVehicleLocations((prev) => ({ ...prev, [data.vehicleId]: data }));
  }, []);

  const onFuelUpdate = useCallback((data: WSFuelUpdate) => {
    setFuelUpdates((prev) => ({ ...prev, [data.vehicleId]: data }));
  }, []);

  const onGeofenceAlert = useCallback((data: WSGeofenceAlert) => {
    setGeofenceAlerts((prev) => [data, ...prev].slice(0, 50));
  }, []);

  const onVehicleStatus = useCallback((data: WSVehicleStatus) => {
    setVehicleStatuses((prev) => ({ ...prev, [data.vehicleId]: data }));
  }, []);

  const { connected } = useWebSocket({
    onInitialData,
    onLocationUpdate,
    onFuelUpdate,
    onGeofenceAlert,
    onVehicleStatus,
  });

  return (
    <WebSocketContext.Provider
      value={{ connected, vehicleLocations, fuelUpdates, geofenceAlerts, vehicleStatuses }}
    >
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center justify-between border-b bg-card px-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <span className="text-sm font-semibold text-foreground">GPS Fleet Manager</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {connected ? (
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <Wifi className="h-4 w-4" />
                    <span className="hidden sm:inline">Live</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-destructive">
                    <WifiOff className="h-4 w-4" />
                    <span className="hidden sm:inline">Offline</span>
                  </span>
                )}
              </div>
            </header>
            <main className="flex-1 overflow-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </WebSocketContext.Provider>
  );
}
