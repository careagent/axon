/**
 * Database query functions for all Supabase-backed data.
 *
 * Each function takes a SupabaseConfig and returns data in the shapes
 * expected by the rest of Axon. Callers (loaders) handle the
 * Supabase-vs-JSON-fallback decision.
 */

import type { SupabaseConfig } from './client.js'
import { supabaseGet, supabaseUpsert, supabaseDelete } from './client.js'
import type { Questionnaire, RegistryEntry } from '../types/index.js'
import type { OnboardingFlow, OnboardingFlowStep } from '../questionnaires/onboarding-flow.js'

// ─── DB row shapes ───────────────────────────────────────────────────────────

interface QuestionnaireRow {
  id: string
  provider_type: string
  version: string
  display_name: string
  is_meta: boolean
  data: Questionnaire
  created_at: string
  updated_at: string
}

interface TaxonomyRow {
  id: string
  version: string
  effective_date: string
  data: unknown
  created_at: string
}

interface RegistryRow {
  npi: string
  entity_type: string
  name: string
  credential_status: string
  data: RegistryEntry
  registered_at: string
  last_updated: string
}

interface TokenRow {
  token: string
  registration_id: string
  neuron_npi: string
  created_at: string
}

interface FlowRow {
  id: string
  target_type: string
  steps: OnboardingFlowStep[]
  created_at: string
  updated_at: string
}

// ─── Questionnaires ──────────────────────────────────────────────────────────

export async function fetchQuestionnaire(
  config: SupabaseConfig,
  providerType: string,
): Promise<Questionnaire | null> {
  const rows = await supabaseGet<QuestionnaireRow>(config, 'questionnaires', {
    provider_type: `eq.${providerType}`,
    select: 'data',
  })
  return rows[0]?.data ?? null
}

export async function fetchAllQuestionnaires(
  config: SupabaseConfig,
): Promise<Array<{ provider_type: string; data: Questionnaire; is_meta: boolean }>> {
  const rows = await supabaseGet<QuestionnaireRow>(config, 'questionnaires', {
    select: 'provider_type,data,is_meta',
  })
  return rows.map((r) => ({
    provider_type: r.provider_type,
    data: r.data,
    is_meta: r.is_meta,
  }))
}

export async function fetchMetaQuestionnaire(
  config: SupabaseConfig,
  id: string,
): Promise<Questionnaire | null> {
  const rows = await supabaseGet<QuestionnaireRow>(config, 'questionnaires', {
    provider_type: `eq.${id}`,
    is_meta: 'eq.true',
    select: 'data',
  })
  return rows[0]?.data ?? null
}

export async function upsertQuestionnaire(
  config: SupabaseConfig,
  providerType: string,
  questionnaire: Questionnaire,
  isMeta = false,
): Promise<void> {
  await supabaseUpsert(config, 'questionnaires', {
    provider_type: providerType,
    version: questionnaire.version,
    display_name: questionnaire.display_name,
    is_meta: isMeta,
    data: questionnaire,
    updated_at: new Date().toISOString(),
  }, 'provider_type')
}

// ─── Taxonomy ────────────────────────────────────────────────────────────────

export async function fetchTaxonomy(
  config: SupabaseConfig,
  version?: string,
): Promise<unknown | null> {
  const query: Record<string, string> = { select: 'data,version' }
  if (version) {
    query['version'] = `eq.${version}`
  } else {
    query['order'] = 'effective_date.desc'
    query['limit'] = '1'
  }
  const rows = await supabaseGet<TaxonomyRow>(config, 'taxonomy_versions', query)
  return rows[0]?.data ?? null
}

export async function upsertTaxonomy(
  config: SupabaseConfig,
  version: string,
  effectiveDate: string,
  data: unknown,
): Promise<void> {
  await supabaseUpsert(config, 'taxonomy_versions', {
    version,
    effective_date: effectiveDate,
    data,
  }, 'version')
}

// ─── Registry ────────────────────────────────────────────────────────────────

export async function fetchRegistryEntry(
  config: SupabaseConfig,
  npi: string,
): Promise<RegistryEntry | null> {
  const rows = await supabaseGet<RegistryRow>(config, 'registry_entries', {
    npi: `eq.${npi}`,
    select: 'data',
  })
  return rows[0]?.data ?? null
}

export async function fetchAllRegistryEntries(
  config: SupabaseConfig,
): Promise<RegistryEntry[]> {
  const rows = await supabaseGet<RegistryRow>(config, 'registry_entries', {
    select: 'data',
  })
  return rows.map((r) => r.data)
}

export async function upsertRegistryEntry(
  config: SupabaseConfig,
  entry: RegistryEntry,
): Promise<void> {
  await supabaseUpsert(config, 'registry_entries', {
    npi: entry.npi,
    entity_type: entry.entity_type,
    name: entry.name,
    credential_status: entry.credential_status,
    data: entry,
    registered_at: entry.registered_at,
    last_updated: entry.last_updated,
  }, 'npi')
}

export async function deleteRegistryEntry(
  config: SupabaseConfig,
  npi: string,
): Promise<void> {
  await supabaseDelete(config, 'registry_entries', { npi: `eq.${npi}` })
}

// ─── Tokens ──────────────────────────────────────────────────────────────────

export async function fetchNeuronToken(
  config: SupabaseConfig,
  registrationId: string,
): Promise<{ token: string; neuron_npi: string } | null> {
  const rows = await supabaseGet<TokenRow>(config, 'neuron_tokens', {
    registration_id: `eq.${registrationId}`,
    select: 'token,neuron_npi',
  })
  if (!rows[0]) return null
  return { token: rows[0].token, neuron_npi: rows[0].neuron_npi }
}

export async function upsertNeuronToken(
  config: SupabaseConfig,
  token: string,
  registrationId: string,
  neuronNpi: string,
): Promise<void> {
  await supabaseUpsert(config, 'neuron_tokens', {
    token,
    registration_id: registrationId,
    neuron_npi: neuronNpi,
  }, 'token')
}

export async function deleteNeuronToken(
  config: SupabaseConfig,
  registrationId: string,
): Promise<void> {
  await supabaseDelete(config, 'neuron_tokens', {
    registration_id: `eq.${registrationId}`,
  })
}

// ─── Onboarding Flows ────────────────────────────────────────────────────────

export async function fetchOnboardingFlow(
  config: SupabaseConfig,
  targetType: string,
): Promise<OnboardingFlow | null> {
  const rows = await supabaseGet<FlowRow>(config, 'onboarding_flows', {
    target_type: `eq.${targetType}`,
    select: 'target_type,steps',
  })
  if (!rows[0]) return null
  return { target_type: rows[0].target_type, steps: rows[0].steps }
}

export async function upsertOnboardingFlow(
  config: SupabaseConfig,
  targetType: string,
  steps: OnboardingFlowStep[],
): Promise<void> {
  await supabaseUpsert(config, 'onboarding_flows', {
    target_type: targetType,
    steps,
    updated_at: new Date().toISOString(),
  }, 'target_type')
}
