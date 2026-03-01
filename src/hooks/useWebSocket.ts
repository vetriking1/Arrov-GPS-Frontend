import { useEffect, useRef, useCallback, useState } from "react";

const WS_URL = "wss://server.aarovbuildmart.in/gps/";

export interface WSLocationUpdate {
  vehicleId: number;
  vehicleNumber: string;
  latitude: number;
  longitude: number;
  speed: number;
  receivedAt: string;
}

export interface WSFuelUpdate {
  vehicleId: number;
  vehicleNumber: string;
  voltage: number;
  fuelLevel: number;
  receivedAt: string;
}

export interface WSGeofenceAlert {
  vehicleId: number;
  geofenceName: string;
  geofenceId: number;
  eventType: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface WSVehicleStatus {
  vehicleId: number;
  status: string;
  lastSeen: string;
}

export interface WSInitialData {
  locations: any[];
  vehicleStatus: any[];
}

type WSMessage =
  | { type: "initial_data"; data: WSInitialData }
  | { type: "location_update"; data: WSLocationUpdate }
  | { type: "fuel_update"; data: WSFuelUpdate }
  | { type: "geofence_alert"; data: WSGeofenceAlert }
  | { type: "vehicle_status"; data: WSVehicleStatus }
  | { type: "pong"; timestamp: string };

interface UseWebSocketOptions {
  onInitialData?: (data: WSInitialData) => void;
  onLocationUpdate?: (data: WSLocationUpdate) => void;
  onFuelUpdate?: (data: WSFuelUpdate) => void;
  onGeofenceAlert?: (data: WSGeofenceAlert) => void;
  onVehicleStatus?: (data: WSVehicleStatus) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log("[WS] Connected");
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        const opts = optionsRef.current;
        switch (msg.type) {
          case "initial_data":
            opts.onInitialData?.(msg.data);
            break;
          case "location_update":
            opts.onLocationUpdate?.(msg.data);
            break;
          case "fuel_update":
            opts.onFuelUpdate?.(msg.data);
            break;
          case "geofence_alert":
            opts.onGeofenceAlert?.(msg.data);
            break;
          case "vehicle_status":
            opts.onVehicleStatus?.(msg.data);
            break;
        }
      } catch (e) {
        console.error("[WS] Parse error:", e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      console.log("[WS] Disconnected, reconnecting in 3s...");
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = (e) => {
      console.error("[WS] Error:", e);
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    // Ping every 30s
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected };
}
