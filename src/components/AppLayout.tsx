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
            {/* Top Header Bar */}
            <header className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-950 text-white border-b border-slate-700/50 shadow-lg">
              <div className="px-6 py-4 relative">
                <div className="text-center">
                  <h1 className="text-xl font-bold tracking-tight">AAROV BUILDMART PRIVATE LIMITED</h1>
                  <p className="text-sm text-slate-300 mt-0.5">Fleet Management - A Product of On-tym Solutions</p>
                </div>
                <div className="absolute right-6 top-1/2 -translate-y-1/2">
                  {connected ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                      <Wifi className="h-4 w-4 text-emerald-400" />
                      <span className="hidden sm:inline text-sm text-emerald-300 font-medium">Live</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/30">
                      <WifiOff className="h-4 w-4 text-red-400" />
                      <span className="hidden sm:inline text-sm text-red-300 font-medium">Offline</span>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Secondary Navigation Bar */}
            <div className="h-12 flex items-center border-b bg-white px-4 shadow-sm">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="text-slate-600 hover:text-slate-900" />
                <span className="text-sm font-semibold text-slate-700">GPS Fleet Manager</span>
              </div>
            </div>
           

            <main className="flex-1 overflow-auto bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </WebSocketContext.Provider>
  );
}
