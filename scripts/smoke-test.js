const base = 'http://localhost:4173';

async function login(email) {
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: process.env.DEMO_PASSWORD || 'SanjeevaniDemo!2026' }) });
  if (!response.ok) throw new Error(`login failed for ${email}: ${response.status}`);
  return { cookie: response.headers.get('set-cookie')?.split(';')[0], payload: await response.json() };
}

async function request(session, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, { ...options, headers: { 'content-type': 'application/json', Cookie: session.cookie, ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

(async () => {
  const admin = await login('admin@demo.sanjeevani.app');
  const donor = await login('donor@demo.sanjeevani.app');
  const rider = await login('rider@demo.sanjeevani.app');
  const initial = await request(admin, '/api/state');
  if (!initial.response.ok || initial.payload.user.role !== 'admin') throw new Error('admin state did not load');
  const created = await request(donor, '/api/donations', { method: 'POST', body: JSON.stringify({ title: 'Smoke test aid', category: 'Cooked meals', quantity: 10, unit: 'meals', safeMinutes: 90, pickupName: 'Smoke Kitchen', pickupAddress: 'Alandi, Pune' }) });
  if (created.response.status !== 201) throw new Error(`donation creation failed: ${JSON.stringify(created.payload)}`);
  const donationId = created.payload.donation.id;
  const adminAfter = await request(admin, '/api/state');
  if (!adminAfter.payload.donations.some((donation) => donation.id === donationId)) throw new Error('admin did not see donor donation in shared state');
  const forbidden = await request(rider, '/api/admin/scenario', { method: 'POST', body: JSON.stringify({ scenario: 'reset' }) });
  if (forbidden.response.status !== 403) throw new Error(`role protection failed: ${forbidden.response.status}`);
  const scenario = await request(admin, '/api/admin/scenario', { method: 'POST', body: JSON.stringify({ scenario: 'urgent' }) });
  if (!scenario.response.ok) throw new Error(`urgent scenario failed: ${JSON.stringify(scenario.payload)}`);
  console.log('Sanjeevani smoke test passed: auth, shared donation, role protection, and scenario mutation.');
})().catch((error) => { console.error(error.message); process.exit(1); });
