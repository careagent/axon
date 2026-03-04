/**
 * Zero-dependency Supabase REST client.
 *
 * Uses raw fetch() against Supabase's PostgREST API.
 * Returns null config when SUPABASE_URL / SUPABASE_SERVICE_KEY are not set,
 * signaling callers to fall back to JSON file loading.
 */

export interface SupabaseConfig {
  url: string
  key: string
}

/**
 * Read Supabase connection config from env vars.
 * Returns null if either SUPABASE_URL or SUPABASE_SERVICE_KEY is not set.
 */
export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_KEY']
  if (!url || !key) return null
  return { url: url.replace(/\/$/, ''), key }
}

function headers(key: string): Record<string, string> {
  return {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

/**
 * GET rows from a Supabase table via PostgREST.
 *
 * @param config - Supabase connection config
 * @param table - Table name
 * @param query - PostgREST query params (e.g., { provider_type: 'eq.physician', select: '*' })
 */
export async function supabaseGet<T>(
  config: SupabaseConfig,
  table: string,
  query?: Record<string, string>,
): Promise<T[]> {
  const url = new URL(`${config.url}/rest/v1/${table}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v)
    }
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: headers(config.key),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Supabase GET ${table} failed (${res.status}): ${body}`)
  }

  return (await res.json()) as T[]
}

/**
 * Upsert a row into a Supabase table via PostgREST.
 *
 * @param config - Supabase connection config
 * @param table - Table name
 * @param data - Row data to upsert
 * @param onConflict - Conflict column(s) for upsert resolution
 */
export async function supabaseUpsert<T>(
  config: SupabaseConfig,
  table: string,
  data: unknown,
  onConflict: string,
): Promise<T> {
  const url = new URL(`${config.url}/rest/v1/${table}`)
  url.searchParams.set('on_conflict', onConflict)

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      ...headers(config.key),
      'Prefer': 'return=representation,resolution=merge-duplicates',
    },
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Supabase UPSERT ${table} failed (${res.status}): ${body}`)
  }

  const rows = (await res.json()) as T[]
  return rows[0]!
}

/**
 * DELETE rows from a Supabase table via PostgREST.
 *
 * @param config - Supabase connection config
 * @param table - Table name
 * @param query - PostgREST filter params (e.g., { npi: 'eq.1234567893' })
 */
export async function supabaseDelete(
  config: SupabaseConfig,
  table: string,
  query: Record<string, string>,
): Promise<void> {
  const url = new URL(`${config.url}/rest/v1/${table}`)
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: headers(config.key),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Supabase DELETE ${table} failed (${res.status}): ${body}`)
  }
}
