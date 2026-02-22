import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AuditTrail, type AuditEntry } from '../src/broker/audit.js'
import { AxonBroker } from '../src/broker/broker.js'
import { AxonRegistry } from '../src/registry/registry.js'
import {
  generateKeyPair,
  signPayload,
  generateNonce,
  type AxonKeyPair,
} from '../src/protocol/identity.js'
import type {
  SignedMessage,
  ConnectRequest,
} from '../src/protocol/schemas.js'

// --- AuditTrail Tests ---

describe('AuditTrail', () => {
  let tmpDir: string

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'axon-audit-test-'))
  })

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('log() creates a JSONL file with one line', () => {
    const filePath = join(tmpDir, 'audit-1.jsonl')
    const trail = new AuditTrail(filePath)
    trail.log({ type: 'connect_attempt', connectionId: 'conn-1' })

    const content = readFileSync(filePath, 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(1)
  })

  it('parsed entry has all required fields', () => {
    const filePath = join(tmpDir, 'audit-2.jsonl')
    const trail = new AuditTrail(filePath)
    const entry = trail.log({ type: 'connect_attempt', connectionId: 'conn-2' })

    expect(entry).toHaveProperty('id')
    expect(entry).toHaveProperty('timestamp')
    expect(entry).toHaveProperty('event_type')
    expect(entry).toHaveProperty('connection_id')
    expect(entry).toHaveProperty('details')
    expect(entry).toHaveProperty('prev_hash')
    expect(entry).toHaveProperty('hash')
  })

  it('first entry has prev_hash of 64 zeros (genesis)', () => {
    const filePath = join(tmpDir, 'audit-3.jsonl')
    const trail = new AuditTrail(filePath)
    const entry = trail.log({ type: 'connect_attempt', connectionId: 'conn-3' })

    expect(entry.prev_hash).toBe('0'.repeat(64))
  })

  it('second entry prev_hash equals first entry hash', () => {
    const filePath = join(tmpDir, 'audit-4.jsonl')
    const trail = new AuditTrail(filePath)
    const first = trail.log({ type: 'connect_attempt', connectionId: 'conn-4' })
    const second = trail.log({ type: 'connect_granted', connectionId: 'conn-4' })

    expect(second.prev_hash).toBe(first.hash)
  })

  it('entry hash is valid SHA-256 (64 hex characters)', () => {
    const filePath = join(tmpDir, 'audit-5.jsonl')
    const trail = new AuditTrail(filePath)
    const entry = trail.log({ type: 'connect_attempt', connectionId: 'conn-5' })

    expect(entry.hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('verifyChain() returns valid for a correct file', () => {
    const filePath = join(tmpDir, 'audit-6.jsonl')
    const trail = new AuditTrail(filePath)
    trail.log({ type: 'connect_attempt', connectionId: 'conn-6' })
    trail.log({ type: 'connect_granted', connectionId: 'conn-6' })
    trail.log({ type: 'connect_denied', connectionId: 'conn-7' })

    const result = AuditTrail.verifyChain(filePath)
    expect(result).toEqual({ valid: true, entries: 3 })
  })

  it('verifyChain() detects tampered hash', () => {
    const filePath = join(tmpDir, 'audit-7.jsonl')
    const trail = new AuditTrail(filePath)
    trail.log({ type: 'connect_attempt', connectionId: 'conn-8' })
    trail.log({ type: 'connect_granted', connectionId: 'conn-8' })

    // Tamper with the first entry's hash
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.trim().split('\n')
    const entry = JSON.parse(lines[0]!) as AuditEntry
    entry.hash = 'a'.repeat(64)
    lines[0] = JSON.stringify(entry)
    writeFileSync(filePath, lines.join('\n') + '\n')

    const result = AuditTrail.verifyChain(filePath)
    expect(result.valid).toBe(false)
    expect(result.brokenAt).toBe(0)
  })

  it('new AuditTrail on existing file recovers lastHash and continues chain', () => {
    const filePath = join(tmpDir, 'audit-8.jsonl')
    const trail1 = new AuditTrail(filePath)
    const first = trail1.log({ type: 'connect_attempt', connectionId: 'conn-9' })

    // Create a new AuditTrail instance on the same file
    const trail2 = new AuditTrail(filePath)
    const second = trail2.log({ type: 'connect_granted', connectionId: 'conn-9' })

    expect(second.prev_hash).toBe(first.hash)

    // Full chain should still be valid
    const result = AuditTrail.verifyChain(filePath)
    expect(result).toEqual({ valid: true, entries: 2 })
  })

  it('event details are included in the entry', () => {
    const filePath = join(tmpDir, 'audit-9.jsonl')
    const trail = new AuditTrail(filePath)
    const entry = trail.log({
      type: 'connect_attempt',
      connectionId: 'conn-10',
      details: { provider_npi: '1234567893' },
    })

    expect(entry.details).toEqual({ provider_npi: '1234567893' })

    // Also verify it persisted to the file
    const content = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(content.trim()) as AuditEntry
    expect(parsed.details).toEqual({ provider_npi: '1234567893' })
  })

  it('entries contain only connection metadata (no clinical content fields)', () => {
    const filePath = join(tmpDir, 'audit-10.jsonl')
    const trail = new AuditTrail(filePath)
    const entry = trail.log({
      type: 'connect_attempt',
      connectionId: 'conn-11',
      details: { patient_agent_id: 'agent-1', provider_npi: '1234567893' },
    })

    // Verify the entry does NOT contain any clinical content fields
    const entryKeys = Object.keys(entry)
    const clinicalFields = ['diagnosis', 'medication', 'treatment', 'condition', 'phi', 'patient_name']
    for (const field of clinicalFields) {
      expect(entryKeys).not.toContain(field)
    }

    // Verify the schema only has the expected metadata fields
    expect(entryKeys.sort()).toEqual(
      ['id', 'timestamp', 'event_type', 'connection_id', 'details', 'prev_hash', 'hash'].sort(),
    )
  })
})

// --- AxonBroker Tests ---

describe('AxonBroker', () => {
  let tmpDir: string
  let keyPair: AxonKeyPair
  const testOrgNpi = '1245319599' // Valid NPI for the test organization
  const testProviderNpi = '1234567893' // Valid NPI for the test provider

  /** Create a properly signed ConnectRequest */
  function createSignedRequest(
    kp: AxonKeyPair,
    providerNpiArg: string,
    overrides?: Partial<ConnectRequest>,
  ): { signedMessage: SignedMessage; publicKey: string } {
    const request: ConnectRequest = {
      version: '1.0.0',
      type: 'connect_request',
      timestamp: new Date().toISOString(),
      nonce: generateNonce(),
      patient_agent_id: 'patient-agent-123',
      provider_npi: providerNpiArg,
      patient_public_key: kp.publicKey,
      ...overrides,
    }
    const payloadStr = JSON.stringify(request)
    const payload = Buffer.from(payloadStr).toString('base64url')
    const signature = signPayload(payloadStr, kp.privateKey, kp.publicKey)
    return { signedMessage: { payload, signature }, publicKey: kp.publicKey }
  }

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'axon-broker-test-'))
    keyPair = generateKeyPair()
  })

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  /** Fresh registry and audit trail for each test to avoid state leaks */
  function freshBroker(): { broker: AxonBroker; registry: AxonRegistry; auditPath: string } {
    const regPath = join(tmpDir, `reg-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
    const audPath = join(tmpDir, `audit-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`)
    const reg = new AxonRegistry(regPath)
    const audit = new AuditTrail(audPath)
    const broker = new AxonBroker(reg, audit)
    return { broker, registry: reg, auditPath: audPath }
  }

  /** Register an organization with a reachable Neuron endpoint */
  function registerOrg(reg: AxonRegistry, npi: string = testOrgNpi): void {
    reg.registerNeuron({
      npi,
      name: 'Test Hospital',
      organization_name: 'Test Hospital System',
      endpoint: {
        url: 'https://neuron.test-hospital.example/axon',
        protocol_version: '1.0.0',
        health_status: 'reachable',
        last_heartbeat: new Date().toISOString(),
      },
    })
    // Set credential_status to active
    const entry = reg.findByNPI(npi)!
    entry.credential_status = 'active'
  }

  /** Register an individual provider with an affiliation to the test org */
  function registerProvider(
    reg: AxonRegistry,
    npi: string = testProviderNpi,
    orgNpiArg: string = testOrgNpi,
  ): void {
    reg.registerProvider({
      npi,
      name: 'Dr. Test Provider',
      provider_types: ['physician'],
      affiliations: [
        {
          organization_npi: orgNpiArg,
          organization_name: 'Test Hospital System',
        },
      ],
    })
    // Set credential_status to active
    const entry = reg.findByNPI(npi)!
    entry.credential_status = 'active'
  }

  // --- Happy Path ---

  it('happy path: valid request for active provider with reachable endpoint returns connect_grant', () => {
    const { broker, registry: reg } = freshBroker()
    registerOrg(reg)
    registerProvider(reg)

    const { signedMessage, publicKey } = createSignedRequest(keyPair, testProviderNpi)
    const result = broker.connect(signedMessage, publicKey)

    expect(result.type).toBe('connect_grant')
    expect(result).toHaveProperty('connection_id')
    if (result.type === 'connect_grant') {
      expect(result.neuron_endpoint).toBe('https://neuron.test-hospital.example/axon')
      expect(result.protocol_version).toBe('1.0.0')
      expect(result.provider_npi).toBe(testProviderNpi)
    }
  })

  // --- Signature Failures ---

  it('tampered payload returns SIGNATURE_INVALID', () => {
    const { broker, registry: reg } = freshBroker()
    registerOrg(reg)
    registerProvider(reg)

    const { signedMessage, publicKey } = createSignedRequest(keyPair, testProviderNpi)
    // Tamper with the payload (change one character)
    const tampered = signedMessage.payload.charAt(0) === 'A'
      ? 'B' + signedMessage.payload.slice(1)
      : 'A' + signedMessage.payload.slice(1)
    const result = broker.connect({ ...signedMessage, payload: tampered }, publicKey)

    expect(result.type).toBe('connect_denial')
    if (result.type === 'connect_denial') {
      expect(result.code).toBe('SIGNATURE_INVALID')
    }
  })

  it('wrong public key returns SIGNATURE_INVALID', () => {
    const { broker, registry: reg } = freshBroker()
    registerOrg(reg)
    registerProvider(reg)

    const { signedMessage } = createSignedRequest(keyPair, testProviderNpi)
    const wrongKey = generateKeyPair()
    const result = broker.connect(signedMessage, wrongKey.publicKey)

    expect(result.type).toBe('connect_denial')
    if (result.type === 'connect_denial') {
      expect(result.code).toBe('SIGNATURE_INVALID')
    }
  })

  // --- Nonce/Timestamp Failures ---

  it('replayed nonce returns NONCE_REPLAYED on second attempt', () => {
    const { broker, registry: reg } = freshBroker()
    registerOrg(reg)
    registerProvider(reg)

    // Use a fixed nonce for both requests
    const fixedNonce = generateNonce()
    const { signedMessage: sm1, publicKey: pk1 } = createSignedRequest(
      keyPair,
      testProviderNpi,
      { nonce: fixedNonce },
    )
    const result1 = broker.connect(sm1, pk1)
    expect(result1.type).toBe('connect_grant')

    // Same nonce again (new signature but same nonce value)
    const { signedMessage: sm2, publicKey: pk2 } = createSignedRequest(
      keyPair,
      testProviderNpi,
      { nonce: fixedNonce },
    )
    const result2 = broker.connect(sm2, pk2)

    expect(result2.type).toBe('connect_denial')
    if (result2.type === 'connect_denial') {
      expect(result2.code).toBe('NONCE_REPLAYED')
    }
  })

  it('expired timestamp returns TIMESTAMP_EXPIRED', () => {
    const { broker, registry: reg } = freshBroker()
    registerOrg(reg)
    registerProvider(reg)

    const { signedMessage, publicKey } = createSignedRequest(
      keyPair,
      testProviderNpi,
      { timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString() },
    )
    const result = broker.connect(signedMessage, publicKey)

    expect(result.type).toBe('connect_denial')
    if (result.type === 'connect_denial') {
      expect(result.code).toBe('TIMESTAMP_EXPIRED')
    }
  })

  // --- Provider Lookup Failures ---

  it('NPI not in registry returns PROVIDER_NOT_FOUND', () => {
    const { broker } = freshBroker()
    // No providers registered at all

    const { signedMessage, publicKey } = createSignedRequest(keyPair, '9999999995')
    const result = broker.connect(signedMessage, publicKey)

    expect(result.type).toBe('connect_denial')
    if (result.type === 'connect_denial') {
      expect(result.code).toBe('PROVIDER_NOT_FOUND')
    }
  })

  // --- Credential Status Failures ---

  it('pending credential_status returns CREDENTIALS_INVALID', () => {
    const { broker, registry: reg } = freshBroker()
    registerOrg(reg)
    // Register provider but do NOT set credential_status to active (stays 'pending')
    reg.registerProvider({
      npi: testProviderNpi,
      name: 'Dr. Pending',
      provider_types: ['physician'],
      affiliations: [{ organization_npi: testOrgNpi, organization_name: 'Test Hospital' }],
    })

    const { signedMessage, publicKey } = createSignedRequest(keyPair, testProviderNpi)
    const result = broker.connect(signedMessage, publicKey)

    expect(result.type).toBe('connect_denial')
    if (result.type === 'connect_denial') {
      expect(result.code).toBe('CREDENTIALS_INVALID')
    }
  })

  it('expired credential_status returns CREDENTIALS_INVALID', () => {
    const { broker, registry: reg } = freshBroker()
    registerOrg(reg)
    registerProvider(reg)
    // Change to expired
    reg.findByNPI(testProviderNpi)!.credential_status = 'expired'

    const { signedMessage, publicKey } = createSignedRequest(keyPair, testProviderNpi)
    const result = broker.connect(signedMessage, publicKey)

    expect(result.type).toBe('connect_denial')
    if (result.type === 'connect_denial') {
      expect(result.code).toBe('CREDENTIALS_INVALID')
    }
  })

  it('suspended credential_status returns CREDENTIALS_INVALID', () => {
    const { broker, registry: reg } = freshBroker()
    registerOrg(reg)
    registerProvider(reg)
    reg.findByNPI(testProviderNpi)!.credential_status = 'suspended'

    const { signedMessage, publicKey } = createSignedRequest(keyPair, testProviderNpi)
    const result = broker.connect(signedMessage, publicKey)

    expect(result.type).toBe('connect_denial')
    if (result.type === 'connect_denial') {
      expect(result.code).toBe('CREDENTIALS_INVALID')
    }
  })

  it('revoked credential_status returns CREDENTIALS_INVALID', () => {
    const { broker, registry: reg } = freshBroker()
    registerOrg(reg)
    registerProvider(reg)
    reg.findByNPI(testProviderNpi)!.credential_status = 'revoked'

    const { signedMessage, publicKey } = createSignedRequest(keyPair, testProviderNpi)
    const result = broker.connect(signedMessage, publicKey)

    expect(result.type).toBe('connect_denial')
    if (result.type === 'connect_denial') {
      expect(result.code).toBe('CREDENTIALS_INVALID')
    }
  })

  // --- Endpoint Failures ---

  it('provider with no affiliation returns ENDPOINT_UNAVAILABLE', () => {
    const { broker, registry: reg } = freshBroker()
    // Register provider without affiliations
    reg.registerProvider({
      npi: testProviderNpi,
      name: 'Dr. No Affiliation',
      provider_types: ['physician'],
    })
    reg.findByNPI(testProviderNpi)!.credential_status = 'active'

    const { signedMessage, publicKey } = createSignedRequest(keyPair, testProviderNpi)
    const result = broker.connect(signedMessage, publicKey)

    expect(result.type).toBe('connect_denial')
    if (result.type === 'connect_denial') {
      expect(result.code).toBe('ENDPOINT_UNAVAILABLE')
    }
  })

  it('unreachable endpoint returns ENDPOINT_UNAVAILABLE', () => {
    const { broker, registry: reg } = freshBroker()
    reg.registerNeuron({
      npi: testOrgNpi,
      name: 'Unreachable Hospital',
      organization_name: 'Unreachable Hospital System',
      endpoint: {
        url: 'https://neuron.unreachable.example/axon',
        protocol_version: '1.0.0',
        health_status: 'unreachable',
        last_heartbeat: new Date().toISOString(),
      },
    })
    reg.findByNPI(testOrgNpi)!.credential_status = 'active'
    registerProvider(reg)

    const { signedMessage, publicKey } = createSignedRequest(keyPair, testProviderNpi)
    const result = broker.connect(signedMessage, publicKey)

    expect(result.type).toBe('connect_denial')
    if (result.type === 'connect_denial') {
      expect(result.code).toBe('ENDPOINT_UNAVAILABLE')
    }
  })

  it('stale heartbeat (>5 minutes old) returns ENDPOINT_UNAVAILABLE', () => {
    const { broker, registry: reg } = freshBroker()
    reg.registerNeuron({
      npi: testOrgNpi,
      name: 'Stale Hospital',
      organization_name: 'Stale Hospital System',
      endpoint: {
        url: 'https://neuron.stale.example/axon',
        protocol_version: '1.0.0',
        health_status: 'reachable',
        last_heartbeat: new Date(Date.now() - 6 * 60 * 1000).toISOString(), // 6 min ago
      },
    })
    reg.findByNPI(testOrgNpi)!.credential_status = 'active'
    registerProvider(reg)

    const { signedMessage, publicKey } = createSignedRequest(keyPair, testProviderNpi)
    const result = broker.connect(signedMessage, publicKey)

    expect(result.type).toBe('connect_denial')
    if (result.type === 'connect_denial') {
      expect(result.code).toBe('ENDPOINT_UNAVAILABLE')
    }
  })

  // --- Organization Direct Endpoint ---

  it('organization entity uses its own endpoint directly (not via affiliation)', () => {
    const { broker, registry: reg } = freshBroker()
    reg.registerNeuron({
      npi: testOrgNpi,
      name: 'Direct Org',
      organization_name: 'Direct Org System',
      endpoint: {
        url: 'https://neuron.direct-org.example/axon',
        protocol_version: '1.0.0',
        health_status: 'reachable',
        last_heartbeat: new Date().toISOString(),
      },
    })
    reg.findByNPI(testOrgNpi)!.credential_status = 'active'

    // Connect directly to the organization NPI (not an individual provider)
    const { signedMessage, publicKey } = createSignedRequest(keyPair, testOrgNpi)
    const result = broker.connect(signedMessage, publicKey)

    expect(result.type).toBe('connect_grant')
    if (result.type === 'connect_grant') {
      expect(result.neuron_endpoint).toBe('https://neuron.direct-org.example/axon')
    }
  })

  it('organization with no endpoint returns ENDPOINT_UNAVAILABLE', () => {
    const { broker, registry: reg } = freshBroker()
    reg.registerNeuron({
      npi: testOrgNpi,
      name: 'No Endpoint Org',
      organization_name: 'No Endpoint System',
      endpoint: {
        url: 'https://neuron.example/axon',
        protocol_version: '1.0.0',
        health_status: 'reachable',
        last_heartbeat: new Date().toISOString(),
      },
    })
    const orgEntry = reg.findByNPI(testOrgNpi)!
    orgEntry.credential_status = 'active'
    // Remove the endpoint to simulate missing endpoint
    delete (orgEntry as Record<string, unknown>).neuron_endpoint

    const { signedMessage, publicKey } = createSignedRequest(keyPair, testOrgNpi)
    const result = broker.connect(signedMessage, publicKey)

    expect(result.type).toBe('connect_denial')
    if (result.type === 'connect_denial') {
      expect(result.code).toBe('ENDPOINT_UNAVAILABLE')
    }
  })

  it('organization with unreachable endpoint returns ENDPOINT_UNAVAILABLE', () => {
    const { broker, registry: reg } = freshBroker()
    reg.registerNeuron({
      npi: testOrgNpi,
      name: 'Unreachable Org',
      organization_name: 'Unreachable Org System',
      endpoint: {
        url: 'https://neuron.unreachable-org.example/axon',
        protocol_version: '1.0.0',
        health_status: 'unreachable',
        last_heartbeat: new Date().toISOString(),
      },
    })
    reg.findByNPI(testOrgNpi)!.credential_status = 'active'

    const { signedMessage, publicKey } = createSignedRequest(keyPair, testOrgNpi)
    const result = broker.connect(signedMessage, publicKey)

    expect(result.type).toBe('connect_denial')
    if (result.type === 'connect_denial') {
      expect(result.code).toBe('ENDPOINT_UNAVAILABLE')
    }
  })

  it('organization with stale heartbeat returns ENDPOINT_UNAVAILABLE', () => {
    const { broker, registry: reg } = freshBroker()
    reg.registerNeuron({
      npi: testOrgNpi,
      name: 'Stale Org',
      organization_name: 'Stale Org System',
      endpoint: {
        url: 'https://neuron.stale-org.example/axon',
        protocol_version: '1.0.0',
        health_status: 'reachable',
        last_heartbeat: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
      },
    })
    reg.findByNPI(testOrgNpi)!.credential_status = 'active'

    const { signedMessage, publicKey } = createSignedRequest(keyPair, testOrgNpi)
    const result = broker.connect(signedMessage, publicKey)

    expect(result.type).toBe('connect_denial')
    if (result.type === 'connect_denial') {
      expect(result.code).toBe('ENDPOINT_UNAVAILABLE')
    }
  })

  // --- Audit Trail Integration ---

  it('audit trail populated with connect_attempt and connect_granted after grant', () => {
    const { broker, registry: reg, auditPath } = freshBroker()
    registerOrg(reg)
    registerProvider(reg)

    const { signedMessage, publicKey } = createSignedRequest(keyPair, testProviderNpi)
    broker.connect(signedMessage, publicKey)

    const content = readFileSync(auditPath, 'utf-8')
    const lines = content.trim().split('\n')
    const entries = lines.map((line) => JSON.parse(line) as AuditEntry)

    // Should have connect_attempt + connect_granted
    const eventTypes = entries.map((e) => e.event_type)
    expect(eventTypes).toContain('connect_attempt')
    expect(eventTypes).toContain('connect_granted')
  })

  it('audit trail populated with connect_denied after denial', () => {
    const { broker, auditPath } = freshBroker()
    // No providers registered -> PROVIDER_NOT_FOUND

    const { signedMessage, publicKey } = createSignedRequest(keyPair, '9999999995')
    broker.connect(signedMessage, publicKey)

    const content = readFileSync(auditPath, 'utf-8')
    const lines = content.trim().split('\n')
    const entries = lines.map((line) => JSON.parse(line) as AuditEntry)

    const eventTypes = entries.map((e) => e.event_type)
    expect(eventTypes).toContain('connect_denied')
  })
})
