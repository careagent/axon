import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AxonRegistry } from '../src/registry/registry.js'

describe('AxonRegistry persistence', () => {
  let tempDir: string
  let registryPath: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'axon-persist-test-'))
    registryPath = join(tempDir, 'registry.json')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('creates registry file on first registration', () => {
    expect(existsSync(registryPath)).toBe(false)

    const registry = new AxonRegistry(registryPath)
    registry.registerProvider({
      npi: '1234567893',
      name: 'Dr. Smith',
      provider_types: ['physician'],
    })

    expect(existsSync(registryPath)).toBe(true)
  })

  it('reloads entries from same file path', () => {
    const registry1 = new AxonRegistry(registryPath)
    registry1.registerProvider({
      npi: '1234567893',
      name: 'Dr. Smith',
      provider_types: ['physician'],
      specialty: 'Cardiology',
    })

    // Create new instance from same path -- simulates process restart
    const registry2 = new AxonRegistry(registryPath)
    const entry = registry2.findByNPI('1234567893')

    expect(entry).toBeDefined()
    expect(entry!.name).toBe('Dr. Smith')
    expect(entry!.specialty).toBe('Cardiology')
    expect(entry!.entity_type).toBe('individual')
  })

  it('persists valid JSON with version 1.0.0 wrapper', () => {
    const registry = new AxonRegistry(registryPath)
    registry.registerProvider({
      npi: '1234567893',
      name: 'Dr. Smith',
      provider_types: ['physician'],
    })

    const raw = readFileSync(registryPath, 'utf-8')
    const data = JSON.parse(raw) as { version: string; entries: Record<string, unknown> }

    expect(data.version).toBe('1.0.0')
    expect(data.entries).toBeDefined()
    expect(data.entries['1234567893']).toBeDefined()
  })

  it('loads empty registry from non-existent file (no error)', () => {
    const registry = new AxonRegistry(registryPath)

    // Should not throw, should have no entries
    const result = registry.findByNPI('1234567893')
    expect(result).toBeUndefined()
  })

  it('persists credential updates across reload', () => {
    const registry1 = new AxonRegistry(registryPath)
    registry1.registerProvider({
      npi: '1234567893',
      name: 'Dr. Smith',
      provider_types: ['physician'],
    })

    registry1.addCredential('1234567893', {
      type: 'license',
      issuer: 'State Medical Board',
      identifier: 'LIC-PERSIST-001',
      status: 'active',
    })

    // Reload
    const registry2 = new AxonRegistry(registryPath)
    const entry = registry2.findByNPI('1234567893')!

    expect(entry.credentials).toHaveLength(1)
    expect(entry.credentials[0]!.identifier).toBe('LIC-PERSIST-001')
    expect(entry.credentials[0]!.verification_source).toBe('self_attested')
  })

  it('persists multiple registrations', () => {
    const registry1 = new AxonRegistry(registryPath)

    registry1.registerProvider({
      npi: '1234567893',
      name: 'Dr. Smith',
      provider_types: ['physician'],
    })
    registry1.registerProvider({
      npi: '1245319599',
      name: 'Dr. Doe',
      provider_types: ['physician'],
    })
    registry1.registerNeuron({
      npi: '1114025228',
      name: 'Neuron Alpha',
      organization_name: 'Health System',
      endpoint: {
        url: 'https://example.com',
        protocol_version: '1.0.0',
        health_status: 'unknown',
      },
    })

    // Reload
    const registry2 = new AxonRegistry(registryPath)

    expect(registry2.findByNPI('1234567893')).toBeDefined()
    expect(registry2.findByNPI('1245319599')).toBeDefined()
    expect(registry2.findByNPI('1114025228')).toBeDefined()
    expect(registry2.findByNPI('1114025228')!.entity_type).toBe('organization')
  })

  it('persists credential status updates across reload', () => {
    const registry1 = new AxonRegistry(registryPath)
    registry1.registerProvider({
      npi: '1234567893',
      name: 'Dr. Smith',
      provider_types: ['physician'],
      credentials: [
        {
          type: 'license',
          issuer: 'State Board',
          identifier: 'LIC-STATUS-001',
          status: 'pending',
        },
      ],
    })

    registry1.updateCredentialStatus('1234567893', 'LIC-STATUS-001', 'active')

    // Reload
    const registry2 = new AxonRegistry(registryPath)
    const entry = registry2.findByNPI('1234567893')!
    expect(entry.credentials[0]!.status).toBe('active')
  })
})
