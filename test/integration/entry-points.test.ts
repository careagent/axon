/**
 * Consumer integration tests using real @careagent/axon package-name imports.
 *
 * All imports use the `@careagent/axon` package name (not relative paths)
 * to validate the full resolution chain: package.json exports map -> dist
 * file paths -> subpath resolution. This matches how provider-core,
 * patient-core, and neuron will consume the package.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { AxonTaxonomy } from '@careagent/axon/taxonomy'
import {
  AxonRegistry,
  AxonBroker,
  generateKeyPair,
  signPayload,
  generateNonce,
} from '@careagent/axon'
import { createMockAxonServer, DEFAULT_FIXTURES } from '@careagent/axon/mock'
import type { MockAxonServer } from '@careagent/axon/mock'

// ---------------------------------------------------------------
// INTG-01: Provider-core integration -- taxonomy consumption
// ---------------------------------------------------------------

describe('Provider-core: taxonomy consumption', () => {
  it('can get actions for physician type for scope.permitted_actions', () => {
    const actions = AxonTaxonomy.getActionsForType('physician')
    expect(actions.length).toBeGreaterThan(0)
    for (const actionId of actions) {
      expect(actionId).toMatch(/^[a-z]+(\.[a-z_]+)+$/)
    }
  })

  it('can validate individual action IDs from CANS scope', () => {
    expect(AxonTaxonomy.validateAction('chart.progress_note')).toBe(true)
    expect(AxonTaxonomy.validateAction('nonexistent.action')).toBe(false)
  })

  it('can get provider types for onboarding type selection', () => {
    const types = AxonTaxonomy.getProviderTypes()
    expect(types.length).toBe(49)
  })
})

// ---------------------------------------------------------------
// INTG-02: Patient-core integration -- provider discovery and connection
// ---------------------------------------------------------------

describe('Patient-core: provider discovery and connection', () => {
  let server: MockAxonServer
  let url: string

  beforeAll(async () => {
    server = createMockAxonServer()
    url = await server.start()
  })

  afterAll(async () => {
    await server.stop()
  })

  it('can search for providers by specialty', async () => {
    const res = await fetch(`${url}/v1/registry/search?specialty=internal_medicine`)

    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      results: Array<{ npi: string; name: string; specialty?: string }>
    }
    expect(data.results.length).toBeGreaterThanOrEqual(1)
    for (const result of data.results) {
      expect(result.specialty).toBe('internal_medicine')
    }
  })

  it('can initiate a connection through the broker', async () => {
    // Generate Ed25519 key pair (real crypto)
    const keyPair = generateKeyPair()

    // Build a ConnectRequest targeting pre-seeded active provider (Dr. Sarah Chen)
    const request = {
      version: '1.0.0' as const,
      type: 'connect_request' as const,
      timestamp: new Date().toISOString(),
      nonce: generateNonce(),
      patient_agent_id: 'patient-core-integration-test',
      provider_npi: '1679576722',
      patient_public_key: keyPair.publicKey,
    }

    // Sign the payload with the patient's Ed25519 private key
    const payloadStr = JSON.stringify(request)
    const payload = Buffer.from(payloadStr).toString('base64url')
    const signature = signPayload(
      payloadStr,
      keyPair.privateKey,
      keyPair.publicKey,
    )

    // POST to mock server's /v1/connect endpoint
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
    // Grant includes the neuron endpoint for direct P2P communication
    expect(data.neuron_endpoint).toBe(
      'https://neuron.metrohealth.example.com/v1',
    )
  })
})

// ---------------------------------------------------------------
// INTG-03: Neuron integration -- registration and endpoint management
// ---------------------------------------------------------------

describe('Neuron: registration and endpoint management', () => {
  let server: MockAxonServer
  let url: string

  beforeAll(async () => {
    server = createMockAxonServer()
    url = await server.start()
  })

  afterAll(async () => {
    await server.stop()
  })

  it('can register a neuron', async () => {
    const res = await fetch(`${url}/v1/neurons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_npi: '1000000061',
        organization_name: 'Neuron Integration Test Org',
        organization_type: 'health_system',
        neuron_endpoint_url: 'https://neuron.integration-test.example/v1',
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

  it('can register providers under a neuron', async () => {
    // First register the neuron
    const regRes = await fetch(`${url}/v1/neurons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_npi: '1000000079',
        organization_name: 'Provider Registration Test Org',
        organization_type: 'clinic',
        neuron_endpoint_url: 'https://neuron.provregtest.example/v1',
      }),
    })
    const regData = (await regRes.json()) as { registration_id: string }

    // Register a provider under the neuron
    const res = await fetch(
      `${url}/v1/neurons/${regData.registration_id}/providers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_npi: '1000000087',
          provider_name: 'Dr. Integration Test',
          provider_types: ['physician'],
          specialty: 'internal_medicine',
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

  it('can update endpoint (heartbeat)', async () => {
    // Register a neuron
    const regRes = await fetch(`${url}/v1/neurons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_npi: '1000000095',
        organization_name: 'Heartbeat Test Org',
        organization_type: 'hospital',
        neuron_endpoint_url: 'https://neuron.heartbeattest.example/v1',
      }),
    })
    const regData = (await regRes.json()) as { registration_id: string }

    // Send heartbeat (endpoint update)
    const res = await fetch(
      `${url}/v1/neurons/${regData.registration_id}/endpoint`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          neuron_endpoint_url:
            'https://neuron.heartbeattest.example/v1/updated',
        }),
      },
    )

    expect(res.status).toBe(200)
    const data = (await res.json()) as { status: string }
    expect(data.status).toBe('reachable')
  })
})
