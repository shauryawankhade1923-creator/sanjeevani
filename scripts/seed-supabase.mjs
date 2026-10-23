import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DEMO_PASSWORD) {
  console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and DEMO_PASSWORD in .env before running this script.');
  process.exit(1);
}

const accounts = [
  { email: 'admin@demo.sanjeevani.app', name: 'Riya Kapoor', role: 'admin', entity_id: 'network-1' },
  { email: 'donor@demo.sanjeevani.app', name: 'Aarav Foods', role: 'donor', entity_id: 'donor-1' },
  { email: 'rider@demo.sanjeevani.app', name: 'Aarav Mehta', role: 'rider', entity_id: 'rider-1' },
  { email: 'shelter@demo.sanjeevani.app', name: 'Night Shelter A', role: 'shelter', entity_id: 'center-1' }
];

async function request(pathname, options = {}) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}${pathname}`, { ...options, headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

for (const account of accounts) {
  let user;
  try { user = await request('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email: account.email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { full_name: account.name, role: account.role } }) }); }
  catch (error) {
    if (!String(error.message).includes('already been registered') && !String(error.message).includes('already exists')) throw error;
    const users = await request('/auth/v1/admin/users?per_page=100'); user = users.users?.find((candidate) => candidate.email === account.email);
  }
  await request('/rest/v1/profiles?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: user.id, full_name: account.name, email: account.email, role: account.role, entity_id: account.entity_id }) });
  console.log(`Seeded ${account.role}: ${account.email}`);
}

console.log('Supabase Auth accounts and profiles are ready. Apply the migration and seed center/rider/demo records next.');
