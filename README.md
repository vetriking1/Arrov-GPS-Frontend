# Vehicle Insight Hub

Fleet management dashboard for **Aarov BuildMart** (Ontym Solutions) — live GPS tracking, fuel monitoring, geofences, route history, analytics, and expense tracking for a vehicle fleet.

The app connects to the Aarov GPS backend over REST and WebSocket. Significant signal-processing logic runs in the browser to clean GPS tracks, detect fuel events, and analyze routes and geofence visits. All date filters and display use **IST (Asia/Kolkata)**; backend timestamps are UTC and converted in `src/lib/datetime.ts`.

## Features

| Module | Route | Description |
|--------|-------|-------------|
| Dashboard | `/` | Fleet KPIs, live map, recent geofence alerts |
| Live Tracking | `/tracking` | Real-time vehicle positions via WebSocket; searchable list with map fly-to |
| Vehicles | `/vehicles` | Fleet registry — search, create, and delete vehicles |
| Vehicle Detail | `/vehicles/:id` | Edit vehicle metadata, IMEI, due dates (EMI/insurance/road tax), route history |
| Route History | `/route-history` | Historical GPS tracks with halt detection, trip analysis, and point-in-time lookup |
| Fuel Monitoring | `/fuel` | Live tank levels, refuel/theft detection, daily fuel charts |
| Geofences | `/geofences` | Circle/polygon zone CRUD, map editor, entry/exit events, visit detection |
| Analytics | `/analytics` | Trips, vehicle activity, hourly stats, geofence summary, speed violations |
| Expenses | `/expenses` | EMI, insurance, road tax, and operational costs with charts |

## Architecture

```
Browser
  ├── React Router (9 routes + 404)
  ├── AppLayout
  │     ├── WebSocket → wss://server.aarovbuildmart.in/gps/
  │     └── Sidebar + Header + Outlet
  ├── TanStack Query → REST https://server.aarovbuildmart.in/api/gps
  └── Client analysis (gpsFilter, routeAnalysis, geofenceAnalysis, fuelAnalysis)
        └── Leaflet maps + Recharts visualizations
```

**State management** — no global store. Server state via TanStack Query (`useQuery` / `useMutation`); real-time data via a WebSocket context in `AppLayout` (`useWSData()`); per-page UI state with `useState` / `useMemo`.

**Authentication** — not implemented in the SPA. API and WebSocket calls carry no credentials; access control depends on the backend and network layer.

## Tech Stack

- **React 18** + **TypeScript** + **Vite 5** (`@vitejs/plugin-react-swc`)
- **shadcn/ui** (Radix UI) + **Tailwind CSS**
- **React Router** v6 for navigation
- **TanStack Query** v5 for server state
- **Leaflet** / **react-leaflet** for maps (OpenStreetMap tiles)
- **Recharts** for analytics charts
- **react-hook-form** + **zod** for form validation
- **Vitest** + **Testing Library** for tests

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- npm

### Install & run

```sh
git clone <YOUR_GIT_URL>
cd vehicle-insight-hub
npm install
npm run dev
```

The dev server starts at **http://localhost:8080** (configured in `vite.config.ts`).

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run build:dev` | Development-mode build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |

### Environment variables

None are used today. API and WebSocket URLs are hardcoded in:

- `src/lib/api.ts` — `BASE_URL`
- `src/hooks/useWebSocket.ts` — `WS_URL`

To point at a different backend, update those constants or add `VITE_*` env support.

## Backend Integration

### REST API

**Base URL:** `https://server.aarovbuildmart.in/api/gps`

Typed client in `src/lib/api.ts` covers:

| Domain | Endpoints |
|--------|-----------|
| Vehicles | CRUD, IMEI update |
| Locations | Live, history, route, at-time |
| Fuel | Live, history, consumption |
| Geofences | CRUD, events, stats |
| Analytics | Dashboard, activity, distance, hourly, geofence summary, speed violations |
| Expenses | Types, CRUD |

### WebSocket

**URL:** `wss://server.aarovbuildmart.in/gps/`

Handled by `src/hooks/useWebSocket.ts` and exposed through `AppLayout` as `useWSData()`:

| Message type | Purpose |
|--------------|---------|
| `initial_data` | Snapshot of locations and vehicle status on connect |
| `location_update` | Live GPS positions |
| `fuel_update` | Live fuel levels |
| `geofence_alert` | Zone entry/exit events (last 50 kept) |
| `vehicle_status` | Online/offline status |
| `ping` / `pong` | Keepalive every 30s |

Auto-reconnects every 3 seconds on disconnect. The header shows a Live/Offline indicator.

## Client-Side Signal Processing

Domain logic in `src/lib/` runs on fetched GPS and fuel data before display:

| Module | Role |
|--------|------|
| `gpsFilter.ts` | Hampel filter, speed/jump rejection, stationary jitter collapse |
| `fuelAnalysis.ts` | Voltage validation, rolling median, refuel/drop detection (shake-resistant) |
| `routeAnalysis.ts` | Halt detection, moving/stop segments, haversine distance |
| `geofenceAnalysis.ts` | Point-in-polygon/circle, trip detection, visit detection, halt filtering |
| `datetime.ts` | IST ↔ UTC conversion, day/week/month range helpers |

Winning algorithms from the `autoresearch-data/` loop are ported into `gpsFilter.ts` and `fuelAnalysis.ts`.

## Project Structure

```
src/
├── main.tsx              # React entry
├── App.tsx               # Routes, QueryClientProvider
├── components/
│   ├── AppLayout.tsx     # Shell, WebSocket context, header
│   ├── AppSidebar.tsx    # Navigation
│   ├── DayFilter.tsx     # Shared IST date picker
│   └── ui/               # shadcn/ui components
├── hooks/
│   ├── useWebSocket.ts   # WebSocket connection and message handling
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/                  # API client, analysis modules, utilities
├── pages/                # Route-level page components
└── test/                 # Vitest setup and tests

autoresearch-data/        # Offline GPS/fuel signal-processing research loop
public/                   # Static assets (logo, robots.txt)
```

## autoresearch-data

A separate Python subproject for autonomously improving GPS and fuel correction algorithms. It fetches real vehicle data from the same API, scores methods in `methods.py`, and generates inspection plots. See [`autoresearch-data/README.md`](autoresearch-data/README.md) for setup.

```sh
cd autoresearch-data
uv sync
python prepare.py            # cache real vehicle-days into data/
python run.py                # score methods + write plots to out/
```

## Deployment

```sh
npm run build
```

Serve the `dist/` folder with any static host (nginx, Vercel, Netlify, S3, etc.). Ensure the backend API and WebSocket endpoints are reachable from the deployment environment. The Vite config allows Cloudflare tunnel hosts (`.trycloudflare.com`) for dev tunneling.

## License

Private — Aarov BuildMart / Ontym Solutions.
