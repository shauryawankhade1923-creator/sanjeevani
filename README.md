# 🌿 Sanjeevani — Delivering What Matters When It Matters

[![Production Status](https://img.shields.io/badge/Production-Live-success?style=for-the-badge&logo=vercel)](https://sanjeevani-henna-alpha.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Node: >=20](https://img.shields.io/badge/Node->=20-brightgreen?style=for-the-badge&logo=node.js)](package.json)
[![Codebase Status](https://img.shields.io/badge/Smoke%20Tests-Passing-success?style=for-the-badge)](scripts/smoke-test.js)

> **Sanjeevani** is a real-time, constraints-driven civic micro-logistics platform built to coordinate perishable surplus food batches, urgent medical kits, volunteer couriers, and receiving relief shelters before critical perishables spoil.

---

## 🌐 Live Demo & Deployment

- **Live Production WebApp**: [https://sanjeevani-henna-alpha.vercel.app](https://sanjeevani-henna-alpha.vercel.app)
- **GitHub Repository**: [https://github.com/shauryawankhade1923-creator/sanjeevani](https://github.com/shauryawankhade1923-creator/sanjeevani)

---

## 📚 Complete Project Documentation

| Document | Description | Link |
| --- | --- | --- |
| 🏗️ **System Architecture** | Technical design, constraints formula, data models, state machines, and security invariants | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| 🔌 **REST API Reference** | Complete endpoint documentation, request/response payloads, and role authorization | [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) |
| 📖 **User & Operational Guide** | Step-by-step walkthrough for Administrators, Donors, Riders, and Shelters | [docs/USER_GUIDE.md](docs/USER_GUIDE.md) |
| 🚀 **Deployment & Ops Manual** | Vercel setup, serverless architecture, environment variables, and Supabase migration | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |

---

## ⚡ Key Capabilities & Implemented Features

- **🛡️ Safety-First Allocation Engine**: Computes strict mathematical feasibility for travel time, cargo compatibility, remaining safe-use shelf life, rider capacity, and shelter utility dependencies before allocating surplus.
- **🔄 1-Click Reverse Role Switcher**: Instant switching between Administrator, Surplus Donor, Volunteer Rider, and Receiving Shelter without logging out.
- **🗺️ Dedicated Rider Navigation Map**:
  - Turn-by-turn mission HUD with real-time countdown to food/medicine expiry.
  - Live animated route polylines connecting Rider 🛵 ➔ Donor 📦 ➔ Shelter 🏥.
  - Custom pulsating radar GPS marker.
  - Interactive on-map simulation controls (`⚡ Step GPS Along Route`, `🎯 Center On Me`).
- **📦 Verified Chain-of-Custody FSM**: Full shipment lifecycle (Offered ➔ Accepted ➔ Arrived ➔ Picked Up ➔ In Transit ➔ Delivered), backed by immutable audit logs.
- **🧪 Scenario Lab (Chaos Engineering)**: Real-time simulation of high-urgency donations, shelter closures mid-route, transit delays, and rider no-shows.
- **🔐 Resilient Serverless Security**: Stateless HMAC-SHA256 signed session cookies compatible with horizontal serverless scaling.
- **📡 Server-Sent Events (SSE)**: Instant real-time state synchronization across all connected devices and browser tabs.

---

## 👥 Demo Personas & Logins

Click any of the **Quick Demo Profile Chips** on the login screen, or sign in using:

| Role | Email | Password | What You Can Do |
| --- | --- | --- | --- |
| **Administrator** | `admin@demo.sanjeevani.app` | `SanjeevaniDemo!2026` | Monitor city operations, auto-match batches, run Scenario Lab |
| **Surplus Donor** | `donor@demo.sanjeevani.app` | `SanjeevaniDemo!2026` | Post surplus food/medical batches with strict safe shelf-life |
| **Volunteer Rider** | `rider@demo.sanjeevani.app` | `SanjeevaniDemo!2026` | Claim allocations, follow GPS turn-by-turn route map, report delays |
| **Receiving Center** | `shelter@demo.sanjeevani.app` | `SanjeevaniDemo!2026` | Express demand, manage shelter capacity, confirm delivery handoffs |

---

## 💻 Quickstart (Local Development)

```bash
# Clone the repository
git clone https://github.com/shauryawankhade1923-creator/sanjeevani.git
cd sanjeevani

# Verify code integrity
npm run check

# Start development server
npm run dev
```

Open `http://localhost:4173` in your browser.

To run the automated smoke test against production or local:
```bash
# Test local
npm test

# Test production
$env:BASE_URL = "https://sanjeevani-henna-alpha.vercel.app"
node scripts/smoke-test.js
```

---

## 🛠️ Technology Stack

- **Runtime**: Node.js 20+ (zero-dependency pure native HTTP server & crypto modules)
- **Frontend**: Responsive Single-Page Application (HTML5, modern CSS3 with custom properties, vanilla ES6+)
- **Mapping Engine**: Leaflet 1.9.4 & OpenStreetMap with custom vector layers and divIcon markers
- **Realtime**: Server-Sent Events (SSE) with adaptive visibility polling
- **Hosting & Edge**: Vercel Serverless Functions
- **Database Target**: Ready-to-deploy Supabase PostgreSQL schema with Row-Level Security (`supabase/migrations/001_initial_schema.sql`)
