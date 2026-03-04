import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID, randomBytes } from 'node:crypto'
import {
  getSupabaseConfig,
  fetchNeuronToken,
  upsertNeuronToken,
} from '../db/index.js'
import type { SupabaseConfig } from '../db/index.js'

/** Stored token record mapping a registration ID to its neuron's NPI and bearer token. */
export interface TokenRecord {
  npi: string
  bearer_token: string
  registered_at: string
}

/**
 * Persistent token store for neuron registration tokens.
 *
 * Uses file-backed persistence with optional Supabase sync.
 * When SUPABASE_URL is set, tokens are written to both file and DB.
 */
export class PersistentTokenStore {
  private readonly filePath: string
  private readonly tokens: Map<string, TokenRecord>
  private readonly supabaseConfig: SupabaseConfig | null

  constructor(filePath: string) {
    this.filePath = filePath
    this.tokens = this.load()
    this.supabaseConfig = getSupabaseConfig()
  }

  /** Register a new neuron and return its registration ID and bearer token. */
  register(npi: string): { registration_id: string; bearer_token: string } {
    const registrationId = randomUUID()
    const bearerToken = randomBytes(32).toString('base64url')

    this.tokens.set(registrationId, {
      npi,
      bearer_token: bearerToken,
      registered_at: new Date().toISOString(),
    })
    this.persist()

    // Fire-and-forget Supabase sync
    if (this.supabaseConfig) {
      upsertNeuronToken(this.supabaseConfig, bearerToken, registrationId, npi).catch(() => {
        // Supabase write failed — file persistence is source of truth
      })
    }

    return { registration_id: registrationId, bearer_token: bearerToken }
  }

  /** Look up a token record by registration ID. */
  get(registrationId: string): TokenRecord | undefined {
    return this.tokens.get(registrationId)
  }

  /** Validate a bearer token against a registration ID. */
  validateToken(registrationId: string, bearerToken: string): boolean {
    const record = this.tokens.get(registrationId)
    if (record === undefined) return false
    return record.bearer_token === bearerToken
  }

  /** Number of registered tokens. */
  get size(): number {
    return this.tokens.size
  }

  private load(): Map<string, TokenRecord> {
    if (!existsSync(this.filePath)) {
      return new Map()
    }

    const raw = readFileSync(this.filePath, 'utf-8')
    const data = JSON.parse(raw) as { tokens: Record<string, TokenRecord> }
    return new Map(Object.entries(data.tokens))
  }

  private persist(): void {
    const dir = dirname(this.filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    const data = JSON.stringify(
      { version: '1.0.0', tokens: Object.fromEntries(this.tokens) },
      null,
      2,
    )

    const tempPath = join(dir, `.tokens-${randomUUID()}.tmp`)
    writeFileSync(tempPath, data, 'utf-8')
    renameSync(tempPath, this.filePath)
  }
}
