import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getSupabaseConfig,
  supabaseGet,
  supabaseUpsert,
  supabaseDelete,
} from '../src/db/client.js'
import {
  fetchQuestionnaire,
  fetchAllQuestionnaires,
  fetchRegistryEntry,
  upsertRegistryEntry,
  deleteRegistryEntry,
  fetchTaxonomy,
  fetchNeuronToken,
  upsertNeuronToken,
  fetchOnboardingFlow,
} from '../src/db/queries.js'
import type { SupabaseConfig } from '../src/db/client.js'

// ─── getSupabaseConfig ─────────────────────────────────────────────────────

describe('getSupabaseConfig', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
  })

  afterEach(() => {
    process.env = env
  })

  it('returns null when SUPABASE_URL is not set', () => {
    delete process.env['SUPABASE_URL']
    delete process.env['SUPABASE_SERVICE_KEY']
    expect(getSupabaseConfig()).toBeNull()
  })

  it('returns null when SUPABASE_SERVICE_KEY is not set', () => {
    process.env['SUPABASE_URL'] = 'https://test.supabase.co'
    delete process.env['SUPABASE_SERVICE_KEY']
    expect(getSupabaseConfig()).toBeNull()
  })

  it('returns config when both env vars are set', () => {
    process.env['SUPABASE_URL'] = 'https://test.supabase.co'
    process.env['SUPABASE_SERVICE_KEY'] = 'test-key'
    const config = getSupabaseConfig()
    expect(config).toEqual({
      url: 'https://test.supabase.co',
      key: 'test-key',
    })
  })

  it('strips trailing slash from URL', () => {
    process.env['SUPABASE_URL'] = 'https://test.supabase.co/'
    process.env['SUPABASE_SERVICE_KEY'] = 'test-key'
    expect(getSupabaseConfig()?.url).toBe('https://test.supabase.co')
  })
})

// ─── Supabase REST client functions ────────────────────────────────────────

describe('supabaseGet', () => {
  const config: SupabaseConfig = { url: 'https://test.supabase.co', key: 'test-key' }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('makes GET request with correct headers', async () => {
    const mockData = [{ id: '1', name: 'test' }]
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockData), { status: 200 }),
    )

    const result = await supabaseGet(config, 'test_table', { name: 'eq.test' })

    expect(result).toEqual(mockData)
    expect(fetchSpy).toHaveBeenCalledOnce()

    const [url, options] = fetchSpy.mock.calls[0]!
    expect(url).toContain('/rest/v1/test_table')
    expect(url).toContain('name=eq.test')
    expect((options as RequestInit).method).toBe('GET')
    expect((options as RequestInit).headers).toHaveProperty('apikey', 'test-key')
  })

  it('throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not found', { status: 404 }),
    )

    await expect(supabaseGet(config, 'test_table')).rejects.toThrow(
      'Supabase GET test_table failed (404)',
    )
  })
})

describe('supabaseUpsert', () => {
  const config: SupabaseConfig = { url: 'https://test.supabase.co', key: 'test-key' }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('makes POST request with merge-duplicates preference', async () => {
    const mockRow = { id: '1', name: 'test' }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([mockRow]), { status: 201 }),
    )

    const result = await supabaseUpsert(config, 'test_table', { name: 'test' }, 'name')

    expect(result).toEqual(mockRow)
    expect(fetchSpy).toHaveBeenCalledOnce()

    const [url, options] = fetchSpy.mock.calls[0]!
    expect(url).toContain('on_conflict=name')
    expect((options as RequestInit).method).toBe('POST')
    const reqHeaders = (options as RequestInit).headers as Record<string, string>
    expect(reqHeaders['Prefer']).toContain('resolution=merge-duplicates')
  })
})

describe('supabaseDelete', () => {
  const config: SupabaseConfig = { url: 'https://test.supabase.co', key: 'test-key' }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('makes DELETE request with filter params', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    )

    await supabaseDelete(config, 'test_table', { id: 'eq.123' })

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, options] = fetchSpy.mock.calls[0]!
    expect(url).toContain('id=eq.123')
    expect((options as RequestInit).method).toBe('DELETE')
  })
})

// ─── Query functions ───────────────────────────────────────────────────────

describe('query functions', () => {
  const config: SupabaseConfig = { url: 'https://test.supabase.co', key: 'test-key' }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetchQuestionnaire returns data for matching provider type', async () => {
    const qData = { provider_type: 'physician', display_name: 'Physician', version: '1.0.0', questions: [] }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ data: qData }]), { status: 200 }),
    )

    const result = await fetchQuestionnaire(config, 'physician')
    expect(result).toEqual(qData)
  })

  it('fetchQuestionnaire returns null when not found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    )

    const result = await fetchQuestionnaire(config, 'nonexistent')
    expect(result).toBeNull()
  })

  it('fetchAllQuestionnaires returns array of records', async () => {
    const rows = [
      { provider_type: 'physician', data: { display_name: 'Physician' }, is_meta: false },
      { provider_type: '_universal_consent', data: { display_name: 'Consent' }, is_meta: true },
    ]
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(rows), { status: 200 }),
    )

    const result = await fetchAllQuestionnaires(config)
    expect(result).toHaveLength(2)
    expect(result[0]!.provider_type).toBe('physician')
    expect(result[1]!.is_meta).toBe(true)
  })

  it('fetchRegistryEntry returns entry data', async () => {
    const entry = { npi: '1234567893', name: 'Dr. Test', entity_type: 'individual' }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ data: entry }]), { status: 200 }),
    )

    const result = await fetchRegistryEntry(config, '1234567893')
    expect(result).toEqual(entry)
  })

  it('upsertRegistryEntry calls supabase with correct shape', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{}]), { status: 201 }),
    )

    const entry = {
      npi: '1234567893',
      entity_type: 'individual' as const,
      name: 'Dr. Test',
      credential_status: 'pending' as const,
      credentials: [],
      registered_at: '2026-01-01T00:00:00.000Z',
      last_updated: '2026-01-01T00:00:00.000Z',
      registry_version: '1.0.0',
    }

    await upsertRegistryEntry(config, entry as any)

    const [, options] = fetchSpy.mock.calls[0]!
    const body = JSON.parse((options as RequestInit).body as string)
    expect(body.npi).toBe('1234567893')
    expect(body.data).toEqual(entry)
  })

  it('deleteRegistryEntry calls DELETE with npi filter', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    )

    await deleteRegistryEntry(config, '1234567893')

    const [url] = fetchSpy.mock.calls[0]!
    expect(url).toContain('npi=eq.1234567893')
  })

  it('fetchTaxonomy returns latest taxonomy data', async () => {
    const taxData = { version: '1.0.0', provider_types: [], actions: [] }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ data: taxData, version: '1.0.0' }]), { status: 200 }),
    )

    const result = await fetchTaxonomy(config)
    expect(result).toEqual(taxData)
  })

  it('fetchTaxonomy returns null when no versions exist', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    )

    const result = await fetchTaxonomy(config)
    expect(result).toBeNull()
  })

  it('fetchNeuronToken returns token data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ token: 'abc', neuron_npi: '1234567893' }]), { status: 200 }),
    )

    const result = await fetchNeuronToken(config, 'reg-123')
    expect(result).toEqual({ token: 'abc', neuron_npi: '1234567893' })
  })

  it('fetchNeuronToken returns null when not found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    )

    const result = await fetchNeuronToken(config, 'nonexistent')
    expect(result).toBeNull()
  })

  it('upsertNeuronToken sends correct data', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{}]), { status: 201 }),
    )

    await upsertNeuronToken(config, 'token-abc', 'reg-123', '1234567893')

    const [, options] = fetchSpy.mock.calls[0]!
    const body = JSON.parse((options as RequestInit).body as string)
    expect(body.token).toBe('token-abc')
    expect(body.registration_id).toBe('reg-123')
    expect(body.neuron_npi).toBe('1234567893')
  })

  it('fetchOnboardingFlow returns flow for target type', async () => {
    const steps = [{ questionnaire_id: '_universal_consent', label: 'Consent' }]
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ target_type: 'provider', steps }]), { status: 200 }),
    )

    const result = await fetchOnboardingFlow(config, 'provider')
    expect(result).toEqual({ target_type: 'provider', steps })
  })

  it('fetchOnboardingFlow returns null when not found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    )

    const result = await fetchOnboardingFlow(config, 'nonexistent')
    expect(result).toBeNull()
  })
})
