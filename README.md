# Solar Dryer UI (React + Vite + Tailwind)

## Setup
1. Install dependencies.
2. Copy `.env.example` to `.env` and fill in your Firebase config.
3. Start the dev server.

```bash
npm install
npm run dev
```

## Firebase Data Model
Collections/docs used by the app:
- `sessions` (collection): `{ name, status: "running" | "stopped", createdAt, endedAt, deviceId }`
- `sessions/{sessionId}/samples` (subcollection): `{ dryerTempC, collectorTempC, humidityPct, createdAt, timestampMs }`
- `live/current` (document): `{ dryerTempC, collectorTempC, humidityPct, updatedAt, deviceId }`
- `devices/dryer-01/command` (document): `{ recording: boolean, activeSessionId: string | null, updatedAt }`

## Routes
- `/` Home dashboard
- `/history` History list
- `/history/:sessionId` Session detail

## Notes
- The session detail table is horizontally scrollable on mobile.
- The layout matches the mockups with a dark background and orange glow.
