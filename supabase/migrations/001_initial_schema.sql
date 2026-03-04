-- Axon Supabase schema v1
-- Migrates static JSON files and file-backed persistence to Supabase tables.

-- ============================================================================
-- 1. questionnaires
-- ============================================================================

create table questionnaires (
  id uuid primary key default gen_random_uuid(),
  provider_type text not null unique,
  version text not null default '1.0.0',
  display_name text not null,
  is_meta boolean not null default false,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_questionnaires_provider_type on questionnaires(provider_type);

-- ============================================================================
-- 2. taxonomy_versions
-- ============================================================================

create table taxonomy_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  effective_date date not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 3. registry_entries
-- ============================================================================

create table registry_entries (
  npi text primary key,
  entity_type text not null check (entity_type in ('individual', 'organization')),
  name text not null,
  credential_status text not null default 'pending',
  data jsonb not null,
  registered_at timestamptz not null default now(),
  last_updated timestamptz not null default now()
);

create index idx_registry_entity_type on registry_entries(entity_type);
create index idx_registry_credential_status on registry_entries(credential_status);
create index idx_registry_name on registry_entries using gin (to_tsvector('english', name));

-- ============================================================================
-- 4. neuron_tokens
-- ============================================================================

create table neuron_tokens (
  token text primary key,
  registration_id text not null unique,
  neuron_npi text not null references registry_entries(npi),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 5. onboarding_flows
-- ============================================================================

create table onboarding_flows (
  id uuid primary key default gen_random_uuid(),
  target_type text not null unique,
  steps jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 6. Row-Level Security
-- ============================================================================

alter table questionnaires enable row level security;
alter table taxonomy_versions enable row level security;
alter table registry_entries enable row level security;
alter table neuron_tokens enable row level security;
alter table onboarding_flows enable row level security;

-- Public read for content tables (service role bypasses RLS regardless)
create policy "questionnaires_read" on questionnaires for select using (true);
create policy "taxonomy_read" on taxonomy_versions for select using (true);
create policy "flows_read" on onboarding_flows for select using (true);
-- Registry and tokens: no public read (server-only access via service key)
