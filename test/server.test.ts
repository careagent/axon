import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAxonServer } from '../src/server/index.js'
import { PersistentTokenStore } from '../src/server/tokens.js'
import {
  generateKeyPair,
  signPayload,
  generateNonce,
} from '../src/protocol/identity.js'
import type { AxonServer } from '../src/server/index.js'

describe('AxonServer', () => {
  let server: AxonServer
  let url: string
  let tempDir: string

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'axon-server-test-'))
    server = createAxonServer({ port: 0, host: '127.0.0.1', dataDir: tempDir })
    url = await server.start()
  })

  afterAll(async () => {
    await server.stop()
    rmSync(tempDir, { recursive: true, force: true })
  })

  // --- Health ---

  it('GET /health returns status ok with version and uptime', async () => {
    const res = await fetch(`${url}/health`)
    expect(res.status).toBe(200)
    const data = (await res.json()) as { status: string; version: string; uptime: number }
    expect(data.status).toBe('ok')
    expect(data.version).toBe('1.0.0')
    expect(typeof data.uptime).toBe('number')
  })

  // --- CORS ---

  it('OPTIONS request returns CORS headers with 204', async () => {
    const res = await fetch(`${url}/health`, { method: 'OPTIONS' })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-methods')).toContain('POST')
  })

  it('GET responses include CORS and security headers', async () => {
    const res = await fetch(`${url}/health`)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  // --- Neuron Registration ---

  it('POST /v1/neurons registers a neuron and returns 201', async () => {
    const res = await fetch(`${url}/v1/neurons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_npi: '1245319599',
        organization_name: 'Metro Health System',
        organization_type: 'health_system',
        neuron_endpoint_url: 'https://neuron.metrohealth.example.com/v1',
      }),
    })

    expect(res.status).toBe(201)
    const data = (await res.json()) as {
      registration_id: string
      bearer_token: string
      status: string
    }
    expect(data.registration_id).toBeTruthy()
    expect(data.bearer_token).toBeTruthy()
    expect(data.status).toBe('reachable')
  })

  it('POST /v1/neurons with duplicate NPI returns 400', async () => {
    const res = await fetch(`${url}/v1/neurons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_npi: '1245319599',
        organization_name: 'Duplicate Org',
        organization_type: 'clinic',
        neuron_endpoint_url: 'https://dup.example/v1',
      }),
    })

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toContain('already registered')
  })

  // --- Helper: register neuron for subsequent tests ---

  async function registerNeuron(npi: string, name: string): Promise<{ registration_id: string; bearer_token: string }> {
    const res = await fetch(`${url}/v1/neurons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_npi: npi,
        organization_name: name,
        organization_type: 'clinic',
        neuron_endpoint_url: `https://neuron.${name.toLowerCase().replace(/\s/g, '')}.example/v1`,
      }),
    })
    return (await res.json()) as { registration_id: string; bearer_token: string }
  }

  // --- Heartbeat (Endpoint Update) ---

  it('PUT /v1/neurons/:id/endpoint with valid token returns 200', async () => {
    const { registration_id, bearer_token } = await registerNeuron('1000000004', 'Heartbeat Clinic')

    const res = await fetch(`${url}/v1/neurons/${registration_id}/endpoint`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearer_token}`,
      },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as { status: string }
    expect(data.status).toBe('reachable')
  })

  it('PUT /v1/neurons/:id/endpoint without token returns 401', async () => {
    const { registration_id } = await registerNeuron('1000000012', 'No Token Clinic')

    const res = await fetch(`${url}/v1/neurons/${registration_id}/endpoint`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(401)
  })

  // --- Provider Registration ---

  it('POST /v1/neurons/:id/providers with valid token returns 201', async () => {
    const { registration_id, bearer_token } = await registerNeuron('1000000020', 'Provider Org')

    const res = await fetch(`${url}/v1/neurons/${registration_id}/providers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearer_token}`,
      },
      body: JSON.stringify({
        provider_npi: '1000000038',
        provider_name: 'Dr. Test Provider',
        provider_types: ['physician'],
        specialty: 'surgery',
      }),
    })

    expect(res.status).toBe(201)
    const data = (await res.json()) as { provider_id: string; status: string }
    expect(data.provider_id).toBeTruthy()
    expect(data.status).toBe('registered')
  })

  it('POST /v1/neurons/:id/providers without token returns 401', async () => {
    const res = await fetch(`${url}/v1/neurons/fake-id/providers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider_npi: '1000000046',
        provider_name: 'Dr. Unauthorized',
        provider_types: ['physician'],
      }),
    })

    expect(res.status).toBe(401)
  })

  // --- Provider Removal ---

  it('DELETE /v1/neurons/:id/providers/:npi with valid token returns 204', async () => {
    const { registration_id, bearer_token } = await registerNeuron('1000000046', 'Delete Org')

    const res = await fetch(`${url}/v1/neurons/${registration_id}/providers/1234567890`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${bearer_token}` },
    })

    expect(res.status).toBe(204)
  })

  // --- Registry Search ---

  it('GET /v1/registry/search returns registered providers', async () => {
    const res = await fetch(`${url}/v1/registry/search?provider_type=physician`)
    expect(res.status).toBe(200)
    const data = (await res.json()) as { results: Array<{ npi: string }> }
    expect(Array.isArray(data.results)).toBe(true)
  })

  // --- Registry NPI Lookup ---

  it('GET /v1/registry/:npi returns entry for registered NPI', async () => {
    const res = await fetch(`${url}/v1/registry/1245319599`)
    expect(res.status).toBe(200)
    const data = (await res.json()) as { npi: string }
    expect(data.npi).toBe('1245319599')
  })

  it('GET /v1/registry/:npi returns 404 for unknown NPI', async () => {
    const res = await fetch(`${url}/v1/registry/9999999999`)
    expect(res.status).toBe(404)
  })

  // --- Taxonomy ---

  it('GET /v1/taxonomy/actions?type=physician returns actions', async () => {
    const res = await fetch(`${url}/v1/taxonomy/actions?type=physician`)
    expect(res.status).toBe(200)
    const data = (await res.json()) as { actions: Array<{ id: string }> }
    expect(data.actions.length).toBeGreaterThan(0)
  })

  it('GET /v1/taxonomy/actions without type returns 400', async () => {
    const res = await fetch(`${url}/v1/taxonomy/actions`)
    expect(res.status).toBe(400)
  })

  // --- Questionnaires ---

  it('GET /v1/questionnaires/physician returns questionnaire', async () => {
    const res = await fetch(`${url}/v1/questionnaires/physician`)
    expect(res.status).toBe(200)
    const data = (await res.json()) as { provider_type: string; questions: unknown[] }
    expect(data.provider_type).toBe('physician')
    expect(data.questions.length).toBeGreaterThan(0)
  })

  it('GET /v1/questionnaires/nonexistent returns 404', async () => {
    const res = await fetch(`${url}/v1/questionnaires/nonexistent_type`)
    expect(res.status).toBe(404)
  })

  // --- Connect ---

  it('POST /v1/connect with valid signed message returns connect_grant', async () => {
    // Register org + provider with active credentials to make connect work
    const { registration_id, bearer_token } = await registerNeuron('1000000053', 'Connect Org')

    // Set org to active
    const orgEntry = server.registry.findByNPI('1000000053')!
    orgEntry.credential_status = 'active'

    // Register a provider under this org
    await fetch(`${url}/v1/neurons/${registration_id}/providers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearer_token}`,
      },
      body: JSON.stringify({
        provider_npi: '1000000061',
        provider_name: 'Dr. Connect Test',
        provider_types: ['physician'],
      }),
    })

    // Set provider to active
    const provEntry = server.registry.findByNPI('1000000061')!
    provEntry.credential_status = 'active'

    const keyPair = generateKeyPair()
    const request = {
      version: '1.0.0' as const,
      type: 'connect_request' as const,
      timestamp: new Date().toISOString(),
      nonce: generateNonce(),
      patient_agent_id: 'test-patient-agent',
      provider_npi: '1000000061',
      patient_public_key: keyPair.publicKey,
    }

    const payloadStr = JSON.stringify(request)
    const payload = Buffer.from(payloadStr).toString('base64url')
    const signature = signPayload(payloadStr, keyPair.privateKey, keyPair.publicKey)

    const res = await fetch(`${url}/v1/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signed_message: { payload, signature },
        patient_public_key: keyPair.publicKey,
      }),
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as { type: string; connection_id: string }
    expect(data.type).toBe('connect_grant')
    expect(data.connection_id).toBeTruthy()
  })

  // --- 404 ---

  it('unknown route returns 404', async () => {
    const res = await fetch(`${url}/v1/nonexistent`)
    expect(res.status).toBe(404)
  })
})

describe('PersistentTokenStore', () => {
  it('persists tokens across instances', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'axon-tokens-test-'))
    const tokensPath = join(tempDir, 'tokens.json')

    try {
      const store1 = new PersistentTokenStore(tokensPath)
      const { registration_id, bearer_token } = store1.register('1245319599')

      // Create new instance from same file
      const store2 = new PersistentTokenStore(tokensPath)
      expect(store2.size).toBe(1)
      expect(store2.validateToken(registration_id, bearer_token)).toBe(true)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('rejects invalid bearer tokens', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'axon-tokens-test-'))
    const tokensPath = join(tempDir, 'tokens.json')

    try {
      const store = new PersistentTokenStore(tokensPath)
      const { registration_id } = store.register('1245319599')

      expect(store.validateToken(registration_id, 'wrong-token')).toBe(false)
      expect(store.validateToken('wrong-id', 'wrong-token')).toBe(false)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})

describe('AxonServer graceful shutdown', () => {
  it('stops cleanly and rejects new connections', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'axon-shutdown-test-'))

    try {
      const server = createAxonServer({ port: 0, host: '127.0.0.1', dataDir: tempDir })
      const url = await server.start()

      // Verify it's running
      const res = await fetch(`${url}/health`)
      expect(res.status).toBe(200)

      // Stop
      await server.stop()

      // Connections should fail after stop
      await expect(fetch(`${url}/health`)).rejects.toThrow()
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
