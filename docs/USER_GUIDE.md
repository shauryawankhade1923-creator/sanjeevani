# Sanjeevani — User Guide & Operational Manual

> **Welcome to Sanjeevani.** This guide walks you through using each of the four role-based workspaces in the platform.

---

## 🔑 Fast Demo Logins & Instant Role Switching

You can access Sanjeevani on the live URL:
👉 **[https://sanjeevani-henna-alpha.vercel.app](https://sanjeevani-henna-alpha.vercel.app)**

On the login screen, click any of the **Quick Demo Profile Chips** or use the credentials:

| Role | Email | Password | Primary Mission |
| --- | --- | --- | --- |
| 🛡️ **Network Admin** | `admin@demo.sanjeevani.app` | `SanjeevaniDemo!2026` | Oversee city-wide dispatch, resolve bottlenecks, run Scenarios |
| 🍱 **Surplus Donor** | `donor@demo.sanjeevani.app` | `SanjeevaniDemo!2026` | Post surplus food/medical batches with strict safe shelf-life |
| 🛵 **Volunteer Rider** | `rider@demo.sanjeevani.app` | `SanjeevaniDemo!2026` | Accept allocations, follow turn-by-turn route map, simulate GPS |
| 🏥 **Receiving Shelter** | `shelter@demo.sanjeevani.app` | `SanjeevaniDemo!2026` | Express item demand, manage capacity, confirm delivery receipt |

> **💡 Instant Role Switcher**: Once signed in, you can switch between any of these workspaces at any time in **1 click** using the topbar profile chip or the workspace switcher in the sidebar!

---

## 1. Network Administrator Workspace

As an Administrator, you have full operational visibility over the Pune/Alandi civic logistics network.

### Key Screens:
1. **Operations Dashboard (`#operations`)**:
   - **Critical Metrics**: Active shipments, attention alerts, rescued meals count, and shelter demand percentage.
   - **Filter Chips**: Filter by `All`, `Needs attention`, `In transit`, or `Critical expiry (<15m)`.
   - **Quick Attention Queue**: Directly view shipments waiting on rider acceptance or delayed by traffic.
2. **Dispatch Queue (`#dispatch`)**:
   - View all registered donations and their available units.
   - Click **"Auto-match"** on any available batch to run the Safety Allocation Engine.
3. **Scenario Lab (`#scenario`)**:
   - Run deterministic failure scenarios like **"Simulate shelter closure mid-route"** or **"Simulate route delay"** to evaluate the platform's self-healing capabilities.
4. **Live Operations Map (`#map`)**:
   - Bird's-eye view of all shelters (green/red), open surplus collection points, and volunteer riders.

---

## 2. Surplus Donor Workspace

Designed for commercial kitchens, mess halls, restaurants, pharmacies, and event caterers.

### How to Post a Surplus Donation:
1. Navigate to **"My donations"** or click **"＋ Post a donation"** in the sidebar.
2. Complete the modal:
   - **Title**: e.g., *"Evening Dinner Buffet Surplus"*
   - **Category**: Select `Cooked meals`, `Packaged food`, `Groceries`, `Ration kits`, or `Medical supplies`.
   - **Quantity & Unit**: e.g., `45 meals`.
   - **Safe-use shelf life**: Select minutes remaining (e.g. `90 minutes`).
   - **Pickup location**: e.g., *"Hostel 4 Canteen, Alandi"*.
   - **Handling instructions**: Temperature control and packaging guidelines.
3. Click **"Save and post donation"**.
4. The batch immediately broadcasts via Server-Sent Events to all dispatchers and eligible riders.

---

## 3. Volunteer Rider Workspace & Navigation Terminal

Designed for volunteer drivers, bike couriers, and cargo van operators.

### How to Deliver Aid:
1. **Available Work (`#dispatch`)**:
   - When a delivery offer is made to you, it appears in your dispatch queue with a 5-minute reservation timer.
   - Click **"Accept"** to claim custody or **"Reject"** to release it immediately.
2. **Rider Navigation Map (`#map`)**:
   - Open **"My map"** to enter the dedicated **Turn-by-Turn Delivery HUD**.
   - **Visual Route Polylines**:
     - See an animated dashed emerald line from your live position to the donor pickup location.
     - View the subsequent route leg to the destination shelter.
   - **Interactive GPS Navigation**:
     - Click **"⚡ Step GPS along route"** to simulate driving along the route towards your waypoint.
     - Click **"🎯 Center on me"** to re-center the camera on your beacon.
   - **Direct Trip Controls**:
     - When you arrive at the donor, click **"Arrived at pickup"**.
     - Once cargo is loaded, click **"Confirm cargo loaded"**.
     - When starting your drive to the shelter, click **"Begin trip to shelter"**.
     - If delayed by traffic, click **"Report delay (+15m)"** to notify the network and automatically adjust arrival ETAs.

---

## 4. Receiving Shelter & Relief Camp Workspace

Designed for night shelters, child care centers, and emergency relief camps.

### How to Manage Influx:
1. **Demand & Capacity (`#shelters`)**:
   - View your current occupancy vs. licensed capacity.
   - Verify utility readiness (clean water and cooking fuel flags).
   - Click **"Update demand"** to request specific quantities of meals, rations, or first aid kits.
   - Click **"Close center"** if full or experiencing an emergency (automatically alerts the network to reroute in-transit shipments).
2. **Incoming Deliveries (`#dispatch`)**:
   - Real-time queue showing shipments currently en route with estimated arrival times.
   - When the rider arrives, inspect cargo and click **"Confirm receipt"** to log the handoff and complete the custody chain.
