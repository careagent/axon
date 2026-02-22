import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AxonRegistry } from '../registry/registry.js'
import { AxonBroker } from '../broker/broker.js'
import { AuditTrail } from '../broker/audit.js'
import { SignedMessageValidator } from '../protocol/schemas.js'
import type { MockFixtures } from './fixtures.js'
import { DEFAULT_FIXTURES } from './fixtures.js'
import { AxonTaxonomy } from '../taxonomy/taxonomy.js'
import { AxonQuestionnaires } from '../questionnaires/questionnaires.js'
import type { RegistryEntry, SignedMessage } from '../types/index.js'

/** Options for creating a mock Axon server. */
export interface MockAxonOptions {
  /** Port to listen on. 0 (default) for dynamic port assignment. */
  port?: number
  /** Override default fixtures for pre-seeding. */
  fixtures?: MockFixtures
  /** Configure forced failure scenarios for testing error paths. */
  failureMode?: {
    /** Force credential check failures on connect. */
    expiredCredentials?: boolean
    /** Force endpoint lookup failures on connect. */
    endpointUnavailable?: boolean
  }
}

/** Running mock Axon HTTP server instance. */
export interface MockAxonServer {
  /** Base URL of the running server (e.g., 'http://localhost:54321'). */
  readonly url: string
  /** Internal registry used by the server -- inspect for test assertions. */
  readonly registry: AxonRegistry
  /** Start the server and return the base URL. */
  start(): Promise<string>
  /** Stop the server and clean up temp files. */
  stop(): Promise<void>
}

/**
 * Create a mock Axon HTTP server for integration testing.
 *
 * Pre-seeds the registry with realistic fixtures and implements
 * all HTTP routes matching the neuron AxonClient contract plus
 * search and connect endpoints.
 *
 * @example
 * ```ts
 * const server = createMockAxonServer()
 * const url = await server.start()
 * // POST ${url}/v1/neurons to register a neuron
 * await server.stop()
 * ```
 */
export function createMockAxonServer(
  options: MockAxonOptions = {},
): MockAxonServer {
  const {
    port = 0,
    fixtures = DEFAULT_FIXTURES,
    failureMode = {},
  } = options

  let baseUrl = ''
  let tempDir: string | undefined
  let httpServer: http.Server | undefined
  let registry: AxonRegistry | undefined
  let broker: AxonBroker | undefined

  // Map registration_id -> { npi, bearer_token } for neuron tracking
  const neuronTokens = new Map<
    string,
    { npi: string; bearer_token: string }
  >()

  function readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = ''
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString()
      })
      req.on('end', () => resolve(body))
      req.on('error', reject)
    })
  }

  function sendJson(
    res: http.ServerResponse,
    statusCode: number,
    data: unknown,
  ): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }

  /** Seed the registry with fixture data. */
  function seedFixtures(reg: AxonRegistry, fx: MockFixtures): void {
    for (const org of fx.organizations) {
      const entry = reg.registerNeuron({
        npi: org.organization_npi,
        name: org.organization_name,
        organization_name: org.organization_name,
        endpoint: {
          url: org.neuron_endpoint_url,
          protocol_version: '1.0.0',
          health_status: 'reachable',
          last_heartbeat: new Date().toISOString(),
        },
      })
      // Set organization to active credential status
      entry.credential_status = 'active'
    }

    for (const prov of fx.providers) {
      const entry = reg.registerProvider({
        npi: prov.npi,
        name: prov.name,
        provider_types: [prov.provider_type],
        specialty: prov.specialty,
        affiliations: [
          {
            organization_npi: prov.organization_npi,
            organization_name:
              fx.organizations.find(
                (o) => o.organization_npi === prov.organization_npi,
              )?.organization_name ?? 'Unknown',
          },
        ],
      })

      // Add credentials
      for (const cred of prov.credentials) {
        reg.addCredential(prov.npi, {
          type: cred.credential_type,
          issuer: cred.issuer,
          identifier: cred.credential_id,
          status: cred.status,
          issued_at: cred.issued_date,
          expires_at: cred.expiry_date,
        })
      }

      // Derive credential_status from individual credentials
      const hasExpired = prov.credentials.some(
        (c) => c.status === 'expired',
      )
      const allActive = prov.credentials.every(
        (c) => c.status === 'active',
      )
      if (allActive && prov.credentials.length > 0) {
        entry.credential_status = 'active'
      } else if (hasExpired) {
        entry.credential_status = 'expired'
      }
    }
  }

  /** Handle incoming HTTP requests. */
  async function handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const reg = registry!
    const url = new URL(req.url!, baseUrl)
    const { pathname } = url

    // POST /v1/neurons -- register neuron
    if (req.method === 'POST' && pathname === '/v1/neurons') {
      const body = await readBody(req)
      const payload = JSON.parse(body) as {
        organization_npi: string
        organization_name: string
        organization_type: string
        neuron_endpoint_url: string
      }

      try {
        const entry = reg.registerNeuron({
          npi: payload.organization_npi,
          name: payload.organization_name,
          organization_name: payload.organization_name,
          endpoint: {
            url: payload.neuron_endpoint_url,
            protocol_version: '1.0.0',
            health_status: 'reachable',
            last_heartbeat: new Date().toISOString(),
          },
        })
        entry.credential_status = 'active'

        const registrationId = randomUUID()
        const bearerToken = `mock-token-${registrationId}`
        neuronTokens.set(registrationId, {
          npi: payload.organization_npi,
          bearer_token: bearerToken,
        })

        sendJson(res, 201, {
          registration_id: registrationId,
          bearer_token: bearerToken,
          status: 'reachable',
        })
      } catch (err) {
        sendJson(res, 400, {
          error: err instanceof Error ? err.message : 'Registration failed',
        })
      }
      return
    }

    // PUT /v1/neurons/:id/endpoint -- heartbeat / endpoint update
    const endpointMatch = pathname.match(
      /^\/v1\/neurons\/([^/]+)\/endpoint$/,
    )
    if (req.method === 'PUT' && endpointMatch) {
      const registrationId = endpointMatch[1]!
      const neuronRef = neuronTokens.get(registrationId)
      if (!neuronRef) {
        sendJson(res, 404, { error: 'Neuron not found' })
        return
      }

      const body = await readBody(req)
      const payload = JSON.parse(body) as {
        neuron_endpoint_url?: string
      }

      const entry = reg.findByNPI(neuronRef.npi)
      if (entry && entry.entity_type === 'organization') {
        const newUrl =
          payload.neuron_endpoint_url ??
          entry.neuron_endpoint?.url ??
          ''
        reg.updateEndpoint(neuronRef.npi, {
          url: newUrl,
          protocol_version: '1.0.0',
          health_status: 'reachable',
          last_heartbeat: new Date().toISOString(),
        })
      }

      sendJson(res, 200, { status: 'reachable' })
      return
    }

    // POST /v1/neurons/:id/providers -- register provider
    const providersPostMatch = pathname.match(
      /^\/v1\/neurons\/([^/]+)\/providers$/,
    )
    if (req.method === 'POST' && providersPostMatch) {
      const registrationId = providersPostMatch[1]!
      const neuronRef = neuronTokens.get(registrationId)
      if (!neuronRef) {
        sendJson(res, 404, { error: 'Neuron not found' })
        return
      }

      const body = await readBody(req)
      const payload = JSON.parse(body) as {
        provider_npi: string
        provider_name: string
        provider_types: string[]
        specialty?: string
        credentials?: Array<{
          type: 'license' | 'certification' | 'privilege'
          issuer: string
          identifier: string
          status: 'active' | 'pending' | 'expired' | 'suspended' | 'revoked'
          issued_at?: string
          expires_at?: string
        }>
      }

      try {
        // Look up the organization name
        const orgEntry = reg.findByNPI(neuronRef.npi)
        const orgName =
          orgEntry?.organization_name ?? 'Unknown Organization'

        reg.registerProvider({
          npi: payload.provider_npi,
          name: payload.provider_name,
          provider_types: payload.provider_types,
          ...(payload.specialty !== undefined && {
            specialty: payload.specialty,
          }),
          affiliations: [
            {
              organization_npi: neuronRef.npi,
              organization_name: orgName,
            },
          ],
          ...(payload.credentials !== undefined && {
            credentials: payload.credentials,
          }),
        })

        const providerId = randomUUID()
        sendJson(res, 201, {
          provider_id: providerId,
          status: 'registered',
        })
      } catch (err) {
        sendJson(res, 400, {
          error:
            err instanceof Error
              ? err.message
              : 'Provider registration failed',
        })
      }
      return
    }

    // DELETE /v1/neurons/:id/providers/:npi -- remove provider (no-op mock)
    const providerDeleteMatch = pathname.match(
      /^\/v1\/neurons\/([^/]+)\/providers\/([^/]+)$/,
    )
    if (req.method === 'DELETE' && providerDeleteMatch) {
      // No-op for v1 mock -- return 204 for API compatibility
      res.writeHead(204)
      res.end()
      return
    }

    // GET /v1/neurons/:id -- get neuron state
    const neuronGetMatch = pathname.match(/^\/v1\/neurons\/([^/]+)$/)
    if (req.method === 'GET' && neuronGetMatch) {
      const registrationId = neuronGetMatch[1]!
      const neuronRef = neuronTokens.get(registrationId)
      if (!neuronRef) {
        sendJson(res, 404, { error: 'Neuron not found' })
        return
      }

      const entry = reg.findByNPI(neuronRef.npi)
      if (!entry) {
        sendJson(res, 404, { error: 'Neuron not found' })
        return
      }

      sendJson(res, 200, entry)
      return
    }

    // GET /v1/taxonomy/actions -- taxonomy actions for a provider type
    if (req.method === 'GET' && pathname === '/v1/taxonomy/actions') {
      const providerType = url.searchParams.get('type')
      if (!providerType) {
        sendJson(res, 400, { error: 'Missing required query parameter: type' })
        return
      }

      const typeExists = AxonTaxonomy.getType(providerType) !== undefined
      if (!typeExists) {
        sendJson(res, 404, { error: `Unknown provider type: "${providerType}"` })
        return
      }

      const actionIds = AxonTaxonomy.getActionsForType(providerType)
      const actions = actionIds
        .map((id) => AxonTaxonomy.getAction(id))
        .filter((a) => a !== undefined)

      sendJson(res, 200, { actions })
      return
    }

    // GET /v1/questionnaires/:typeId -- questionnaire for a provider type
    const questionnaireMatch = pathname.match(/^\/v1\/questionnaires\/([^/]+)$/)
    if (req.method === 'GET' && questionnaireMatch) {
      const typeId = questionnaireMatch[1]!
      const questionnaire = AxonQuestionnaires.getForType(typeId)

      if (!questionnaire) {
        sendJson(res, 404, { error: `No questionnaire found for provider type: "${typeId}"` })
        return
      }

      sendJson(res, 200, questionnaire)
      return
    }

    // GET /v1/registry/search -- provider search
    if (req.method === 'GET' && pathname === '/v1/registry/search') {
      const npi = url.searchParams.get('npi') ?? undefined
      const name = url.searchParams.get('name') ?? undefined
      const specialty = url.searchParams.get('specialty') ?? undefined
      const providerType =
        url.searchParams.get('provider_type') ?? undefined
      const organization =
        url.searchParams.get('organization') ?? undefined
      const credentialStatus =
        url.searchParams.get('credential_status') ?? undefined
      const limitParam = url.searchParams.get('limit')
      const offsetParam = url.searchParams.get('offset')

      const results = reg.search({
        ...(npi !== undefined && { npi }),
        ...(name !== undefined && { name }),
        ...(specialty !== undefined && { specialty }),
        ...(providerType !== undefined && {
          provider_type: providerType,
        }),
        ...(organization !== undefined && { organization }),
        ...(credentialStatus !== undefined && {
          credential_status: credentialStatus as
            | 'active'
            | 'pending'
            | 'expired'
            | 'suspended'
            | 'revoked',
        }),
        ...(limitParam !== null && { limit: Number(limitParam) }),
        ...(offsetParam !== null && { offset: Number(offsetParam) }),
      })

      sendJson(res, 200, { results })
      return
    }

    // GET /v1/registry/:npi -- direct NPI lookup
    const registryNpiMatch = pathname.match(/^\/v1\/registry\/([^/]+)$/)
    if (req.method === 'GET' && registryNpiMatch) {
      const npi = registryNpiMatch[1]!

      const entry = reg.findByNPI(npi)
      if (!entry) {
        sendJson(res, 404, { error: `No registry entry found for NPI: "${npi}"` })
        return
      }

      sendJson(res, 200, entry)
      return
    }

    // POST /v1/connect -- broker connect
    if (req.method === 'POST' && pathname === '/v1/connect') {
      const body = await readBody(req)
      let parsed: unknown
      try {
        parsed = JSON.parse(body)
      } catch {
        sendJson(res, 400, { error: 'Invalid JSON' })
        return
      }

      // Expect { signed_message: { payload, signature }, patient_public_key }
      const envelope = parsed as {
        signed_message?: unknown
        patient_public_key?: string
      }

      if (
        !envelope.signed_message ||
        !envelope.patient_public_key
      ) {
        sendJson(res, 400, {
          error:
            'Missing signed_message or patient_public_key',
        })
        return
      }

      if (!SignedMessageValidator.Check(envelope.signed_message)) {
        sendJson(res, 400, {
          error: 'Invalid signed_message format',
        })
        return
      }

      const signedMessage = envelope.signed_message as SignedMessage

      // If failure modes are configured, check before running broker
      if (failureMode.expiredCredentials === true) {
        sendJson(res, 403, {
          type: 'connect_denial',
          connection_id: randomUUID(),
          code: 'CREDENTIALS_INVALID',
          message:
            'Provider credentials are not in active status',
        })
        return
      }

      if (failureMode.endpointUnavailable === true) {
        sendJson(res, 403, {
          type: 'connect_denial',
          connection_id: randomUUID(),
          code: 'ENDPOINT_UNAVAILABLE',
          message: 'Provider endpoint is not available',
        })
        return
      }

      const result = broker!.connect(
        signedMessage,
        envelope.patient_public_key,
      )

      if (result.type === 'connect_grant') {
        sendJson(res, 200, result)
      } else {
        const statusCode =
          result.code === 'SIGNATURE_INVALID' ||
          result.code === 'NONCE_REPLAYED' ||
          result.code === 'TIMESTAMP_EXPIRED'
            ? 400
            : 403
        sendJson(res, statusCode, result)
      }
      return
    }

    // Default: 404
    sendJson(res, 404, { error: 'Not found' })
  }

  const server: MockAxonServer = {
    get url() {
      return baseUrl
    },
    get registry() {
      return registry!
    },

    async start(): Promise<string> {
      // 1. Create temp directory for registry persistence
      tempDir = mkdtempSync(
        join(tmpdir(), 'axon-mock-server-'),
      )
      const registryPath = join(tempDir, 'registry.json')
      const auditPath = join(tempDir, 'audit.jsonl')

      // 2. Instantiate registry
      registry = new AxonRegistry(registryPath)

      // 3. Seed fixtures
      seedFixtures(registry, fixtures)

      // 4. Create audit trail and broker
      const audit = new AuditTrail(auditPath)
      broker = new AxonBroker(registry, audit)

      // 5. Also create neuronTokens entries for pre-seeded organizations
      // so GET /v1/neurons/:id can look them up
      for (const org of fixtures.organizations) {
        const regId = randomUUID()
        neuronTokens.set(regId, {
          npi: org.organization_npi,
          bearer_token: `mock-token-${regId}`,
        })
      }

      // 6. Start HTTP server
      return new Promise<string>((resolve, reject) => {
        httpServer = http.createServer(
          (req, res) => {
            handleRequest(req, res).catch((err) => {
              sendJson(res, 500, {
                error:
                  err instanceof Error
                    ? err.message
                    : 'Internal server error',
              })
            })
          },
        )

        httpServer.on('error', reject)
        httpServer.listen(port, () => {
          const addr = httpServer!.address()
          if (typeof addr === 'object' && addr !== null) {
            baseUrl = `http://localhost:${addr.port}`
          }
          resolve(baseUrl)
        })
      })
    },

    async stop(): Promise<void> {
      if (httpServer) {
        await new Promise<void>((resolve, reject) => {
          httpServer!.close((err) => {
            if (err) reject(err)
            else resolve()
          })
        })
        httpServer = undefined
      }

      if (tempDir) {
        rmSync(tempDir, { recursive: true, force: true })
        tempDir = undefined
      }
    },
  }

  return server
}
