-- Sanjeevani shared civic micro-logistics schema.
-- Apply in Supabase SQL editor or with the Supabase CLI.

create extension if not exists "pgcrypto";

create type public.app_role as enum ('admin', 'donor', 'rider', 'shelter');
create type public.donation_status as enum ('available', 'partially_allocated', 'reserved', 'picked_up', 'delivered', 'expired', 'cancelled');
create type public.shipment_status as enum ('offered', 'reserved', 'pickup_confirmed', 'picked_up', 'in_transit', 'delayed', 'rerouted', 'delivered', 'expired', 'cancelled', 'attention');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role public.app_role not null,
  entity_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receiving_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  center_type text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  is_open boolean not null default true,
  capacity integer not null check (capacity >= 0),
  occupancy integer not null default 0 check (occupancy >= 0),
  water_available boolean not null default true,
  fuel_available boolean not null default true,
  receiving_hours text not null default 'All day',
  created_at timestamptz not null default now()
);

create table if not exists public.demands (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.receiving_centers(id) on delete cascade,
  category text not null,
  unit text not null,
  quantity integer not null default 0 check (quantity >= 0),
  priority text not null default 'normal',
  accepted_categories text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique(center_id, category)
);

create table if not exists public.riders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  phone text,
  vehicle text not null,
  capacity integer not null check (capacity > 0),
  capacity_reserved integer not null default 0 check (capacity_reserved >= 0),
  availability text not null default 'available',
  lat double precision,
  lng double precision,
  last_seen_at timestamptz,
  reliability numeric(5,4) not null default 0.8 check (reliability between 0 and 1),
  created_at timestamptz not null default now()
);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  donor_user_id uuid references auth.users(id) on delete set null,
  donor_name text not null,
  title text not null,
  category text not null,
  quantity integer not null check (quantity > 0),
  unit text not null,
  original_quantity integer not null check (original_quantity > 0),
  available_quantity integer not null default 0 check (available_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  picked_up_quantity integer not null default 0 check (picked_up_quantity >= 0),
  delivered_quantity integer not null default 0 check (delivered_quantity >= 0),
  expired_quantity integer not null default 0 check (expired_quantity >= 0),
  available_at timestamptz not null default now(),
  safe_until timestamptz,
  pickup_location jsonb not null,
  storage text not null default 'Standard',
  handling text not null default 'Standard handling',
  pickup_window text,
  notes text,
  status public.donation_status not null default 'available',
  seeded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete cascade,
  rider_id uuid references public.riders(id) on delete set null,
  center_id uuid references public.receiving_centers(id) on delete set null,
  quantity integer not null check (quantity > 0),
  unit text not null,
  status public.shipment_status not null default 'offered',
  offered_at timestamptz,
  accepted_at timestamptz,
  pickup_arrived_at timestamptz,
  picked_up_at timestamptz,
  in_transit_at timestamptz,
  eta_at timestamptz,
  reservation_expires_at timestamptz,
  delay_minutes integer not null default 0,
  safe_until timestamptz,
  received_quantity integer,
  release_reason text,
  simulated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid references public.shipments(id) on delete set null,
  reported_by uuid references auth.users(id) on delete set null,
  incident_type text not null,
  details text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists donations_status_idx on public.donations(status, safe_until);
create index if not exists shipments_status_idx on public.shipments(status, reservation_expires_at);
create index if not exists shipments_center_idx on public.shipments(center_id, status);
create index if not exists shipments_rider_idx on public.shipments(rider_id, status);
create index if not exists events_created_idx on public.activity_events(created_at desc);

create or replace function public.current_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

alter table public.profiles enable row level security;
alter table public.receiving_centers enable row level security;
alter table public.demands enable row level security;
alter table public.riders enable row level security;
alter table public.donations enable row level security;
alter table public.shipments enable row level security;
alter table public.activity_events enable row level security;
alter table public.incidents enable row level security;

create policy "profiles can read their own profile" on public.profiles for select using (id = auth.uid() or public.current_role() = 'admin');
create policy "authenticated users can read centers" on public.receiving_centers for select to authenticated using (true);
create policy "centers can update themselves" on public.receiving_centers for update using (public.current_role() = 'admin' or (public.current_role() = 'shelter' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.entity_id = receiving_centers.id::text)));
create policy "authenticated users can read demands" on public.demands for select to authenticated using (true);
create policy "admins and owning shelters can update demand" on public.demands for update using (public.current_role() = 'admin' or (public.current_role() = 'shelter' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.entity_id = demands.center_id::text)));
create policy "authenticated users can read riders" on public.riders for select to authenticated using (true);
create policy "riders update themselves or admins update riders" on public.riders for update using (public.current_role() = 'admin' or user_id = auth.uid());
create policy "donors create donations" on public.donations for insert to authenticated with check (public.current_role() in ('admin', 'donor'));
create policy "donors read own donations and admins read all" on public.donations for select to authenticated using (public.current_role() = 'admin' or donor_user_id = auth.uid());
create policy "donors update own donations before pickup" on public.donations for update using (public.current_role() = 'admin' or (donor_user_id = auth.uid() and status in ('available', 'partially_allocated')));
create policy "authorized users read shipments" on public.shipments for select to authenticated using (public.current_role() = 'admin' or rider_id in (select id from public.riders where user_id = auth.uid()) or center_id::text in (select entity_id from public.profiles where id = auth.uid()) or donation_id in (select id from public.donations where donor_user_id = auth.uid()));
create policy "admins create shipments" on public.shipments for insert to authenticated with check (public.current_role() = 'admin');
create policy "assigned parties update shipments" on public.shipments for update using (public.current_role() = 'admin' or rider_id in (select id from public.riders where user_id = auth.uid()) or center_id::text in (select entity_id from public.profiles where id = auth.uid()));
create policy "authorized users read events" on public.activity_events for select to authenticated using (public.current_role() = 'admin' or actor_id = auth.uid());
create policy "authenticated users create events" on public.activity_events for insert to authenticated with check (actor_id = auth.uid() or public.current_role() = 'admin');
create policy "authorized users read incidents" on public.incidents for select to authenticated using (public.current_role() = 'admin' or reported_by = auth.uid());
create policy "authenticated users report incidents" on public.incidents for insert to authenticated with check (reported_by = auth.uid());
