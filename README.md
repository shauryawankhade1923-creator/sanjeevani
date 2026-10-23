# Sanjeevani

**Delivering What Matters When It Matters.**

Sanjeevani is a full-stack civic micro-logistics prototype for coordinating perishable surplus, volunteer riders, and receiving centers under time, capacity, compatibility, and reliability constraints.

## What is implemented

- Real Node.js HTTP server with JSON persistence in `data/sanjeevani.json`.
- Cookie-based authenticated sessions and four role-based demo accounts.
- Shared state across browser tabs/devices connected to the same server through Server-Sent Events.
- Role workspaces for administrators, donors, volunteer riders, and receiving centers.
- Donation creation with category, quantity, safe-use window, storage, handling, pickup, and notes.
- Allocation engine with hard safety filters for capacity, demand, center status, dependencies, cold chain, and expiry feasibility.
- Reservation leases with server-side expiry and exact-once quantity release.
- Shipment lifecycle: offer, accept, pickup arrival, picked up, in transit, delayed, rerouted, delivered, expired, and cancelled.
- Demand and receiving-center status updates with reassessment of affected allocations.
- Scenario Lab controls that mutate shared records: urgent batch, split batch, rider no-show, clock advance, shelter closure, demand reduction, delay, rider movement, and reset.
- Leaflet + OpenStreetMap live operations map using clearly labelled simulated Pune/Alandi coordinates.
- Database-ready Supabase schema with RLS policies in `supabase/migrations/001_initial_schema.sql`.
- Vercel-compatible static serving structure and environment template.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm run dev
```

Open:

```text
http://localhost:4173
```

The local server creates `data/sanjeevani.json` on first start. This file is intentionally ignored by Git and is the shared source of truth for the local demo mode.

To reset the deterministic dataset:

```bash
npm run seed
npm run dev
```

## Demo accounts

The four accounts are real server-authenticated demo users, not frontend bypass buttons:

| Role | Email |
| --- | --- |
| Administrator | `admin@demo.sanjeevani.app` |
| Donor | `donor@demo.sanjeevani.app` |
| Volunteer rider | `rider@demo.sanjeevani.app` |
| Receiving center | `shelter@demo.sanjeevani.app` |

Set the shared server-only password in `.env`:

```bash
copy .env.example .env
```

Then change `DEMO_PASSWORD` to a value of your choice. If no `.env` exists, local development uses the server-side fallback `SanjeevaniDemo!2026`; it is never sent in frontend JavaScript. For a shared evaluation environment, always set `DEMO_PASSWORD` and `SESSION_SECRET` explicitly.

## Realtime test

1. Run `npm run dev`.
2. Open two browser windows at `http://localhost:4173`.
3. Sign in as donor in one window and admin in the other using the same configured demo password.
4. Create a donation in the donor window.
5. The admin dispatch and activity views update through the server event stream without a manual refresh.
6. Repeat with rider and shelter accounts to exercise assignment and delivery transitions.

## Supabase setup

The SQL migration is ready at:

```text
supabase/migrations/001_initial_schema.sql
```

Apply it in the Supabase SQL editor or with the Supabase CLI. Then create the four users in Supabase Auth and insert matching rows into `public.profiles`. Use fictional demo identities only. Never expose a service-role key in browser code.

Required environment variables are listed in `.env.example`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `DEMO_PASSWORD`
- `SESSION_SECRET`
- Optional `OSRM_BASE_URL`

The current local adapter is deliberately kept as the default so the prototype remains runnable without external credentials. The Supabase schema, relationships, indexes, and RLS policies are included for the next persistence cutover. Supabase credentials and the final production persistence adapter are the remaining external setup dependency.

## Maps and routing

Leaflet and OpenStreetMap are loaded in the browser with attribution. The demo uses fictional seeded coordinates around Pune/Alandi and labels rider positions as simulated. If Leaflet or tiles cannot load, the map panel shows a clear fallback message. Straight-line feasibility is used by the local allocation engine; it is not presented as verified road routing. Configure `OSRM_BASE_URL` before adding a production routing adapter.

## Checks

```bash
npm run check
```

This validates both `server.js` and `app.js` syntax. Start the server and use the role workflows above for the end-to-end smoke test.

## Vercel preparation

The frontend assets are Vercel-compatible, but the current JSON persistence server is intended for local/shared demo use because serverless filesystems are ephemeral. For production deployment:

1. Apply the Supabase migration.
2. Create Auth users and profiles.
3. Move the API handlers to Vercel Functions or switch the persistence layer to Supabase queries.
4. Configure environment variables in Vercel without exposing the service-role key to the client.
5. Add a production routing provider if road-accurate ETAs are required.
