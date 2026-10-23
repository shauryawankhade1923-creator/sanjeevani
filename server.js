const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const ROOT = __dirname;
const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'data') : path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'sanjeevani.json');
const PORT = Number(process.env.PORT || 4173);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const clients = new Set();
const sessions = new Map();

loadEnv();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'SanjeevaniDemo!2026';
const SESSION_SECRET = process.env.SESSION_SECRET || 'local-sanjeevani-session-secret-change-me';
let db = loadDatabase();

function loadEnv() {
  const envFile = path.join(ROOT, '.env');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const candidate = crypto.scryptSync(password, stored.salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(stored.hash, 'hex'));
}

function id(prefix) { return `${prefix}_${crypto.randomUUID()}`; }
function iso(date) { return new Date(date).toISOString(); }
function addMinutes(date, minutes) { return iso(new Date(new Date(date).getTime() + minutes * 60000)); }
function minutesBetween(later, earlier) { return Math.round((new Date(later) - new Date(earlier)) / 60000); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function seedDatabase() {
  const createdAt = iso(Date.now() - 1000 * 60 * 50);
  const simNow = iso(Date.now());
  const password = hashPassword(DEMO_PASSWORD);
  const profiles = [
    { id: 'profile-admin', authUserId: 'auth-admin', email: 'admin@demo.sanjeevani.app', name: 'Riya Kapoor', role: 'admin', entityId: 'network-1' },
    { id: 'profile-donor', authUserId: 'auth-donor', email: 'donor@demo.sanjeevani.app', name: 'Aarav Foods', role: 'donor', entityId: 'donor-1' },
    { id: 'profile-rider', authUserId: 'auth-rider', email: 'rider@demo.sanjeevani.app', name: 'Aarav Mehta', role: 'rider', entityId: 'rider-1' },
    { id: 'profile-shelter', authUserId: 'auth-shelter', email: 'shelter@demo.sanjeevani.app', name: 'Night Shelter A', role: 'shelter', entityId: 'center-1' }
  ];
  const users = profiles.map((profile) => ({ id: profile.authUserId, profileId: profile.id, password, createdAt }));
  const centers = [
    { id: 'center-1', name: 'Night Shelter A', type: 'Night shelter', lat: 18.586, lng: 73.899, address: 'Alandi Road, Pune', isOpen: true, capacity: 140, occupancy: 96, water: true, fuel: true, receivingHours: '18:00–23:30' },
    { id: 'center-2', name: 'Relief Camp 4', type: 'Emergency camp', lat: 18.575, lng: 73.902, address: 'Vishrantwadi Relief Ground', isOpen: true, capacity: 100, occupancy: 46, water: true, fuel: false, receivingHours: 'All day' },
    { id: 'center-3', name: 'Community Kitchen Hub', type: 'Community kitchen', lat: 18.601, lng: 73.913, address: 'Dighi Hills Community Hall', isOpen: true, capacity: 220, occupancy: 88, water: true, fuel: true, receivingHours: '17:00–22:30' },
    { id: 'center-4', name: 'Relief Camp 2', type: 'Medical relief camp', lat: 18.565, lng: 73.887, address: 'Yerawada Community Centre', isOpen: true, capacity: 80, occupancy: 28, water: true, fuel: false, receivingHours: 'All day' }
  ];
  const demands = [
    { id: 'demand-1', centerId: 'center-1', category: 'Cooked meals', unit: 'meals', quantity: 44, priority: 'urgent', acceptedCategories: ['Cooked meals', 'Packaged food', 'Drinking water'], updatedAt: simNow },
    { id: 'demand-2', centerId: 'center-1', category: 'Ration kits', unit: 'kits', quantity: 24, priority: 'normal', acceptedCategories: ['Ration kits', 'Groceries', 'Drinking water'], updatedAt: simNow },
    { id: 'demand-3', centerId: 'center-2', category: 'Medical supplies', unit: 'kits', quantity: 18, priority: 'urgent', acceptedCategories: ['Medical supplies', 'Drinking water'], updatedAt: simNow },
    { id: 'demand-4', centerId: 'center-3', category: 'Cooked meals', unit: 'meals', quantity: 90, priority: 'normal', acceptedCategories: ['Cooked meals', 'Packaged food', 'Groceries'], updatedAt: simNow },
    { id: 'demand-5', centerId: 'center-4', category: 'Medical supplies', unit: 'kits', quantity: 10, priority: 'normal', acceptedCategories: ['Medical supplies'], updatedAt: simNow }
  ];
  const riders = [
    { id: 'rider-1', name: 'Aarav Mehta', phone: '+91 90000 10001', vehicle: 'Scooter', capacity: 40, capacityReserved: 40, availability: 'on_delivery', lat: 18.579, lng: 73.895, lastSeenAt: simNow, reliability: 0.96, userId: 'auth-rider' },
    { id: 'rider-2', name: 'Meera Joshi', phone: '+91 90000 10002', vehicle: 'Scooter', capacity: 40, capacityReserved: 0, availability: 'available', lat: 18.589, lng: 73.906, lastSeenAt: simNow, reliability: 0.91, userId: null },
    { id: 'rider-3', name: 'Kabir Singh', phone: '+91 90000 10003', vehicle: 'Cargo bike', capacity: 80, capacityReserved: 40, availability: 'on_delivery', lat: 18.596, lng: 73.908, lastSeenAt: simNow, reliability: 0.94, userId: null },
    { id: 'rider-4', name: 'Zoya Khan', phone: '+91 90000 10004', vehicle: 'Scooter', capacity: 30, capacityReserved: 30, availability: 'on_delivery', lat: 18.583, lng: 73.898, lastSeenAt: simNow, reliability: 0.98, userId: null },
    { id: 'rider-5', name: 'Sanjay Rao', phone: '+91 90000 10005', vehicle: 'Cold-chain van', capacity: 30, capacityReserved: 0, availability: 'available', lat: 18.57, lng: 73.89, lastSeenAt: simNow, reliability: 0.89, userId: null }
  ];
  const donations = [
    { id: 'donation-1', donorId: 'donor-1', donorName: 'Banquet Hall South', title: 'Dinner service surplus', category: 'Cooked meals', quantity: 180, unit: 'meals', originalQuantity: 180, availableQuantity: 40, reservedQuantity: 80, pickedUpQuantity: 60, deliveredQuantity: 0, expiredQuantity: 0, availableAt: addMinutes(simNow, -20), safeUntil: addMinutes(simNow, 55), pickupLocation: { name: 'Banquet Hall South', address: 'Kharadi Bypass, Pune', lat: 18.575, lng: 73.91 }, storage: 'Room temperature', handling: 'Keep covered; deliver before safe-use deadline', pickupWindow: 'Ready now', notes: 'Untouched vegetarian buffet meals', status: 'partially_allocated', createdAt: createdAt, seeded: true },
    { id: 'donation-2', donorId: 'donor-2', donorName: 'City Pharmacy', title: 'Cold-chain first aid kits', category: 'Medical supplies', quantity: 12, unit: 'kits', originalQuantity: 12, availableQuantity: 12, reservedQuantity: 0, pickedUpQuantity: 0, deliveredQuantity: 0, expiredQuantity: 0, availableAt: simNow, safeUntil: addMinutes(simNow, 180), pickupLocation: { name: 'City Pharmacy', address: 'Alandi Road, Pune', lat: 18.581, lng: 73.904 }, storage: 'Refrigerated', handling: 'Maintain cold chain', pickupWindow: '20:20–20:45', notes: 'Temperature-sensitive wound care', status: 'available', createdAt: createdAt, seeded: true },
    { id: 'donation-3', donorId: 'donor-3', donorName: 'Fresh Mart', title: 'Dry ration cartons', category: 'Ration kits', quantity: 24, unit: 'kits', originalQuantity: 24, availableQuantity: 24, reservedQuantity: 0, pickedUpQuantity: 0, deliveredQuantity: 0, expiredQuantity: 0, safeUntil: addMinutes(simNow, 720), availableAt: simNow, pickupLocation: { name: 'Fresh Mart', address: 'Moshi, Pune', lat: 18.65, lng: 73.84 }, storage: 'Dry storage', handling: 'Keep dry', pickupWindow: 'Ready now', notes: 'Rice, dal, oil and spices', status: 'available', createdAt: createdAt, seeded: true },
    { id: 'donation-4', donorId: 'donor-1', donorName: 'Hostel 12 Mess', title: 'Late dinner surplus', category: 'Cooked meals', quantity: 60, unit: 'meals', originalQuantity: 60, availableQuantity: 20, reservedQuantity: 40, pickedUpQuantity: 0, deliveredQuantity: 0, expiredQuantity: 0, safeUntil: addMinutes(simNow, 7), availableAt: addMinutes(simNow, -12), pickupLocation: { name: 'Hostel 12 Mess', address: 'Alandi Campus, Pune', lat: 18.61, lng: 73.87 }, storage: 'Room temperature', handling: 'Immediate pickup required', pickupWindow: 'Ready now', notes: 'Sealed portions', status: 'partially_allocated', createdAt: createdAt, seeded: true }
  ];
  const shipments = [
    { id: 'shipment-1', donationId: 'donation-1', riderId: 'rider-1', centerId: 'center-1', quantity: 40, unit: 'meals', status: 'in_transit', offeredAt: addMinutes(simNow, -36), acceptedAt: addMinutes(simNow, -34), pickedUpAt: addMinutes(simNow, -30), inTransitAt: addMinutes(simNow, -29), etaAt: addMinutes(simNow, 18), reservationExpiresAt: null, delayMinutes: 0, safeUntil: addMinutes(simNow, 55), simulated: true },
    { id: 'shipment-2', donationId: 'donation-1', riderId: 'rider-3', centerId: 'center-3', quantity: 40, unit: 'meals', status: 'picked_up', offeredAt: addMinutes(simNow, -25), acceptedAt: addMinutes(simNow, -23), pickedUpAt: addMinutes(simNow, -20), inTransitAt: null, etaAt: addMinutes(simNow, 33), reservationExpiresAt: null, delayMinutes: 0, safeUntil: addMinutes(simNow, 55), simulated: true },
    { id: 'shipment-3', donationId: 'donation-4', riderId: 'rider-2', centerId: 'center-1', quantity: 40, unit: 'meals', status: 'offered', offeredAt: addMinutes(simNow, -2), acceptedAt: null, pickedUpAt: null, inTransitAt: null, etaAt: addMinutes(simNow, 22), reservationExpiresAt: addMinutes(simNow, 5), delayMinutes: 0, safeUntil: addMinutes(simNow, 7), simulated: true }
  ];
  const events = [
    { id: id('event'), type: 'seeded', message: 'Sanjeevani demo network initialized', actorId: 'auth-admin', createdAt: createdAt, metadata: { seeded: true } },
    { id: id('event'), type: 'shipment.in_transit', message: '40 meals are moving to Night Shelter A', actorId: 'auth-rider', createdAt: addMinutes(simNow, -2), metadata: { shipmentId: 'shipment-1', seeded: true } },
    { id: id('event'), type: 'assignment.offered', message: 'Reservation needs a check-in', actorId: 'auth-admin', createdAt: addMinutes(simNow, -4), metadata: { shipmentId: 'shipment-3', seeded: true } }
  ];
  return { version: 1, settings: { simulationNow: simNow, seedVersion: 1 }, users, profiles, centers, demands, riders, donations, shipments, events };
}

function loadDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const sourceFile = path.join(ROOT, 'data', 'sanjeevani.json');
    if (fs.existsSync(sourceFile)) {
      try {
        const content = fs.readFileSync(sourceFile, 'utf8');
        fs.writeFileSync(DB_FILE, content);
        return JSON.parse(content);
      } catch {}
    }
    const fresh = seedDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { const fresh = seedDatabase(); fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2)); return fresh; }
}

let lastDbLoadTime = Date.now();

function checkReloadDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const stats = fs.statSync(DB_FILE);
      if (stats.mtimeMs > lastDbLoadTime) {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        lastDbLoadTime = stats.mtimeMs;
      }
    } catch {}
  }
}

function persist() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  lastDbLoadTime = Date.now();
}

function createSessionToken(authUserId) {
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24;
  const payload = Buffer.from(JSON.stringify({ authUserId, expiresAt })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token) {
  if (!token) return null;
  if (sessions.has(token)) {
    const s = sessions.get(token);
    if (s && s.expiresAt > Date.now()) return s.authUserId;
  }
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.authUserId || data.expiresAt < Date.now()) return null;
    return data.authUserId;
  } catch {
    return null;
  }
}

function publicProfile(profile) { const { authUserId, ...safe } = profile; return safe; }
function userFromRequest(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/sanjeevani_session=([^;]+)/);
  if (!match) return null;
  const authUserId = verifySessionToken(match[1]);
  if (!authUserId) return null;
  return db.profiles.find((profile) => profile.authUserId === authUserId) || null;
}
function isRole(user, ...roles) { return user && roles.includes(user.role); }
function centerForUser(user) { return db.centers.find((center) => center.id === user?.entityId); }
function riderForUser(user) { return db.riders.find((rider) => rider.userId === user?.authUserId || rider.id === user?.entityId); }
function donationForUser(donation, user) { return isRole(user, 'admin') || (user?.role === 'donor' && donation.donorId === user.entityId); }
function shipmentVisible(shipment, user) { return isRole(user, 'admin') || (user?.role === 'rider' && shipment.riderId === user.entityId) || (user?.role === 'shelter' && shipment.centerId === user.entityId) || (user?.role === 'donor' && donationForUser(db.donations.find((d) => d.id === shipment.donationId), user)); }

function haversineMinutes(a, b) {
  if (!a || !b) return 30;
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const km = R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return Math.max(6, Math.round(km * 4.2));
}

function findDemand(center, category) { return db.demands.find((demand) => demand.centerId === center.id && demand.category === category && demand.quantity > 0); }
function eligibility(donation, rider, center, quantity) {
  const reasons = [];
  const demand = center && findDemand(center, donation.category);
  const pickupMinutes = haversineMinutes(rider && { lat: rider.lat, lng: rider.lng }, donation.pickupLocation);
  const deliveryMinutes = haversineMinutes(donation.pickupLocation, center && { lat: center.lat, lng: center.lng });
  const etaMinutes = pickupMinutes + deliveryMinutes + 8;
  const remainingMinutes = minutesBetween(donation.safeUntil, db.settings.simulationNow);
  if (!donation || donation.availableQuantity < quantity) reasons.push(`Only ${donation?.availableQuantity || 0} ${donation?.unit || 'units'} remain available`);
  if (!rider) reasons.push('Rider not found');
  else {
    if (rider.availability !== 'available') reasons.push(`${rider.name} is not available`);
    if (rider.capacity - rider.capacityReserved < quantity) reasons.push(`Rider capacity is ${rider.capacity - rider.capacityReserved} ${donation.unit} after existing reservations`);
    if (donation.storage === 'Refrigerated' && !rider.vehicle.toLowerCase().includes('cold')) reasons.push('Cold-chain vehicle required');
  }
  if (!center) reasons.push('Receiving center not found');
  else {
    if (!center.isOpen) reasons.push(`${center.name} is closed`);
    if (!demand) reasons.push(`${center.name} has no open demand for ${donation.category}`);
    if (demand && demand.quantity < quantity) reasons.push(`Only ${demand.quantity} ${demand.unit} of demand remains at ${center.name}`);
    if (donation.handling.toLowerCase().includes('water') && !center.water) reasons.push('Clean water dependency is not satisfied');
    if (donation.handling.toLowerCase().includes('fuel') && !center.fuel) reasons.push('Cooking fuel dependency is not satisfied');
  }
  if (etaMinutes + 10 >= remainingMinutes) reasons.push(`ETA is ${etaMinutes} minutes but only ${remainingMinutes} minutes remain before safe-use deadline`);
  return { ok: reasons.length === 0, reasons, demand, pickupMinutes, deliveryMinutes, etaMinutes };
}

function recordEvent(type, message, actorId, metadata = {}) {
  const event = { id: id('event'), type, message, actorId: actorId || null, createdAt: db.settings.simulationNow, metadata };
  db.events.unshift(event);
  db.events = db.events.slice(0, 250);
  return event;
}

function broadcast(type, payload = {}) {
  const message = `data: ${JSON.stringify({ type, ...payload })}\n\n`;
  for (const response of clients) response.write(message);
}

function commit(type, payload) { persist(); broadcast(type, payload); }

function expireOffers() {
  let changed = false;
  for (const shipment of db.shipments) {
    if (shipment.status !== 'offered' || !shipment.reservationExpiresAt) continue;
    if (new Date(shipment.reservationExpiresAt) > new Date(db.settings.simulationNow)) continue;
    releaseShipment(shipment, 'reservation.expired', 'Reservation expired automatically after no rider response');
    changed = true;
  }
  if (changed) commit('state.changed', { reason: 'reservation-expiry' });
}

function releaseShipment(shipment, type, message) {
  if (!['offered', 'reserved'].includes(shipment.status)) return false;
  const donation = db.donations.find((item) => item.id === shipment.donationId);
  const demand = db.demands.find((item) => item.centerId === shipment.centerId && item.category === donation?.category);
  const rider = db.riders.find((item) => item.id === shipment.riderId);
  if (donation) { donation.availableQuantity += shipment.quantity; donation.reservedQuantity = Math.max(0, donation.reservedQuantity - shipment.quantity); donation.status = donation.availableQuantity === donation.originalQuantity ? 'available' : 'partially_allocated'; }
  if (demand) demand.quantity += shipment.quantity;
  if (rider) { rider.capacityReserved = Math.max(0, rider.capacityReserved - shipment.quantity); if (rider.availability === 'on_assignment') rider.availability = 'available'; }
  shipment.status = type === 'reservation.expired' ? 'expired' : 'cancelled';
  shipment.releasedAt = db.settings.simulationNow;
  shipment.releaseReason = message;
  recordEvent(type, message, 'auth-admin', { shipmentId: shipment.id, quantity: shipment.quantity });
  return true;
}

function calculateMetrics() {
  const delivered = db.donations.reduce((sum, donation) => sum + donation.deliveredQuantity, 0);
  const wasted = db.donations.reduce((sum, donation) => sum + donation.expiredQuantity, 0);
  const active = db.shipments.filter((shipment) => !['delivered', 'cancelled', 'expired'].includes(shipment.status)).length;
  const attention = db.shipments.filter((shipment) => ['offered', 'delayed', 'unsafe'].includes(shipment.status)).length;
  const completed = db.shipments.filter((shipment) => shipment.status === 'delivered');
  return { activeShipments: active, needsAttention: attention, mealsRescued: delivered, unitsDelivered: delivered, unitsWasted: wasted, onTimeRate: completed.length ? Math.round(completed.filter((shipment) => !shipment.delayMinutes).length / completed.length * 100) : 100, openDemand: db.demands.reduce((sum, demand) => sum + demand.quantity, 0), totalDonations: db.donations.length, availableUnits: db.donations.reduce((sum, donation) => sum + donation.availableQuantity, 0), simulationNow: db.settings.simulationNow };
}

function stateFor(user) {
  expireOffers();
  const visibleDonations = db.donations.filter((donation) => donationForUser(donation, user));
  const visibleShipments = db.shipments.filter((shipment) => shipmentVisible(shipment, user));
  const visibleRiders = isRole(user, 'admin') ? db.riders : (user.role === 'rider' ? db.riders.filter((rider) => rider.id === user.entityId) : db.riders);
  const visibleCenters = isRole(user, 'admin') ? db.centers : (user.role === 'shelter' ? db.centers.filter((center) => center.id === user.entityId) : db.centers);
  const visibleDemands = isRole(user, 'admin') ? db.demands : (user.role === 'shelter' ? db.demands.filter((demand) => demand.centerId === user.entityId) : db.demands);
  const events = isRole(user, 'admin') ? db.events.slice(0, 50) : db.events.filter((event) => event.actorId === user.authUserId || visibleShipments.some((shipment) => event.metadata?.shipmentId === shipment.id) || visibleDonations.some((donation) => event.metadata?.donationId === donation.id)).slice(0, 30);
  return { user: publicProfile(user), donations: visibleDonations, shipments: visibleShipments, riders: visibleRiders, centers: visibleCenters, demands: visibleDemands, events, metrics: calculateMetrics(), mode: 'local-demo', supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY), demoPasswordConfigured: Boolean(process.env.DEMO_PASSWORD) };
}

async function body(req) {
  return new Promise((resolve, reject) => { let raw = ''; req.on('data', (chunk) => { raw += chunk; if (raw.length > 2_000_000) req.destroy(); }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON body')); } }); req.on('error', reject); });
}
function send(res, status, payload, headers = {}) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(payload)); }
function fail(res, status, message, details = []) { send(res, status, { error: message, details }); }
function requireUser(req, res) { const user = userFromRequest(req); if (!user) { fail(res, 401, 'Authentication required'); return null; } return user; }

async function api(req, res, pathname) {
  const method = req.method || 'GET';
  if (pathname === '/api/health') return send(res, 200, { ok: true, mode: 'local-demo', supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY), timestamp: new Date().toISOString() });
  if (pathname === '/api/config') return send(res, 200, { appName: 'Sanjeevani', tagline: 'Delivering What Matters When It Matters.', mode: 'local-demo', supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY), mapConfigured: true });
  if (pathname === '/api/auth/login' && method === 'POST') {
    try {
      const input = await body(req); const email = String(input.email || '').trim().toLowerCase(); const password = String(input.password || '');
      const profile = db.profiles.find((item) => item.email === email); const user = profile && db.users.find((item) => item.id === profile.authUserId);
      if (!user || !verifyPassword(password, user.password)) return fail(res, 401, 'Invalid email or password');
      const token = createSessionToken(user.id);
      sessions.set(token, { authUserId: user.id, expiresAt: Date.now() + 1000 * 60 * 60 * 24 });
      return send(res, 200, { user: publicProfile(profile), mode: 'local-demo' }, { 'Set-Cookie': `sanjeevani_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400` });
    } catch (error) { return fail(res, 400, error.message); }
  }
  if (pathname === '/api/auth/switch' && method === 'POST') {
    try {
      const input = await body(req);
      const targetRole = String(input.role || 'admin');
      const profile = db.profiles.find((item) => item.role === targetRole) || db.profiles[0];
      const user = db.users.find((item) => item.id === profile.authUserId);
      const token = createSessionToken(user.id);
      sessions.set(token, { authUserId: user.id, expiresAt: Date.now() + 1000 * 60 * 60 * 24 });
      recordEvent('auth.switch', `Switched active role to ${profile.role} (${profile.name})`, user.id);
      return send(res, 200, { user: publicProfile(profile), mode: 'local-demo', state: stateFor(profile) }, { 'Set-Cookie': `sanjeevani_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400` });
    } catch (error) { return fail(res, 400, error.message); }
  }
  if (pathname === '/api/auth/logout' && method === 'POST') return send(res, 200, { ok: true }, { 'Set-Cookie': 'sanjeevani_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
  if (pathname === '/api/me' && method === 'GET') { const user = userFromRequest(req); return user ? send(res, 200, { user: publicProfile(user) }) : fail(res, 401, 'Not signed in'); }
  const user = requireUser(req, res); if (!user) return;
  if (pathname === '/api/state' && method === 'GET') return send(res, 200, stateFor(user));
  if (pathname === '/api/events/stream' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`data: ${JSON.stringify({ type: 'connected', metrics: calculateMetrics() })}\n\n`); clients.add(res); req.on('close', () => clients.delete(res)); return;
  }
  if (pathname === '/api/donations' && method === 'POST') {
    if (!isRole(user, 'admin', 'donor')) return fail(res, 403, 'Only donors or administrators can create donations');
    try {
      const input = await body(req); const quantity = Number(input.quantity); const category = String(input.category || ''); const safeMinutes = Number(input.safeMinutes || 0);
      if (!input.title || !input.pickupName || !category || !Number.isFinite(quantity) || quantity <= 0) return fail(res, 422, 'Title, pickup location, category, and a positive quantity are required');
      if (['Cooked meals', 'Medical supplies'].includes(category) && (!safeMinutes || safeMinutes < 5)) return fail(res, 422, 'A safe-use window is required for cooked meals and medical supplies');
      const donorId = user.role === 'donor' ? user.entityId : String(input.donorId || 'donor-1');
      const safeUntil = addMinutes(db.settings.simulationNow, safeMinutes || 720);
      const donation = { id: id('donation'), donorId, donorName: String(input.donorName || (db.profiles.find((profile) => profile.entityId === donorId)?.name || 'Sanjeevani donor')), title: String(input.title), category, quantity, unit: String(input.unit || 'units'), originalQuantity: quantity, availableQuantity: quantity, reservedQuantity: 0, pickedUpQuantity: 0, deliveredQuantity: 0, expiredQuantity: 0, availableAt: db.settings.simulationNow, safeUntil, pickupLocation: { name: String(input.pickupName), address: String(input.pickupAddress || 'Pune / Alandi demo location'), lat: Number(input.lat || 18.59), lng: Number(input.lng || 73.9) }, storage: String(input.storage || 'Standard'), handling: String(input.handling || 'Standard handling'), pickupWindow: String(input.pickupWindow || 'Ready now'), notes: String(input.notes || ''), status: 'available', createdAt: db.settings.simulationNow, seeded: false };
      db.donations.unshift(donation); recordEvent('donation.created', `${donation.quantity} ${donation.unit} posted by ${donation.donorName}`, user.authUserId, { donationId: donation.id }); commit('donation.created', { donationId: donation.id }); return send(res, 201, { donation, state: stateFor(user) });
    } catch (error) { return fail(res, 400, error.message); }
  }
  const donationMatch = pathname.match(/^\/api\/donations\/([^/]+)$/);
  if (donationMatch && method === 'GET') { const donation = db.donations.find((item) => item.id === donationMatch[1]); if (!donation || !donationForUser(donation, user)) return fail(res, 404, 'Donation not found'); return send(res, 200, { donation, shipments: db.shipments.filter((shipment) => shipment.donationId === donation.id && shipmentVisible(shipment, user)) }); }
  const allocateMatch = pathname.match(/^\/api\/donations\/([^/]+)\/allocate$/);
  if (allocateMatch && method === 'POST') {
    if (!isRole(user, 'admin')) return fail(res, 403, 'Administrator role required for manual allocation');
    const donation = db.donations.find((item) => item.id === allocateMatch[1]); if (!donation) return fail(res, 404, 'Donation not found');
    try {
      const input = await body(req); const quantity = Number(input.quantity); const rider = db.riders.find((item) => item.id === input.riderId); const center = db.centers.find((item) => item.id === input.centerId); const check = eligibility(donation, rider, center, quantity);
      if (!check.ok) return fail(res, 422, 'No safe allocation found', check.reasons);
      const shipment = { id: id('shipment'), donationId: donation.id, riderId: rider.id, centerId: center.id, quantity, unit: donation.unit, status: 'offered', offeredAt: db.settings.simulationNow, acceptedAt: null, pickedUpAt: null, inTransitAt: null, etaAt: addMinutes(db.settings.simulationNow, check.etaMinutes), reservationExpiresAt: addMinutes(db.settings.simulationNow, Number(input.responseMinutes || 5)), delayMinutes: 0, safeUntil: donation.safeUntil, simulated: false };
      donation.availableQuantity -= quantity; donation.reservedQuantity += quantity; donation.status = donation.availableQuantity ? 'partially_allocated' : 'reserved'; rider.capacityReserved += quantity; const demand = db.demands.find((item) => item.id === check.demand.id); demand.quantity -= quantity; db.shipments.unshift(shipment); recordEvent('assignment.offered', `${quantity} ${donation.unit} offered to ${rider.name} for ${center.name}`, user.authUserId, { shipmentId: shipment.id, donationId: donation.id }); commit('shipment.created', { shipmentId: shipment.id }); return send(res, 201, { shipment, state: stateFor(user), recommendation: { pickupMinutes: check.pickupMinutes, deliveryMinutes: check.deliveryMinutes, etaMinutes: check.etaMinutes, explanation: 'Eligible: category, capacity, dependencies, and expiry window all pass.' } });
    } catch (error) { return fail(res, 400, error.message); }
  }
  const shipmentMatch = pathname.match(/^\/api\/shipments\/([^/]+)(?:\/([^/]+))?$/);
  if (shipmentMatch && method === 'POST') {
    const shipment = db.shipments.find((item) => item.id === shipmentMatch[1]); if (!shipment || !shipmentVisible(shipment, user)) return fail(res, 404, 'Shipment not found'); const action = shipmentMatch[2];
    if (!action) return fail(res, 400, 'Shipment action is required');
    const rider = db.riders.find((item) => item.id === shipment.riderId); const donation = db.donations.find((item) => item.id === shipment.donationId); const center = db.centers.find((item) => item.id === shipment.centerId);
    if (action === 'accept' || action === 'reject') { if (!(user.role === 'rider' && user.entityId === rider?.id) && !isRole(user, 'admin')) return fail(res, 403, 'Only the assigned rider or an administrator can respond'); if (shipment.status !== 'offered') return fail(res, 409, 'This offer is no longer active'); if (action === 'reject') releaseShipment(shipment, 'assignment.rejected', `${rider.name} rejected the assignment`); else { shipment.status = 'reserved'; shipment.acceptedAt = db.settings.simulationNow; shipment.reservationExpiresAt = null; recordEvent('assignment.accepted', `${rider.name} accepted ${shipment.quantity} ${shipment.unit}`, user.authUserId, { shipmentId: shipment.id }); } commit(`shipment.${action}`, { shipmentId: shipment.id }); return send(res, 200, { shipment, state: stateFor(user) }); }
    if (action === 'pickup-arrived' || action === 'picked-up' || action === 'in-transit' || action === 'delivered' || action === 'report-delay') {
      const authorizedRider = user.role === 'rider' && user.entityId === rider?.id; const authorizedCenter = user.role === 'shelter' && user.entityId === center?.id;
      if (action !== 'delivered' && !authorizedRider && !isRole(user, 'admin')) return fail(res, 403, 'Only the assigned rider or an administrator can update this shipment');
      if (action === 'delivered' && !authorizedCenter && !isRole(user, 'admin')) return fail(res, 403, 'Only the receiving center or an administrator can confirm delivery');
      if (action === 'pickup-arrived') { shipment.status = 'pickup_confirmed'; shipment.pickupArrivedAt = db.settings.simulationNow; recordEvent('shipment.pickup_arrived', `${rider.name} arrived at ${donation.pickupLocation.name}`, user.authUserId, { shipmentId: shipment.id }); }
      if (action === 'picked-up') { if (!['reserved', 'pickup_confirmed'].includes(shipment.status)) return fail(res, 409, 'Shipment must be accepted before pickup'); shipment.status = 'picked_up'; shipment.pickedUpAt = db.settings.simulationNow; donation.reservedQuantity = Math.max(0, donation.reservedQuantity - shipment.quantity); donation.pickedUpQuantity += shipment.quantity; recordEvent('shipment.picked_up', `${shipment.quantity} ${shipment.unit} collected from ${donation.pickupLocation.name}`, user.authUserId, { shipmentId: shipment.id }); }
      if (action === 'in-transit') { if (shipment.status !== 'picked_up') return fail(res, 409, 'Mark pickup complete first'); shipment.status = 'in_transit'; shipment.inTransitAt = db.settings.simulationNow; rider.availability = 'on_delivery'; recordEvent('shipment.in_transit', `${shipment.quantity} ${shipment.unit} are in transit to ${center.name}`, user.authUserId, { shipmentId: shipment.id }); }
      if (action === 'delivered') { if (!['in_transit', 'picked_up'].includes(shipment.status)) return fail(res, 409, 'Shipment is not ready to be delivered'); shipment.status = 'delivered'; shipment.deliveredAt = db.settings.simulationNow; shipment.receivedQuantity = shipment.quantity; donation.deliveredQuantity += shipment.quantity; rider.capacityReserved = Math.max(0, rider.capacityReserved - shipment.quantity); rider.availability = 'available'; recordEvent('shipment.delivered', `${shipment.quantity} ${shipment.unit} received by ${center.name}`, user.authUserId, { shipmentId: shipment.id }); }
      if (action === 'report-delay') { const input = await body(req); const delay = clamp(Number(input.delayMinutes || 10), 1, 240); shipment.delayMinutes = delay; shipment.etaAt = addMinutes(shipment.etaAt, delay); shipment.status = 'delayed'; recordEvent('shipment.delayed', `${rider.name} reported a ${delay}-minute delay`, user.authUserId, { shipmentId: shipment.id, delayMinutes: delay }); }
      commit(`shipment.${action}`, { shipmentId: shipment.id }); return send(res, 200, { shipment, state: stateFor(user) });
    }
    return fail(res, 400, 'Unsupported shipment action');
  }
  const centerMatch = pathname.match(/^\/api\/centers\/([^/]+)(?:\/([^/]+))?$/);
  if (centerMatch && method === 'POST') {
    const center = db.centers.find((item) => item.id === centerMatch[1]); if (!center) return fail(res, 404, 'Receiving center not found'); if (!(isRole(user, 'admin') || (user.role === 'shelter' && user.entityId === center.id))) return fail(res, 403, 'You can only update your own receiving center');
    const action = centerMatch[2]; const input = await body(req);
    if (action === 'status') { center.isOpen = Boolean(input.isOpen); recordEvent('center.status_changed', `${center.name} is now ${center.isOpen ? 'open' : 'closed'}`, user.authUserId, { centerId: center.id }); if (!center.isOpen) reassessCenter(center); }
    else if (action === 'demand') { const demand = db.demands.find((item) => item.id === input.demandId || (item.centerId === center.id && item.category === input.category)); if (!demand) return fail(res, 404, 'Demand line not found'); const quantity = Number(input.quantity); if (!Number.isFinite(quantity) || quantity < 0) return fail(res, 422, 'Demand quantity must be zero or greater'); const delta = quantity - demand.quantity; demand.quantity = quantity; demand.updatedAt = db.settings.simulationNow; recordEvent('demand.updated', `${center.name} changed ${demand.category} demand to ${quantity} ${demand.unit}`, user.authUserId, { centerId: center.id, demandId: demand.id, delta }); if (delta < 0) reassessCenter(center); }
    else if (action === 'capacity') { const capacity = Number(input.capacity); if (!Number.isFinite(capacity) || capacity < center.occupancy) return fail(res, 422, 'Capacity cannot be below current occupancy'); center.capacity = capacity; recordEvent('center.capacity_changed', `${center.name} capacity updated to ${capacity}`, user.authUserId, { centerId: center.id }); }
    else return fail(res, 400, 'Unsupported center action');
    commit(`center.${action}`, { centerId: center.id }); return send(res, 200, { center, state: stateFor(user) });
  }
  if (pathname === '/api/riders/me' && method === 'POST') {
    if (!isRole(user, 'rider')) return fail(res, 403, 'Rider role required'); const rider = riderForUser(user); const input = await body(req); if (!rider) return fail(res, 404, 'Rider profile not found'); if (input.availability) rider.availability = String(input.availability); if (input.lat !== undefined) rider.lat = Number(input.lat); if (input.lng !== undefined) rider.lng = Number(input.lng); rider.lastSeenAt = db.settings.simulationNow; recordEvent('rider.updated', `${rider.name} updated availability or simulated location`, user.authUserId, { riderId: rider.id }); commit('rider.updated', { riderId: rider.id }); return send(res, 200, { rider, state: stateFor(user) });
  }
  if (pathname === '/api/admin/allocate-best' && method === 'POST') {
    if (!isRole(user, 'admin')) return fail(res, 403, 'Administrator role required'); const input = await body(req); const donation = db.donations.find((item) => item.id === input.donationId); if (!donation) return fail(res, 404, 'Donation not found'); const result = autoDispatch(donation, user.authUserId); if (!result.created.length) return fail(res, 422, 'No feasible match found', result.reasons); commit('dispatch.recalculated', { donationId: donation.id, created: result.created.map((shipment) => shipment.id) }); return send(res, 200, { ...result, state: stateFor(user) });
  }
  if (pathname === '/api/admin/scenario' && method === 'POST') {
    const input = await body(req);
    const scenarioName = String(input.scenario || '');
    if (!isRole(user, 'admin') && !['movement', 'advance-time'].includes(scenarioName)) {
      return fail(res, 403, 'Administrator role required');
    }
    const result = runScenario(scenarioName, user.authUserId);
    if (result.error) return fail(res, result.status || 422, result.error, result.details || []);
    commit('scenario.completed', { scenario: scenarioName });
    return send(res, 200, { ...result, state: stateFor(user) });
  }
  return fail(res, 404, 'API route not found');
}

function reassessCenter(center) {
  for (const shipment of db.shipments.filter((item) => item.centerId === center.id && ['offered', 'reserved'].includes(item.status))) releaseShipment(shipment, 'allocation.released', `${center.name} changed status or demand; unpicked allocation released`);
  for (const shipment of db.shipments.filter((item) => item.centerId === center.id && ['in_transit', 'picked_up'].includes(item.status))) {
    const donation = db.donations.find((item) => item.id === shipment.donationId); const fallback = findFallback(donation, shipment.quantity, center.id, shipment.riderId);
    if (fallback) { shipment.centerId = fallback.center.id; shipment.status = 'rerouted'; shipment.etaAt = addMinutes(db.settings.simulationNow, fallback.check.etaMinutes); recordEvent('shipment.rerouted', `${center.name} is unavailable; shipment rerouted to ${fallback.center.name}`, 'auth-admin', { shipmentId: shipment.id, fromCenterId: center.id, toCenterId: fallback.center.id }); }
    else { shipment.status = 'attention'; recordEvent('shipment.attention', `${center.name} is unavailable and no safe fallback was found`, 'auth-admin', { shipmentId: shipment.id }); }
  }
}
function findFallback(donation, quantity, excludedCenterId, riderId) {
  const rider = db.riders.find((item) => item.id === riderId);
  const candidates = db.centers.filter((center) => center.id !== excludedCenterId).map((center) => ({ center, check: eligibility(donation, rider, center, quantity) })).filter((candidate) => candidate.check.ok).sort((a, b) => a.check.etaMinutes - b.check.etaMinutes);
  return candidates[0];
}
function autoDispatch(donation, actorId) {
  const created = []; const reasons = [];
  const riders = db.riders.filter((rider) => rider.availability === 'available').sort((a, b) => b.reliability - a.reliability);
  const centers = db.centers.filter((center) => center.isOpen);
  let remaining = donation.availableQuantity;
  for (const rider of riders) {
    if (remaining <= 0) break;
    for (const center of centers) {
      if (remaining <= 0) break;
      const demand = findDemand(center, donation.category); if (!demand) continue;
      const quantity = Math.min(remaining, rider.capacity - rider.capacityReserved, demand.quantity);
      if (quantity <= 0) continue;
      const check = eligibility(donation, rider, center, quantity); if (!check.ok) { reasons.push(...check.reasons); continue; }
      const shipment = { id: id('shipment'), donationId: donation.id, riderId: rider.id, centerId: center.id, quantity, unit: donation.unit, status: 'offered', offeredAt: db.settings.simulationNow, acceptedAt: null, pickedUpAt: null, inTransitAt: null, etaAt: addMinutes(db.settings.simulationNow, check.etaMinutes), reservationExpiresAt: addMinutes(db.settings.simulationNow, 5), delayMinutes: 0, safeUntil: donation.safeUntil, simulated: false };
      donation.availableQuantity -= quantity; donation.reservedQuantity += quantity; donation.status = donation.availableQuantity ? 'partially_allocated' : 'reserved'; rider.capacityReserved += quantity; demand.quantity -= quantity; db.shipments.unshift(shipment); created.push(shipment); remaining -= quantity; recordEvent('assignment.offered', `Auto-match offered ${quantity} ${donation.unit} to ${rider.name}`, actorId, { shipmentId: shipment.id, donationId: donation.id });
    }
  }
  if (!created.length && !reasons.length) reasons.push('No available rider, eligible demand, or safe route was found');
  return { created, remaining: donation.availableQuantity, reasons: [...new Set(reasons)].slice(0, 8) };
}

function runScenario(scenario, actorId) {
  if (scenario === 'reset') { db = seedDatabase(); return { message: 'Demo reset to the seeded network.', state: stateFor(db.profiles.find((profile) => profile.role === 'admin')) }; }
  if (scenario === 'advance-time') { db.settings.simulationNow = addMinutes(db.settings.simulationNow, 10); expireOffers(); recordEvent('simulation.advanced', 'Simulation clock advanced by 10 minutes', actorId, { minutes: 10 }); return { message: 'Simulation clock advanced by 10 minutes.' }; }
  if (scenario === 'urgent') { const donation = { id: id('donation'), donorId: 'donor-1', donorName: 'Banquet Hall South', title: 'Urgent 180-meal demo batch', category: 'Cooked meals', quantity: 180, unit: 'meals', originalQuantity: 180, availableQuantity: 180, reservedQuantity: 0, pickedUpQuantity: 0, deliveredQuantity: 0, expiredQuantity: 0, availableAt: db.settings.simulationNow, safeUntil: addMinutes(db.settings.simulationNow, 35), pickupLocation: { name: 'Banquet Hall South', address: 'Kharadi Bypass, Pune', lat: 18.575, lng: 73.91 }, storage: 'Room temperature', handling: 'Immediate pickup required', pickupWindow: 'Ready now', notes: 'Created by Scenario Lab', status: 'available', createdAt: db.settings.simulationNow, seeded: false }; db.donations.unshift(donation); recordEvent('scenario.urgent_created', 'Urgent 180-meal batch created for scenario testing', actorId, { donationId: donation.id }); return { message: 'Urgent 180-meal batch created.', donation }; }
  if (scenario === 'split') { let donation = db.donations.find((item) => item.title === 'Urgent 180-meal demo batch' && item.availableQuantity > 0); if (!donation) { const created = runScenario('urgent', actorId); donation = created.donation; } const result = autoDispatch(donation, actorId); return { message: `Batch split into ${result.created.length} safe rider-sized allocation(s).`, ...result }; }
  if (scenario === 'no-show') { const shipment = db.shipments.find((item) => item.status === 'offered'); if (!shipment) return { error: 'No active offered reservation is available to expire.' }; releaseShipment(shipment, 'reservation.expired', 'Scenario Lab expired the rider offer after a no-show'); return { message: 'Rider offer expired; reserved quantity returned to the open pool.', shipmentId: shipment.id }; }
  if (scenario === 'closure') { const center = db.centers.find((item) => item.id === 'center-1'); center.isOpen = false; reassessCenter(center); recordEvent('scenario.center_closed', `${center.name} closed mid-operation`, actorId, { centerId: center.id }); return { message: `${center.name} closed. Unpicked work was released and in-transit work was reassessed.` }; }
  if (scenario === 'demand-reduction') { const demand = db.demands.find((item) => item.centerId === 'center-1' && item.category === 'Cooked meals'); demand.quantity = Math.max(0, demand.quantity - 20); reassessCenter(db.centers.find((item) => item.id === demand.centerId)); recordEvent('scenario.demand_reduced', 'Shelter demand reduced by 20 meals during operation', actorId, { demandId: demand.id }); return { message: 'Shelter demand reduced by 20 meals and affected unpicked allocations reassessed.' }; }
  if (scenario === 'delay') { const shipment = db.shipments.find((item) => item.status === 'in_transit'); if (!shipment) return { error: 'No in-transit shipment is available to delay.' }; shipment.delayMinutes = 25; shipment.etaAt = addMinutes(shipment.etaAt, 25); shipment.status = 'delayed'; recordEvent('scenario.route_delay', 'A 25-minute simulated route delay was reported', actorId, { shipmentId: shipment.id }); return { message: 'Route delay recorded; ETA and attention state updated.', shipmentId: shipment.id }; }
  if (scenario === 'movement') { const rider = db.riders.find((item) => item.id === 'rider-1'); rider.lat += 0.003; rider.lng += 0.002; rider.lastSeenAt = db.settings.simulationNow; recordEvent('scenario.rider_movement', `${rider.name} moved on the simulated map`, actorId, { riderId: rider.id }); return { message: 'Rider movement simulated on the map.', riderId: rider.id }; }
  return { error: 'Unknown scenario.' };
}

function serveStatic(req, res, pathname) {
  let relative = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  if (relative.includes('..')) return fail(res, 400, 'Invalid path');
  let file = path.join(ROOT, relative);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(ROOT, 'public', relative);
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return fail(res, 404, 'File not found');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(file).pipe(res);
}

async function handleRequest(req, res) {
  try {
    checkReloadDb();
    const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (parsed.pathname.startsWith('/api/')) return await api(req, res, parsed.pathname);
    return serveStatic(req, res, parsed.pathname);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) fail(res, 500, 'Unexpected server error');
  }
}

const server = http.createServer(handleRequest);

if (!process.env.VERCEL) {
  setInterval(() => expireOffers(), 5000);
  server.listen(PORT, () => console.log(`Sanjeevani server running at http://localhost:${PORT}`));
}

module.exports = handleRequest;
module.exports.server = server;
