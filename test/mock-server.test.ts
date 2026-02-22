import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createMockAxonServer } from '../src/mock/server.js'
import { DEFAULT_FIXTURES } from '../src/mock/fixtures.js'
import {
  generateKeyPair,
  signPayload,
  generateNonce,
} from '../src/protocol/identity.js'
import type { MockAxonServer } from '../src/mock/server.js'

describe('MockAxonServer', () => {
  let server: MockAxonServer
  let url: string

  beforeAll(async () => {
    server = createMockAxonServer()
    url = await server.start()
  })

  afterAll(async () => {
    await server.stop()
  })

  // --- Neuron Registration ---

  it('POST /v1/neurons registers a neuron and returns 201 with registration_id and bearer_token', async () => {
    const res = await fetch(`${url}/v1/neurons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_npi: '1000000004',
        organization_name: 'Test Clinic',
        organization_type: 'clinic',
        neuron_endpoint_url: 'https://neuron.testclinic.example/v1',
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

  // --- Endpoint Update (Heartbeat) ---

  it('PUT /v1/neurons/:id/endpoint returns 200 with reachable status', async () => {
    // First register a fresh neuron to get a registration_id (use NPI not in fixtures)
    const regRes = await fetch(`${url}/v1/neurons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_npi: '1000000020',
        organization_name: 'Heartbeat Hospital',
        organization_type: 'hospital',
        neuron_endpoint_url: 'https://neuron.heartbeat.example/v1',
      }),
    })
    const regData = (await regRes.json()) as { registration_id: string }

    const res = await fetch(
      `${url}/v1/neurons/${regData.registration_id}/endpoint`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    )

    expect(res.status).toBe(200)
    const data = (await res.json()) as { status: string }
    expect(data.status).toBe('reachable')
  })

  // --- Provider Registration ---

  it('POST /v1/neurons/:id/providers returns 201 with provider_id', async () => {
    // Register a neuron first (use NPI not in fixtures)
    const regRes = await fetch(`${url}/v1/neurons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_npi: '1000000038',
        organization_name: 'Provider Test Org',
        organization_type: 'practice',
        neuron_endpoint_url: 'https://neuron.provtest.example/v1',
      }),
    })
    const regData = (await regRes.json()) as { registration_id: string }

    const res = await fetch(
      `${url}/v1/neurons/${regData.registration_id}/providers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_npi: '1000000046',
          provider_name: 'Dr. Test Provider',
          provider_types: ['physician'],
          specialty: 'surgery',
        }),
      },
    )

    expect(res.status).toBe(201)
    const data = (await res.json()) as {
      provider_id: string
      status: string
    }
    expect(data.provider_id).toBeTruthy()
    expect(data.status).toBe('registered')
  })

  // --- Provider Removal ---

  it('DELETE /v1/neurons/:id/providers/:npi returns 204', async () => {
    const res = await fetch(
      `${url}/v1/neurons/fake-id/providers/1234567890`,
      { method: 'DELETE' },
    )
    expect(res.status).toBe(204)
  })

  // --- Get Neuron State ---

  it('GET /v1/neurons/:id returns neuron entry from registry', async () => {
    // Register a neuron
    const regRes = await fetch(`${url}/v1/neurons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_npi: '1000000012',
        organization_name: 'Get Test Org',
        organization_type: 'system',
        neuron_endpoint_url: 'https://neuron.gettest.example/v1',
      }),
    })
    const regData = (await regRes.json()) as { registration_id: string }

    const res = await fetch(
      `${url}/v1/neurons/${regData.registration_id}`,
    )

    expect(res.status).toBe(200)
    const data = (await res.json()) as { npi: string; entity_type: string }
    expect(data.npi).toBe('1000000012')
    expect(data.entity_type).toBe('organization')
  })

  // --- Search ---

  it('GET /v1/search?provider_type=physician returns pre-seeded providers', async () => {
    const res = await fetch(
      `${url}/v1/search?provider_type=physician`,
    )

    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      results: Array<{ npi: string; name: string }>
    }
    expect(data.results.length).toBeGreaterThanOrEqual(3) // At least the 3 fixture providers
    const npis = data.results.map((r) => r.npi)
    expect(npis).toContain('1679576722') // Dr. Sarah Chen
    expect(npis).toContain('1376841239') // Dr. James Wilson
    expect(npis).toContain('1003000126') // Dr. Robert Hayes
  })

  it('GET /v1/search?specialty=surgery returns only surgery providers', async () => {
    const res = await fetch(
      `${url}/v1/search?specialty=surgery`,
    )

    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      results: Array<{ name: string; specialty?: string }>
    }
    expect(data.results.length).toBeGreaterThanOrEqual(1)
    for (const result of data.results) {
      expect(result.specialty).toBe('surgery')
    }
  })

  it('GET /v1/search?credential_status=expired returns providers with expired status', async () => {
    const res = await fetch(
      `${url}/v1/search?credential_status=expired`,
    )

    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      results: Array<{ npi: string; credential_status: string }>
    }
    expect(data.results.length).toBeGreaterThanOrEqual(1)
    expect(data.results[0]!.npi).toBe('1003000126') // Dr. Robert Hayes
  })

  // --- Connect ---

  it('POST /v1/connect with valid signed message returns connect_grant', async () => {
    const keyPair = generateKeyPair()

    // Use a pre-seeded active provider (Dr. Sarah Chen)
    const request = {
      version: '1.0.0' as const,
      type: 'connect_request' as const,
      timestamp: new Date().toISOString(),
      nonce: generateNonce(),
      patient_agent_id: 'test-patient-agent',
      provider_npi: '1679576722',
      patient_public_key: keyPair.publicKey,
    }

    const payloadStr = JSON.stringify(request)
    const payload = Buffer.from(payloadStr).toString('base64url')
    const signature = signPayload(
      payloadStr,
      keyPair.privateKey,
      keyPair.publicKey,
    )

    const res = await fetch(`${url}/v1/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signed_message: { payload, signature },
        patient_public_key: keyPair.publicKey,
      }),
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      type: string
      connection_id: string
      neuron_endpoint: string
    }
    expect(data.type).toBe('connect_grant')
    expect(data.connection_id).toBeTruthy()
    expect(data.neuron_endpoint).toBe(
      'https://neuron.metrohealth.example.com/v1',
    )
  })

  // --- 404 ---

  it('unknown route returns 404', async () => {
    const res = await fetch(`${url}/v1/nonexistent`)
    expect(res.status).toBe(404)
  })
})

describe('MockAxonServer failure modes', () => {
  it('expiredCredentials failure mode forces CREDENTIALS_INVALID on connect', async () => {
    const server = createMockAxonServer({
      failureMode: { expiredCredentials: true },
    })
    const url = await server.start()

    try {
      const keyPair = generateKeyPair()
      const request = {
        version: '1.0.0' as const,
        type: 'connect_request' as const,
        timestamp: new Date().toISOString(),
        nonce: generateNonce(),
        patient_agent_id: 'test-patient',
        provider_npi: '1679576722',
        patient_public_key: keyPair.publicKey,
      }

      const payloadStr = JSON.stringify(request)
      const payload = Buffer.from(payloadStr).toString('base64url')
      const signature = signPayload(
        payloadStr,
        keyPair.privateKey,
        keyPair.publicKey,
      )

      const res = await fetch(`${url}/v1/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signed_message: { payload, signature },
          patient_public_key: keyPair.publicKey,
        }),
      })

      expect(res.status).toBe(403)
      const data = (await res.json()) as {
        type: string
        code: string
      }
      expect(data.type).toBe('connect_denial')
      expect(data.code).toBe('CREDENTIALS_INVALID')
    } finally {
      await server.stop()
    }
  })

  it('endpointUnavailable failure mode forces ENDPOINT_UNAVAILABLE on connect', async () => {
    const server = createMockAxonServer({
      failureMode: { endpointUnavailable: true },
    })
    const url = await server.start()

    try {
      const keyPair = generateKeyPair()
      const request = {
        version: '1.0.0' as const,
        type: 'connect_request' as const,
        timestamp: new Date().toISOString(),
        nonce: generateNonce(),
        patient_agent_id: 'test-patient',
        provider_npi: '1679576722',
        patient_public_key: keyPair.publicKey,
      }

      const payloadStr = JSON.stringify(request)
      const payload = Buffer.from(payloadStr).toString('base64url')
      const signature = signPayload(
        payloadStr,
        keyPair.privateKey,
        keyPair.publicKey,
      )

      const res = await fetch(`${url}/v1/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signed_message: { payload, signature },
          patient_public_key: keyPair.publicKey,
        }),
      })

      expect(res.status).toBe(403)
      const data = (await res.json()) as {
        type: string
        code: string
      }
      expect(data.type).toBe('connect_denial')
      expect(data.code).toBe('ENDPOINT_UNAVAILABLE')
    } finally {
      await server.stop()
    }
  })
})
