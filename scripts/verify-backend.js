const http = require('http');

const base = process.env.BASE_URL || 'http://localhost:4173';
console.log(`\n======================================================`);
console.log(`🔍 RUNNING FULL SANJEEVANI BACKEND AUDIT ON: ${base}`);
console.log(`======================================================\n`);

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  } else {
    passedTests++;
    console.log(`✅ PASS: ${message}`);
  }
}

async function request(pathname, options = {}, cookie = '') {
  const url = `${base}${pathname}`;
  const headers = {
    'content-type': 'application/json',
    ...(cookie ? { Cookie: cookie } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch {}
  const setCookie = res.headers.get('set-cookie')?.split(';')[0];
  return { status: res.status, headers: res.headers, cookie: setCookie, data: json, raw: text };
}

(async () => {
  // 1. Health & Config Checks
  console.log('--- TEST GROUP 1: Health & Public Endpoints ---');
  const health = await request('/api/health');
  assert(health.status === 200 && health.data.ok === true, 'GET /api/health returns 200 OK');

  const config = await request('/api/config');
  assert(config.status === 200 && config.data.appName === 'Sanjeevani', 'GET /api/config returns 200 and app metadata');

  // 2. Authentication Checks
  console.log('\n--- TEST GROUP 2: Authentication & Session Security ---');
  const badLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@demo.sanjeevani.app', password: 'WrongPassword123' })
  });
  assert(badLogin.status === 401, 'POST /api/auth/login rejects invalid credentials with 401');

  const adminAuth = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@demo.sanjeevani.app', password: process.env.DEMO_PASSWORD || 'SanjeevaniDemo!2026' })
  });
  assert(adminAuth.status === 200 && adminAuth.data.user?.role === 'admin', 'Admin login successful and returns role');
  assert(!!adminAuth.cookie && adminAuth.cookie.startsWith('sanjeevani_session='), 'Admin session cookie issued');
  const adminCookie = adminAuth.cookie;

  const donorAuth = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'donor@demo.sanjeevani.app', password: process.env.DEMO_PASSWORD || 'SanjeevaniDemo!2026' })
  });
  assert(donorAuth.status === 200 && donorAuth.data.user?.role === 'donor', 'Donor login successful');
  const donorCookie = donorAuth.cookie;

  const riderAuth = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'rider@demo.sanjeevani.app', password: process.env.DEMO_PASSWORD || 'SanjeevaniDemo!2026' })
  });
  assert(riderAuth.status === 200 && riderAuth.data.user?.role === 'rider', 'Rider login successful');
  const riderCookie = riderAuth.cookie;

  const shelterAuth = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'shelter@demo.sanjeevani.app', password: process.env.DEMO_PASSWORD || 'SanjeevaniDemo!2026' })
  });
  assert(shelterAuth.status === 200 && shelterAuth.data.user?.role === 'shelter', 'Shelter login successful');
  const shelterCookie = shelterAuth.cookie;

  // 3. Workspace Role Switcher
  console.log('\n--- TEST GROUP 3: 1-Click Workspace Role Switcher ---');
  const switched = await request('/api/auth/switch', {
    method: 'POST',
    body: JSON.stringify({ role: 'rider' })
  }, adminCookie);
  assert(switched.status === 200 && switched.data.user?.role === 'rider', 'POST /api/auth/switch successfully switches session role to rider');

  // 4. Role Authorization Walls
  console.log('\n--- TEST GROUP 4: Role-Based Authorization Walls ---');
  const unauthorizedScenario = await request('/api/admin/scenario', {
    method: 'POST',
    body: JSON.stringify({ scenario: 'reset' })
  }, riderCookie);
  assert(unauthorizedScenario.status === 403, 'Rider is strictly forbidden from running admin scenarios (403)');

  const unauthorizedDonation = await request('/api/donations', {
    method: 'POST',
    body: JSON.stringify({ title: 'Rider food', category: 'Cooked meals', quantity: 20 })
  }, riderCookie);
  assert(unauthorizedDonation.status === 403, 'Rider cannot create donations (403)');

  // 5. Donation Lifecycle & Safety Constraints
  console.log('\n--- TEST GROUP 5: Donation Creation & Safe-Use Window ---');
  const invalidDonation = await request('/api/donations', {
    method: 'POST',
    body: JSON.stringify({ title: 'No safe window', category: 'Cooked meals', quantity: 25, pickupName: 'Mess' })
  }, donorCookie);
  assert(invalidDonation.status === 422, 'Cooked meals require safe-use window (422)');

  const validDonation = await request('/api/donations', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Full Audit Test Meal Batch',
      category: 'Cooked meals',
      quantity: 30,
      unit: 'meals',
      safeMinutes: 80,
      pickupName: 'Audit Central Kitchen',
      pickupAddress: 'Alandi Campus, Pune',
      lat: 18.61,
      lng: 73.87,
      storage: 'Room temperature',
      handling: 'Keep covered'
    })
  }, donorCookie);
  assert(validDonation.status === 201 && validDonation.data.donation?.id, 'Donation created successfully by donor (201)');
  const testDonationId = validDonation.data.donation.id;

  // 6. Shared State Synchronization
  console.log('\n--- TEST GROUP 6: Realtime Shared State Visibility ---');
  const adminState = await request('/api/state', {}, adminCookie);
  assert(adminState.status === 200, 'GET /api/state returns 200 for Admin');
  const seenDonation = adminState.data.donations.find((d) => d.id === testDonationId);
  assert(!!seenDonation && seenDonation.availableQuantity === 30, 'Admin sees newly created donation in shared state');

  // 7. Allocation Engine
  console.log('\n--- TEST GROUP 7: Safety-First Allocation Engine ---');
  const matchResult = await request('/api/admin/allocate-best', {
    method: 'POST',
    body: JSON.stringify({ donationId: testDonationId })
  }, adminCookie);
  assert(matchResult.status === 200 && matchResult.data.created?.length > 0, 'Auto-match successfully created safe allocation');
  const createdShipment = matchResult.data.created[0];
  const testShipmentId = createdShipment.id;

  // 8. Complete Chain-of-Custody Lifecycle
  console.log('\n--- TEST GROUP 8: Shipment Lifecycle Transitions ---');
  // Identify assigned rider
  const assignedRider = createdShipment.riderId;
  const assignedCookie = (assignedRider === 'rider-1') ? riderCookie : adminCookie;

  // A. Accept
  const acceptRes = await request(`/api/shipments/${testShipmentId}/accept`, { method: 'POST', body: '{}' }, assignedCookie);
  assert(acceptRes.status === 200 && acceptRes.data.shipment.status === 'reserved', 'Shipment accepted -> reserved');

  // B. Arrived at pickup
  const arrivedRes = await request(`/api/shipments/${testShipmentId}/pickup-arrived`, { method: 'POST', body: '{}' }, assignedCookie);
  assert(arrivedRes.status === 200 && arrivedRes.data.shipment.status === 'pickup_confirmed', 'Rider arrived at pickup -> pickup_confirmed');

  // C. Picked up
  const pickupRes = await request(`/api/shipments/${testShipmentId}/picked-up`, { method: 'POST', body: '{}' }, assignedCookie);
  assert(pickupRes.status === 200 && pickupRes.data.shipment.status === 'picked_up', 'Cargo collected -> picked_up');

  // D. In transit
  const transitRes = await request(`/api/shipments/${testShipmentId}/in-transit`, { method: 'POST', body: '{}' }, assignedCookie);
  assert(transitRes.status === 200 && transitRes.data.shipment.status === 'in_transit', 'Trip started -> in_transit');

  // E. Report delay
  const delayRes = await request(`/api/shipments/${testShipmentId}/report-delay`, {
    method: 'POST',
    body: JSON.stringify({ delayMinutes: 15 })
  }, assignedCookie);
  assert(delayRes.status === 200 && delayRes.data.shipment.status === 'delayed', 'Delay reported (+15m) -> delayed');

  // F. Delivered (confirmed by receiving shelter or admin)
  const deliverRes = await request(`/api/shipments/${testShipmentId}/delivered`, { method: 'POST', body: '{}' }, adminCookie);
  assert(deliverRes.status === 200 && deliverRes.data.shipment.status === 'delivered', 'Handoff confirmed -> delivered');

  // 9. Rider GPS Telemetry Updates
  console.log('\n--- TEST GROUP 9: Rider GPS Telemetry & Availability ---');
  const riderGps = await request('/api/riders/me', {
    method: 'POST',
    body: JSON.stringify({ lat: 18.583, lng: 73.899, availability: 'available' })
  }, riderCookie);
  assert(riderGps.status === 200 && riderGps.data.rider.lat === 18.583, 'POST /api/riders/me updates rider coordinates and availability');

  // 10. Shelter Status & Demand Controls
  console.log('\n--- TEST GROUP 10: Receiving Shelter Management ---');
  const demandUpdate = await request('/api/centers/center-1/demand', {
    method: 'POST',
    body: JSON.stringify({ category: 'Cooked meals', quantity: 50 })
  }, shelterCookie);
  assert(demandUpdate.status === 200, 'POST /api/centers/:id/demand updates open shelter need');

  const statusUpdate = await request('/api/centers/center-1/status', {
    method: 'POST',
    body: JSON.stringify({ isOpen: true })
  }, shelterCookie);
  assert(statusUpdate.status === 200 && statusUpdate.data.center.isOpen === true, 'POST /api/centers/:id/status updates center open status');

  // 11. Scenario Lab Mutations
  console.log('\n--- TEST GROUP 11: Scenario Lab (Chaos Testing) ---');
  const advanceClock = await request('/api/admin/scenario', {
    method: 'POST',
    body: JSON.stringify({ scenario: 'advance-time' })
  }, adminCookie);
  assert(advanceClock.status === 200, 'Scenario: advance-time executed');

  const urgentBatch = await request('/api/admin/scenario', {
    method: 'POST',
    body: JSON.stringify({ scenario: 'urgent' })
  }, adminCookie);
  assert(urgentBatch.status === 200 && urgentBatch.data.donation?.title.includes('Urgent'), 'Scenario: urgent batch created');

  // 12. Session Logout
  console.log('\n--- TEST GROUP 12: Session Termination ---');
  const logoutRes = await request('/api/auth/logout', { method: 'POST' }, adminCookie);
  assert(logoutRes.status === 200 && logoutRes.data.ok === true, 'POST /api/auth/logout terminates session');

  console.log(`\n======================================================`);
  console.log(`🎉 ALL ${totalTests} BACKEND AUDIT CHECKS PASSED WITH 100% SUCCESS!`);
  console.log(`======================================================\n`);
})().catch((err) => {
  console.error('\n❌ AUDIT FAILED:', err.message);
  process.exit(1);
});
