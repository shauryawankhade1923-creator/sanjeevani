# Sanjeevani — REST API Reference Manual

> **Base URL**: `https://sanjeevani-henna-alpha.vercel.app` (Production) or `http://localhost:4173` (Local Dev)

All authenticated endpoints require the `sanjeevani_session` cookie issued upon successful login.

---

## 1. Authentication & Session Management

### `POST /api/auth/login`
Authenticates a user with email and password, setting an HMAC-signed session cookie.

- **Access**: Public
- **Request Body**:
```json
{
  "email": "rider@demo.sanjeevani.app",
  "password": "SanjeevaniDemo!2026"
}
```
- **Response `200 OK`**:
```json
{
  "user": {
    "authUserId": "auth-rider",
    "email": "rider@demo.sanjeevani.app",
    "name": "Aarav Mehta",
    "role": "rider",
    "entityId": "rider-1"
  }
}
```
- **Headers Returned**: `Set-Cookie: sanjeevani_session=...; Path=/; HttpOnly; SameSite=Lax`

---

### `POST /api/auth/switch`
Instant 1-click workspace role switcher for demo and evaluation purposes. Switches session to another persona without requiring manual re-login.

- **Access**: Authenticated
- **Request Body**:
```json
{
  "role": "admin"
}
```
*(Valid roles: `"admin"`, `"donor"`, `"rider"`, `"shelter"`)*

- **Response `200 OK`**:
```json
{
  "user": {
    "authUserId": "auth-admin",
    "email": "admin@demo.sanjeevani.app",
    "name": "Riya Kapoor",
    "role": "admin",
    "entityId": "network-1"
  }
}
```

---

### `POST /api/auth/logout`
Destroys the current authenticated session cookie.

- **Access**: Authenticated
- **Response `200 OK`**:
```json
{
  "ok": true
}
```

---

### `GET /api/auth/me`
Retrieves the profile of the current session user.

- **Access**: Authenticated
- **Response `200 OK`**:
```json
{
  "user": {
    "authUserId": "auth-rider",
    "email": "rider@demo.sanjeevani.app",
    "name": "Aarav Mehta",
    "role": "rider",
    "entityId": "rider-1"
  }
}
```

---

## 2. Shared Operations State & Streaming

### `GET /api/state`
Returns the synchronized snapshot of the logistics network scoped to the caller's role.

- **Access**: Authenticated
- **Response `200 OK`**:
```json
{
  "user": { ... },
  "donations": [ ... ],
  "shipments": [ ... ],
  "centers": [ ... ],
  "demands": [ ... ],
  "riders": [ ... ],
  "events": [ ... ],
  "metrics": {
    "activeShipments": 2,
    "needsAttention": 1,
    "mealsRescued": 240,
    "openDemand": 128,
    "simulationNow": "2026-10-23T10:00:00.000Z"
  }
}
```

---

### `GET /api/events/stream`
Server-Sent Events (SSE) live push stream for network state updates.

- **Access**: Public / Authenticated
- **Content-Type**: `text/event-stream`
- **Sample Event**:
```text
data: {"type":"shipment.in_transit","payload":{"shipmentId":"shipment-1"}}
```

---

## 3. Donations Management

### `POST /api/donations`
Creates a new surplus batch or medical supply donation.

- **Access**: Roles: `donor`, `admin`
- **Request Body**:
```json
{
  "title": "Fresh Cooked Thali Packets",
  "category": "Cooked meals",
  "quantity": 60,
  "unit": "meals",
  "safeMinutes": 90,
  "pickupName": "Hostel 3 Mess",
  "pickupAddress": "Alandi Campus, Pune",
  "pickupLat": 18.612,
  "pickupLng": 73.874,
  "storage": "Room temperature",
  "handling": "Keep covered; deliver before safe deadline",
  "notes": "Untouched vegetarian surplus"
}
```
- **Response `201 Created`**:
```json
{
  "donation": {
    "id": "donation-xyz",
    "status": "available",
    "availableQuantity": 60,
    "safeUntil": "2026-10-23T11:30:00.000Z",
    ...
  },
  "state": { ... }
}
```

---

## 4. Allocations & Shipments

### `POST /api/admin/allocate-best`
Executes the Safety-First Allocation Engine to automatically find the most reliable available rider and compatible shelter.

- **Access**: Roles: `admin`
- **Request Body**:
```json
{
  "donationId": "donation-1"
}
```
- **Response `200 OK`**:
```json
{
  "message": "Created 1 safe offer(s)",
  "created": [ { "id": "shipment-99", "status": "offered", ... } ],
  "state": { ... }
}
```

---

### `POST /api/shipments/:id/:action`
Updates the custody status of a shipment across its lifecycle.

- **Access**: Role-protected:
  - `accept` / `reject`: Assigned Rider or Admin
  - `pickup-arrived` / `picked-up` / `in-transit` / `report-delay`: Assigned Rider or Admin
  - `delivered`: Receiving Center or Admin

- **Actions**:
  - `accept`: Rider confirms reservation offer.
  - `reject`: Rider declines offer; quantity immediately returns to open surplus pool.
  - `pickup-arrived`: Rider marks physical arrival at donor location.
  - `picked-up`: Cargo loaded; custody transfers to rider.
  - `in-transit`: Rider begins trip to receiving center.
  - `report-delay`: Adds delay minutes (`{"delayMinutes": 15}`) and recalculates ETA.
  - `delivered`: Receiving center confirms goods verified and safely stored.

- **Response `200 OK`**:
```json
{
  "shipment": { "id": "shipment-1", "status": "in_transit", ... },
  "state": { ... }
}
```

---

## 5. Rider Telemetry & Navigation

### `POST /api/riders/me`
Updates live GPS coordinates and working availability of the authenticated volunteer rider.

- **Access**: Roles: `rider`
- **Request Body**:
```json
{
  "lat": 18.581,
  "lng": 73.897,
  "availability": "available"
}
```
*(Valid availabilities: `"available"`, `"on_delivery"`, `"offline"`)*

- **Response `200 OK`**:
```json
{
  "rider": {
    "id": "rider-1",
    "name": "Aarav Mehta",
    "lat": 18.581,
    "lng": 73.897,
    "availability": "available",
    "lastSeenAt": "2026-10-23T10:15:00.000Z"
  },
  "state": { ... }
}
```

---

## 6. Receiving Centers & Demands

### `POST /api/centers/:id/status`
Toggles shelter open/closed status. Automatically reassesses in-transit and reserved allocations if closed.

- **Access**: Center Admin or Global Admin
- **Request Body**:
```json
{
  "isOpen": false
}
```

---

### `POST /api/centers/:id/demand`
Updates quantity of open demand for an item category.

- **Access**: Center Admin or Global Admin
- **Request Body**:
```json
{
  "demandId": "demand-1",
  "quantity": 50
}
```

---

## 7. Scenario Lab (Demo & Failure Testing)

### `POST /api/admin/scenario`
Triggers deterministic operational failure modes for evaluation and chaos engineering demos.

- **Access**: Roles: `admin`
- **Request Body**:
```json
{
  "scenario": "urgent"
}
```

| Scenario Key | Description |
| --- | --- |
| `urgent` | Creates a 180-meal batch with an urgent 35-minute safe-use deadline |
| `split` | Splits an urgent batch across multiple volunteer riders and shelters |
| `no-show` | Simulates a rider no-show, expiring reservation lease and returning aid to pool |
| `advance-time` | Advances server simulation clock forward by 10 minutes |
| `closure` | Simulates a shelter closure mid-route, triggering real-time rerouting |
| `demand-reduction` | Decreases shelter demand, releasing unpicked surplus |
| `delay` | Reports a 25-minute transit delay and flags attention board |
| `movement` | Simulates rider GPS movement on the map |
| `reset` | Restores database to deterministic initial demo state |
