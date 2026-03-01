

## Phase 1: Foundation, Layout & Live Vehicle Tracking

### Step 1: Install dependencies & set up theme
- Install `react-leaflet`, `leaflet`, `@types/leaflet`
- Update `src/index.css` with slate/gray color theme (slate-800 sidebar, slate-50 content, teal accents matching logo)

### Step 2: Create API & WebSocket utilities
- Create `src/lib/api.ts` — shared fetch wrapper using base URL `https://server.aarovbuildmart.in/api/gps`
- Create `src/hooks/useWebSocket.ts` — WebSocket hook connecting to `wss://server.aarovbuildmart.in/gps/` with auto-reconnect, handling message types: `initial_data`, `location_update`, `fuel_update`, `geofence_alert`, `vehicle_status`

### Step 3: Build sidebar & app layout
- Add the uploaded logo to `public/logo2.png`
- Create `src/components/AppSidebar.tsx` with dark slate-800 background, logo at top, nav items: Dashboard, Live Tracking, Vehicles, Fuel Monitoring, Geofences, Analytics
- Create `src/components/AppLayout.tsx` wrapping SidebarProvider + header with SidebarTrigger + main content area
- Update `src/App.tsx` with all routes wrapped in AppLayout

### Step 4: Build Dashboard page
- Create `src/pages/Dashboard.tsx` with summary cards (Total Vehicles, Active, Tracked Today, Active Geofences) fetched from `/analytics/dashboard`
- Recent alerts section from WebSocket geofence alerts
- Quick vehicle status list from WebSocket data
- Mini map showing all vehicle positions using Leaflet

### Step 5: Build Live Tracking page
- Create `src/pages/LiveTracking.tsx` with full-height OpenStreetMap
- Show all vehicles as markers from WebSocket `initial_data` + `location_update`
- Color-coded markers: green (moving), yellow (idle), red (offline)
- Marker popups showing vehicle number, speed, driver, fuel level, last seen
- Left panel listing all vehicles with search/filter, click to focus on map
- Auto-center map on vehicle cluster

### Step 6: Build Vehicle Management pages
- Create `src/pages/Vehicles.tsx` — table listing all vehicles from `/vehicles` with columns: Number, Type, Driver, Phone, IMEI, Status, Last Seen
- Create `src/pages/VehicleDetail.tsx` — vehicle detail with edit form (update details, IMEI), delete with confirmation
- Route history: date range picker → route drawn on map from `/locations/route/:id`

### Step 7: Build Fuel Monitoring page
- Create `src/pages/FuelMonitoring.tsx` — live fuel levels for all vehicles with visual gauges from `/fuel/live` + WebSocket
- Fuel history chart per vehicle with date range picker (Recharts line chart)
- Fuel consumption analysis cards

### Step 8: Build Geofence Management page
- Create `src/pages/Geofences.tsx` — map with drawing tools for circle/polygon geofences
- Geofence list with name, type, active toggle, edit, delete
- Geofence events log with vehicle/date filters
- Geofence statistics (entry/exit counts)

### Step 9: Build Analytics page
- Create `src/pages/Analytics.tsx` — vehicle activity summary table from `/analytics/vehicle-activity`
- Distance traveled per vehicle with date range
- Hourly statistics charts (speed, satellites over time)
- Speed violation alerts table with map pins
- Geofence summary analytics

