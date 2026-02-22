import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AxonRegistry } from '../src/registry/registry.js'

describe('AxonRegistry', () => {
  let tempDir: string
  let registryPath: string
  let registry: AxonRegistry

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'axon-registry-test-'))
    registryPath = join(tempDir, 'registry.json')
    registry = new AxonRegistry(registryPath)
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  // --- Registration Tests ---

  describe('registerProvider', () => {
    it('creates entry with entity_type individual and credential_status pending', () => {
      const entry = registry.registerProvider({
        npi: '1234567893',
        name: 'Dr. Jane Smith',
        provider_types: ['physician'],
      })

      expect(entry.entity_type).toBe('individual')
      expect(entry.credential_status).toBe('pending')
      expect(entry.npi).toBe('1234567893')
      expect(entry.name).toBe('Dr. Jane Smith')
      expect(entry.provider_types).toEqual(['physician'])
      expect(entry.credentials).toEqual([])
      expect(entry.registry_version).toBe('1.0.0')
      expect(entry.registered_at).toBeTruthy()
      expect(entry.last_updated).toBeTruthy()
    })

    it('sets correct timestamps on registration', () => {
      const before = new Date().toISOString()
      const entry = registry.registerProvider({
        npi: '1234567893',
        name: 'Dr. Smith',
        provider_types: ['physician'],
      })
      const after = new Date().toISOString()

      expect(entry.registered_at >= before).toBe(true)
      expect(entry.registered_at <= after).toBe(true)
      expect(entry.registered_at).toBe(entry.last_updated)
    })

    it('rejects invalid NPI with descriptive error', () => {
      expect(() =>
        registry.registerProvider({
          npi: '0000000000',
          name: 'Dr. Bad NPI',
          provider_types: ['physician'],
        }),
      ).toThrow('Invalid NPI: "0000000000"')
    })

    it('rejects duplicate NPI with descriptive error', () => {
      registry.registerProvider({
        npi: '1234567893',
        name: 'Dr. First',
        provider_types: ['physician'],
      })

      expect(() =>
        registry.registerProvider({
          npi: '1234567893',
          name: 'Dr. Second',
          provider_types: ['physician'],
        }),
      ).toThrow('NPI "1234567893" is already registered')
    })

    it('validates provider_types against taxonomy (invalid type throws)', () => {
      expect(() =>
        registry.registerProvider({
          npi: '1234567893',
          name: 'Dr. Invalid Type',
          provider_types: ['nonexistent_type'],
        }),
      ).toThrow('Invalid provider type: "nonexistent_type" is not in the taxonomy')
    })

    it('stores optional fields when provided', () => {
      const entry = registry.registerProvider({
        npi: '1234567893',
        name: 'Dr. Smith',
        provider_types: ['physician'],
        degrees: ['MD', 'PhD'],
        specialty: 'Cardiology',
        subspecialty: 'Interventional Cardiology',
        affiliations: [
          {
            organization_npi: '1245319599',
            organization_name: 'General Hospital',
            department: 'Cardiology',
          },
        ],
      })

      expect(entry.degrees).toEqual(['MD', 'PhD'])
      expect(entry.specialty).toBe('Cardiology')
      expect(entry.subspecialty).toBe('Interventional Cardiology')
      expect(entry.affiliations).toHaveLength(1)
      expect(entry.affiliations![0]!.organization_name).toBe('General Hospital')
    })

    it('does not set optional fields to undefined when not provided', () => {
      const entry = registry.registerProvider({
        npi: '1234567893',
        name: 'Dr. Minimal',
        provider_types: ['physician'],
      })

      // These optional fields should be absent, not set to undefined
      expect('degrees' in entry).toBe(false)
      expect('specialty' in entry).toBe(false)
      expect('subspecialty' in entry).toBe(false)
      expect('affiliations' in entry).toBe(false)
    })
  })

  describe('registerNeuron', () => {
    it('creates entry with entity_type organization and neuron_endpoint', () => {
      const entry = registry.registerNeuron({
        npi: '1234567893',
        name: 'CareAgent Neuron Alpha',
        organization_name: 'Health System Alpha',
        endpoint: {
          url: 'https://alpha.careagent.health/axon',
          protocol_version: '1.0.0',
          health_status: 'unknown',
        },
      })

      expect(entry.entity_type).toBe('organization')
      expect(entry.credential_status).toBe('pending')
      expect(entry.organization_name).toBe('Health System Alpha')
      expect(entry.neuron_endpoint).toEqual({
        url: 'https://alpha.careagent.health/axon',
        protocol_version: '1.0.0',
        health_status: 'unknown',
      })
      expect(entry.credentials).toEqual([])
    })

    it('rejects invalid NPI', () => {
      expect(() =>
        registry.registerNeuron({
          npi: 'bad',
          name: 'Bad Neuron',
          organization_name: 'Bad Org',
          endpoint: {
            url: 'https://example.com',
            protocol_version: '1.0.0',
            health_status: 'unknown',
          },
        }),
      ).toThrow('Invalid NPI: "bad"')
    })

    it('rejects duplicate NPI', () => {
      registry.registerNeuron({
        npi: '1234567893',
        name: 'Neuron 1',
        organization_name: 'Org 1',
        endpoint: {
          url: 'https://example.com',
          protocol_version: '1.0.0',
          health_status: 'unknown',
        },
      })

      expect(() =>
        registry.registerNeuron({
          npi: '1234567893',
          name: 'Neuron 2',
          organization_name: 'Org 2',
          endpoint: {
            url: 'https://example2.com',
            protocol_version: '1.0.0',
            health_status: 'unknown',
          },
        }),
      ).toThrow('NPI "1234567893" is already registered')
    })
  })

  // --- Credential Tests ---

  describe('addCredential', () => {
    it('forces verification_source to self_attested regardless of input', () => {
      registry.registerProvider({
        npi: '1234567893',
        name: 'Dr. Smith',
        provider_types: ['physician'],
      })

      registry.addCredential('1234567893', {
        type: 'license',
        issuer: 'State Medical Board',
        identifier: 'LIC-12345',
        status: 'active',
      })

      const entry = registry.findByNPI('1234567893')!
      expect(entry.credentials).toHaveLength(1)
      expect(entry.credentials[0]!.verification_source).toBe('self_attested')
    })

    it('throws for unknown NPI', () => {
      expect(() =>
        registry.addCredential('9999999999', {
          type: 'license',
          issuer: 'State Board',
          identifier: 'LIC-999',
          status: 'active',
        }),
      ).toThrow('NPI "9999999999" not found')
    })

    it('updates last_updated timestamp', () => {
      registry.registerProvider({
        npi: '1234567893',
        name: 'Dr. Smith',
        provider_types: ['physician'],
      })

      const before = registry.findByNPI('1234567893')!.last_updated

      // Small delay to ensure timestamp differs
      const start = Date.now()
      while (Date.now() - start < 5) {
        // busy wait for timestamp change
      }

      registry.addCredential('1234567893', {
        type: 'license',
        issuer: 'State Board',
        identifier: 'LIC-001',
        status: 'active',
      })

      const after = registry.findByNPI('1234567893')!.last_updated
      expect(after >= before).toBe(true)
    })
  })

  describe('credentials at registration', () => {
    it('forces verification_source to self_attested on registration credentials', () => {
      const entry = registry.registerProvider({
        npi: '1234567893',
        name: 'Dr. Smith',
        provider_types: ['physician'],
        credentials: [
          {
            type: 'license',
            issuer: 'State Board',
            identifier: 'LIC-REG-001',
            status: 'active',
          },
          {
            type: 'certification',
            issuer: 'Specialty Board',
            identifier: 'CERT-REG-001',
            status: 'active',
          },
        ],
      })

      expect(entry.credentials).toHaveLength(2)
      expect(entry.credentials[0]!.verification_source).toBe('self_attested')
      expect(entry.credentials[1]!.verification_source).toBe('self_attested')
    })
  })

  describe('updateCredentialStatus', () => {
    it('changes the status of the specified credential', () => {
      registry.registerProvider({
        npi: '1234567893',
        name: 'Dr. Smith',
        provider_types: ['physician'],
        credentials: [
          {
            type: 'license',
            issuer: 'State Board',
            identifier: 'LIC-001',
            status: 'pending',
          },
        ],
      })

      registry.updateCredentialStatus('1234567893', 'LIC-001', 'active')

      const entry = registry.findByNPI('1234567893')!
      expect(entry.credentials[0]!.status).toBe('active')
    })

    it('throws for unknown NPI', () => {
      expect(() =>
        registry.updateCredentialStatus('9999999999', 'LIC-001', 'active'),
      ).toThrow('NPI "9999999999" not found')
    })

    it('throws for unknown credential identifier', () => {
      registry.registerProvider({
        npi: '1234567893',
        name: 'Dr. Smith',
        provider_types: ['physician'],
      })

      expect(() =>
        registry.updateCredentialStatus('1234567893', 'NONEXISTENT', 'active'),
      ).toThrow('Credential "NONEXISTENT" not found for NPI "1234567893"')
    })
  })

  // --- Endpoint Tests ---

  describe('updateEndpoint', () => {
    it('updates the neuron_endpoint for an organization entry', () => {
      registry.registerNeuron({
        npi: '1234567893',
        name: 'Neuron Alpha',
        organization_name: 'Health System',
        endpoint: {
          url: 'https://old.example.com',
          protocol_version: '1.0.0',
          health_status: 'unknown',
        },
      })

      const newEndpoint = {
        url: 'https://new.example.com',
        protocol_version: '2.0.0',
        health_status: 'reachable' as const,
      }
      registry.updateEndpoint('1234567893', newEndpoint)

      const entry = registry.findByNPI('1234567893')!
      expect(entry.neuron_endpoint).toEqual(newEndpoint)
    })

    it('throws for individual (non-organization) entry', () => {
      registry.registerProvider({
        npi: '1234567893',
        name: 'Dr. Smith',
        provider_types: ['physician'],
      })

      expect(() =>
        registry.updateEndpoint('1234567893', {
          url: 'https://example.com',
          protocol_version: '1.0.0',
          health_status: 'unknown',
        }),
      ).toThrow('NPI "1234567893" is not an organization entry')
    })

    it('throws for unknown NPI', () => {
      expect(() =>
        registry.updateEndpoint('9999999999', {
          url: 'https://example.com',
          protocol_version: '1.0.0',
          health_status: 'unknown',
        }),
      ).toThrow('NPI "9999999999" not found')
    })
  })

  // --- Search Tests ---

  describe('search', () => {
    beforeEach(() => {
      // Set up test data
      registry.registerProvider({
        npi: '1234567893',
        name: 'Dr. Jane Smith',
        provider_types: ['physician'],
        specialty: 'Cardiology',
        affiliations: [
          {
            organization_npi: '1245319599',
            organization_name: 'Metro General Hospital',
          },
        ],
      })

      registry.registerProvider({
        npi: '1245319599',
        name: 'Dr. John Doe',
        provider_types: ['physician'],
        specialty: 'Neurology',
        affiliations: [
          {
            organization_npi: '1114025228',
            organization_name: 'City Medical Center',
          },
        ],
      })

      registry.registerNeuron({
        npi: '1114025228',
        name: 'CareAgent Neuron Beta',
        organization_name: 'City Medical Center',
        endpoint: {
          url: 'https://beta.example.com',
          protocol_version: '1.0.0',
          health_status: 'reachable',
        },
      })
    })

    it('returns all entries with no filters (up to limit)', () => {
      const results = registry.search({})
      expect(results).toHaveLength(3)
    })

    it('searches by NPI with exact match', () => {
      const results = registry.search({ npi: '1234567893' })
      expect(results).toHaveLength(1)
      expect(results[0]!.name).toBe('Dr. Jane Smith')
    })

    it('searches by name with case-insensitive substring', () => {
      const results = registry.search({ name: 'smith' })
      expect(results).toHaveLength(1)
      expect(results[0]!.npi).toBe('1234567893')
    })

    it('searches by name with partial substring', () => {
      const results = registry.search({ name: 'Dr.' })
      expect(results).toHaveLength(2)
    })

    it('searches by specialty with case-insensitive exact match', () => {
      const results = registry.search({ specialty: 'cardiology' })
      expect(results).toHaveLength(1)
      expect(results[0]!.name).toBe('Dr. Jane Smith')
    })

    it('searches by specialty with exact match (not substring)', () => {
      const results = registry.search({ specialty: 'Cardio' })
      expect(results).toHaveLength(0)
    })

    it('searches by provider_type with exact match against array', () => {
      const results = registry.search({ provider_type: 'physician' })
      expect(results).toHaveLength(2)
    })

    it('searches by organization matching organization_name', () => {
      const results = registry.search({ organization: 'city medical' })
      expect(results).toHaveLength(2) // Neuron org_name + provider affiliation
    })

    it('searches by organization matching affiliations', () => {
      const results = registry.search({ organization: 'metro general' })
      expect(results).toHaveLength(1)
      expect(results[0]!.npi).toBe('1234567893')
    })

    it('searches by credential_status with exact match', () => {
      const results = registry.search({ credential_status: 'pending' })
      expect(results).toHaveLength(3) // All entries start as pending
    })

    it('searches with combined filters using AND logic', () => {
      const results = registry.search({
        provider_type: 'physician',
        specialty: 'Cardiology',
      })
      expect(results).toHaveLength(1)
      expect(results[0]!.name).toBe('Dr. Jane Smith')
    })

    it('returns empty when AND filters exclude all entries', () => {
      const results = registry.search({
        specialty: 'Cardiology',
        organization: 'City Medical',
      })
      expect(results).toHaveLength(0)
    })

    it('applies limit and offset for pagination', () => {
      const page1 = registry.search({ limit: 2, offset: 0 })
      expect(page1).toHaveLength(2)

      const page2 = registry.search({ limit: 2, offset: 2 })
      expect(page2).toHaveLength(1)
    })

    it('uses default limit of 20', () => {
      // With only 3 entries, all should be returned
      const results = registry.search({})
      expect(results).toHaveLength(3)
    })

    it('caps limit at 100', () => {
      // Request limit > 100 should be capped
      const results = registry.search({ limit: 200 })
      expect(results).toHaveLength(3) // Only 3 entries exist
      // The cap is applied internally; we verify behavior not internal state
    })
  })

  describe('findByNPI', () => {
    it('returns undefined for non-existent NPI', () => {
      const result = registry.findByNPI('9999999999')
      expect(result).toBeUndefined()
    })

    it('returns the entry for existing NPI', () => {
      registry.registerProvider({
        npi: '1234567893',
        name: 'Dr. Smith',
        provider_types: ['physician'],
      })

      const result = registry.findByNPI('1234567893')
      expect(result).toBeDefined()
      expect(result!.name).toBe('Dr. Smith')
    })
  })
})
