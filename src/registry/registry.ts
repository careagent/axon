import { validateNPI } from './npi.js'
import { persistRegistry, loadRegistry } from './persistence.js'
import { AxonTaxonomy } from '../taxonomy/taxonomy.js'
import type {
  RegistryEntry,
  CredentialRecord,
  CredentialStatus,
  NeuronEndpoint,
  OrganizationAffiliation,
  RegistrySearchQuery,
} from '../types/index.js'

/** Fields accepted for provider registration (individual entity). */
export interface ProviderRegistration {
  npi: string
  name: string
  provider_types: string[]
  degrees?: string[]
  specialty?: string
  subspecialty?: string
  credentials?: Omit<CredentialRecord, 'verification_source'>[]
  affiliations?: OrganizationAffiliation[]
}

/** Fields accepted for Neuron (organization) registration. */
export interface NeuronRegistration {
  npi: string
  name: string
  organization_name: string
  endpoint: NeuronEndpoint
  credentials?: Omit<CredentialRecord, 'verification_source'>[]
}

/**
 * Axon provider/Neuron registry with NPI validation, credential management,
 * multi-field search, and file-backed persistence.
 *
 * Every mutation triggers an atomic persist to disk. Creating a new instance
 * with the same file path reloads previously persisted state.
 *
 * @example
 * ```ts
 * import { AxonRegistry } from '@careagent/axon'
 *
 * const registry = new AxonRegistry('/tmp/axon-registry.json')
 * registry.registerProvider({
 *   npi: '1234567893',
 *   name: 'Dr. Smith',
 *   provider_types: ['physician'],
 * })
 * registry.search({ name: 'smith' }) // [{ npi: '1234567893', ... }]
 * ```
 */
export class AxonRegistry {
  private readonly filePath: string
  private readonly entries: Map<string, RegistryEntry>

  constructor(filePath: string) {
    this.filePath = filePath
    this.entries = loadRegistry(filePath)
  }

  /**
   * Register an individual provider.
   *
   * @throws Error if NPI is invalid, duplicate, or any provider_type is not in taxonomy
   */
  registerProvider(registration: ProviderRegistration): RegistryEntry {
    if (!validateNPI(registration.npi)) {
      throw new Error(`Invalid NPI: "${registration.npi}"`)
    }
    if (this.entries.has(registration.npi)) {
      throw new Error(`NPI "${registration.npi}" is already registered`)
    }

    // Cross-validate provider_types against taxonomy
    const validTypeIds = new Set(
      AxonTaxonomy.getProviderTypes().map((t) => t.id),
    )
    for (const typeId of registration.provider_types) {
      if (!validTypeIds.has(typeId)) {
        throw new Error(
          `Invalid provider type: "${typeId}" is not in the taxonomy`,
        )
      }
    }

    const now = new Date().toISOString()

    const credentials: CredentialRecord[] = (
      registration.credentials ?? []
    ).map((c) => ({
      ...c,
      verification_source: 'self_attested' as const,
    }))

    // Build entry with conditional spread for optional fields
    // (exactOptionalPropertyTypes means we must NOT set optional fields to undefined)
    const entry: RegistryEntry = {
      npi: registration.npi,
      entity_type: 'individual',
      name: registration.name,
      credential_status: 'pending',
      provider_types: registration.provider_types,
      credentials,
      registered_at: now,
      last_updated: now,
      registry_version: '1.0.0',
      ...(registration.degrees !== undefined && {
        degrees: registration.degrees,
      }),
      ...(registration.specialty !== undefined && {
        specialty: registration.specialty,
      }),
      ...(registration.subspecialty !== undefined && {
        subspecialty: registration.subspecialty,
      }),
      ...(registration.affiliations !== undefined && {
        affiliations: registration.affiliations,
      }),
    }

    this.entries.set(registration.npi, entry)
    this.persist()
    return entry
  }

  /**
   * Register a Neuron (organization) entry.
   *
   * @throws Error if NPI is invalid or duplicate
   */
  registerNeuron(registration: NeuronRegistration): RegistryEntry {
    if (!validateNPI(registration.npi)) {
      throw new Error(`Invalid NPI: "${registration.npi}"`)
    }
    if (this.entries.has(registration.npi)) {
      throw new Error(`NPI "${registration.npi}" is already registered`)
    }

    const now = new Date().toISOString()

    const credentials: CredentialRecord[] = (
      registration.credentials ?? []
    ).map((c) => ({
      ...c,
      verification_source: 'self_attested' as const,
    }))

    const entry: RegistryEntry = {
      npi: registration.npi,
      entity_type: 'organization',
      name: registration.name,
      credential_status: 'pending',
      organization_name: registration.organization_name,
      neuron_endpoint: registration.endpoint,
      credentials,
      registered_at: now,
      last_updated: now,
      registry_version: '1.0.0',
    }

    this.entries.set(registration.npi, entry)
    this.persist()
    return entry
  }

  /**
   * Look up a registry entry by NPI. O(1) Map lookup.
   */
  findByNPI(npi: string): RegistryEntry | undefined {
    return this.entries.get(npi)
  }

  /**
   * Add a credential to an existing entry.
   * Forces verification_source to 'self_attested'.
   *
   * @throws Error if NPI not found
   */
  addCredential(
    npi: string,
    credential: Omit<CredentialRecord, 'verification_source'>,
  ): void {
    const entry = this.entries.get(npi)
    if (entry === undefined) {
      throw new Error(`NPI "${npi}" not found`)
    }

    entry.credentials.push({
      ...credential,
      verification_source: 'self_attested',
    })
    entry.last_updated = new Date().toISOString()
    this.persist()
  }

  /**
   * Update the status of a specific credential on an entry.
   *
   * @throws Error if NPI or credential identifier not found
   */
  updateCredentialStatus(
    npi: string,
    credentialIdentifier: string,
    status: CredentialStatus,
  ): void {
    const entry = this.entries.get(npi)
    if (entry === undefined) {
      throw new Error(`NPI "${npi}" not found`)
    }

    const credential = entry.credentials.find(
      (c) => c.identifier === credentialIdentifier,
    )
    if (credential === undefined) {
      throw new Error(
        `Credential "${credentialIdentifier}" not found for NPI "${npi}"`,
      )
    }

    credential.status = status
    entry.last_updated = new Date().toISOString()
    this.persist()
  }

  /**
   * Update the neuron endpoint for an organization entry.
   *
   * @throws Error if NPI not found or entry is not an organization
   */
  updateEndpoint(npi: string, endpoint: NeuronEndpoint): void {
    const entry = this.entries.get(npi)
    if (entry === undefined) {
      throw new Error(`NPI "${npi}" not found`)
    }
    if (entry.entity_type !== 'organization') {
      throw new Error(
        `NPI "${npi}" is not an organization entry`,
      )
    }

    entry.neuron_endpoint = endpoint
    entry.last_updated = new Date().toISOString()
    this.persist()
  }

  /**
   * Search registry entries with AND logic across all provided filter fields.
   * Supports pagination with limit (default 20, max 100) and offset (default 0).
   */
  search(query: RegistrySearchQuery): RegistryEntry[] {
    const limit = Math.min(query.limit ?? 20, 100)
    const offset = query.offset ?? 0

    const results: RegistryEntry[] = []

    for (const entry of this.entries.values()) {
      if (!this.matchesQuery(entry, query)) {
        continue
      }
      results.push(entry)
    }

    return results.slice(offset, offset + limit)
  }

  /**
   * Check if an entry matches all provided query fields (AND logic).
   */
  private matchesQuery(
    entry: RegistryEntry,
    query: RegistrySearchQuery,
  ): boolean {
    // NPI: exact match
    if (query.npi !== undefined && entry.npi !== query.npi) {
      return false
    }

    // Name: case-insensitive substring
    if (
      query.name !== undefined &&
      !entry.name.toLowerCase().includes(query.name.toLowerCase())
    ) {
      return false
    }

    // Specialty: case-insensitive exact match
    if (query.specialty !== undefined) {
      if (
        entry.specialty === undefined ||
        entry.specialty.toLowerCase() !== query.specialty.toLowerCase()
      ) {
        return false
      }
    }

    // Provider type: exact match against provider_types array
    if (query.provider_type !== undefined) {
      if (
        entry.provider_types === undefined ||
        !entry.provider_types.includes(query.provider_type)
      ) {
        return false
      }
    }

    // Organization: case-insensitive substring against organization_name and affiliations
    if (query.organization !== undefined) {
      const orgQuery = query.organization.toLowerCase()
      const matchesOrgName =
        entry.organization_name !== undefined &&
        entry.organization_name.toLowerCase().includes(orgQuery)
      const matchesAffiliation =
        entry.affiliations !== undefined &&
        entry.affiliations.some((a) =>
          a.organization_name.toLowerCase().includes(orgQuery),
        )
      if (!matchesOrgName && !matchesAffiliation) {
        return false
      }
    }

    // Credential status: exact match
    if (
      query.credential_status !== undefined &&
      entry.credential_status !== query.credential_status
    ) {
      return false
    }

    return true
  }

  /**
   * Atomically persist the current registry state to disk.
   */
  private persist(): void {
    persistRegistry(this.filePath, this.entries)
  }
}
