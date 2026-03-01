import http from 'node:http'
import { join } from 'node:path'
import { AxonRegistry } from '../registry/registry.js'
import { AxonBroker } from '../broker/broker.js'
import { AuditTrail } from '../broker/audit.js'
import { AxonTaxonomy } from '../taxonomy/taxonomy.js'
import { AxonQuestionnaires } from '../questionnaires/questionnaires.js'
import { SignedMessageValidator } from '../protocol/schemas.js'
import { PersistentTokenStore } from './tokens.js'
import type { SignedMessage } from '../types/index.js'

const AXON_VERSION = '1.0.0'

/** Configuration for the Axon production server. */
export interface AxonServerConfig {
  port: number
  host: string
  dataDir: string
}

/** Running Axon server instance. */
export interface AxonServer {
  readonly url: string
  readonly registry: AxonRegistry
  start(): Promise<string>
  stop(): Promise<void>
}

/**
 * Create a production Axon HTTP server.
 *
 * Unlike the mock server, this does NOT pre-seed fixtures. State is loaded
 * from persistent storage on startup and survives restarts.
 */
export function createAxonServer(config: AxonServerConfig): AxonServer {
  const { port, host, dataDir } = config

  let baseUrl = ''
  let httpServer: http.Server | undefined

  const registryPath = join(dataDir, 'registry.json')
  const auditPath = join(dataDir, 'audit.jsonl')
  const tokensPath = join(dataDir, 'tokens.json')

  const registry = new AxonRegistry(registryPath)
  const audit = new AuditTrail(auditPath)
  const broker = new AxonBroker(registry, audit)
  const tokenStore = new PersistentTokenStore(tokensPath)

  const startTime = Date.now()

  function readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      let size = 0
      const MAX_BODY = 1_048_576 // 1 MB

      req.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_BODY) {
          req.destroy()
          reject(new Error('Request body too large'))
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      req.on('error', reject)
    })
  }

  function sendJson(
    res: http.ServerResponse,
    statusCode: number,
    data: unknown,
  ): void {
    const body = JSON.stringify(data)
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    })
    res.end(body)
  }

  function setCorsHeaders(res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Max-Age', '86400')
  }

  function setSecurityHeaders(res: http.ServerResponse): void {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('X-XSS-Protection', '0')
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
    res.setHeader('Cache-Control', 'no-store')
  }

  /** Extract bearer token from Authorization header. */
  function extractBearerToken(req: http.IncomingMessage): string | undefined {
    const auth = req.headers['authorization']
    if (auth === undefined || !auth.startsWith('Bearer ')) return undefined
    return auth.slice(7)
  }

  /** Authenticate a neuron request by registration ID + bearer token. */
  function authenticateNeuron(
    req: http.IncomingMessage,
    registrationId: string,
  ): { authenticated: boolean; npi?: string } {
    const bearerToken = extractBearerToken(req)
    if (bearerToken === undefined) return { authenticated: false }

    const record = tokenStore.get(registrationId)
    if (record === undefined) return { authenticated: false }

    if (!tokenStore.validateToken(registrationId, bearerToken)) {
      return { authenticated: false }
    }

    return { authenticated: true, npi: record.npi }
  }

  async function handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    setCorsHeaders(res)
    setSecurityHeaders(res)

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url ?? '/', `http://${req.headers['host'] ?? 'localhost'}`)
    const { pathname } = url

    // GET /health
    if (req.method === 'GET' && pathname === '/health') {
      sendJson(res, 200, {
        status: 'ok',
        version: AXON_VERSION,
        uptime: Math.floor((Date.now() - startTime) / 1000),
      })
      return
    }

    // POST /v1/neurons — register neuron
    if (req.method === 'POST' && pathname === '/v1/neurons') {
      const body = await readBody(req)
      let payload: {
        organization_npi: string
        organization_name: string
        organization_type: string
        neuron_endpoint_url: string
      }
      try {
        payload = JSON.parse(body) as typeof payload
      } catch {
        sendJson(res, 400, { error: 'Invalid JSON' })
        return
      }

      try {
        registry.registerNeuron({
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

        const { registration_id, bearer_token } = tokenStore.register(
          payload.organization_npi,
        )

        sendJson(res, 201, {
          registration_id,
          bearer_token,
          status: 'reachable',
        })
      } catch (err) {
        sendJson(res, 400, {
          error: err instanceof Error ? err.message : 'Registration failed',
        })
      }
      return
    }

    // PUT /v1/neurons/:id/endpoint — heartbeat / endpoint update
    const endpointMatch = pathname.match(/^\/v1\/neurons\/([^/]+)\/endpoint$/)
    if (req.method === 'PUT' && endpointMatch) {
      const registrationId = endpointMatch[1]!
      const { authenticated, npi } = authenticateNeuron(req, registrationId)
      if (!authenticated || npi === undefined) {
        sendJson(res, 401, { error: 'Unauthorized' })
        return
      }

      const body = await readBody(req)
      let payload: { neuron_endpoint_url?: string }
      try {
        payload = JSON.parse(body) as typeof payload
      } catch {
        sendJson(res, 400, { error: 'Invalid JSON' })
        return
      }

      const entry = registry.findByNPI(npi)
      if (entry && entry.entity_type === 'organization') {
        const newUrl = payload.neuron_endpoint_url ?? entry.neuron_endpoint?.url ?? ''
        registry.updateEndpoint(npi, {
          url: newUrl,
          protocol_version: '1.0.0',
          health_status: 'reachable',
          last_heartbeat: new Date().toISOString(),
        })
      }

      sendJson(res, 200, { status: 'reachable' })
      return
    }

    // POST /v1/neurons/:id/providers — register provider
    const providersPostMatch = pathname.match(/^\/v1\/neurons\/([^/]+)\/providers$/)
    if (req.method === 'POST' && providersPostMatch) {
      const registrationId = providersPostMatch[1]!
      const { authenticated, npi } = authenticateNeuron(req, registrationId)
      if (!authenticated || npi === undefined) {
        sendJson(res, 401, { error: 'Unauthorized' })
        return
      }

      const body = await readBody(req)
      let payload: {
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
        payload = JSON.parse(body) as typeof payload
      } catch {
        sendJson(res, 400, { error: 'Invalid JSON' })
        return
      }

      try {
        const orgEntry = registry.findByNPI(npi)
        const orgName = orgEntry?.organization_name ?? 'Unknown Organization'

        registry.registerProvider({
          npi: payload.provider_npi,
          name: payload.provider_name,
          provider_types: payload.provider_types,
          ...(payload.specialty !== undefined && { specialty: payload.specialty }),
          affiliations: [
            {
              organization_npi: npi,
              organization_name: orgName,
            },
          ],
          ...(payload.credentials !== undefined && { credentials: payload.credentials }),
        })

        sendJson(res, 201, {
          provider_id: payload.provider_npi,
          status: 'registered',
        })
      } catch (err) {
        sendJson(res, 400, {
          error: err instanceof Error ? err.message : 'Provider registration failed',
        })
      }
      return
    }

    // DELETE /v1/neurons/:id/providers/:npi — remove provider
    const providerDeleteMatch = pathname.match(
      /^\/v1\/neurons\/([^/]+)\/providers\/([^/]+)$/,
    )
    if (req.method === 'DELETE' && providerDeleteMatch) {
      const registrationId = providerDeleteMatch[1]!
      const { authenticated } = authenticateNeuron(req, registrationId)
      if (!authenticated) {
        sendJson(res, 401, { error: 'Unauthorized' })
        return
      }

      // Provider removal is a no-op in v1 — registry entries are immutable
      res.writeHead(204)
      res.end()
      return
    }

    // GET /v1/registry/search — search registry
    if (req.method === 'GET' && pathname === '/v1/registry/search') {
      const npi = url.searchParams.get('npi') ?? undefined
      const name = url.searchParams.get('name') ?? undefined
      const specialty = url.searchParams.get('specialty') ?? undefined
      const providerType = url.searchParams.get('provider_type') ?? undefined
      const organization = url.searchParams.get('organization') ?? undefined
      const credentialStatus = url.searchParams.get('credential_status') ?? undefined
      const limitParam = url.searchParams.get('limit')
      const offsetParam = url.searchParams.get('offset')

      const results = registry.search({
        ...(npi !== undefined && { npi }),
        ...(name !== undefined && { name }),
        ...(specialty !== undefined && { specialty }),
        ...(providerType !== undefined && { provider_type: providerType }),
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

    // GET /v1/registry/:npi — direct NPI lookup
    const registryNpiMatch = pathname.match(/^\/v1\/registry\/([^/]+)$/)
    if (req.method === 'GET' && registryNpiMatch) {
      const npi = registryNpiMatch[1]!

      // Avoid matching "search" as an NPI
      if (npi === 'search') {
        sendJson(res, 404, { error: 'Not found' })
        return
      }

      const entry = registry.findByNPI(npi)
      if (!entry) {
        sendJson(res, 404, { error: `No registry entry found for NPI: "${npi}"` })
        return
      }

      sendJson(res, 200, entry)
      return
    }

    // GET /v1/taxonomy/actions — taxonomy actions for provider type
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

    // GET /v1/taxonomy/provider-types — list all provider types
    if (req.method === 'GET' && pathname === '/v1/taxonomy/provider-types') {
      const providerTypes = AxonTaxonomy.getProviderTypes()
      sendJson(res, 200, { provider_types: providerTypes })
      return
    }

    // GET /v1/npi/lookup/:npi — look up provider identity via NPPES registry
    const npiLookupMatch = pathname.match(/^\/v1\/npi\/lookup\/([^/]+)$/)
    if (req.method === 'GET' && npiLookupMatch) {
      const npi = npiLookupMatch[1]!

      if (!/^\d{10}$/.test(npi)) {
        sendJson(res, 400, { error: 'NPI must be exactly 10 digits' })
        return
      }

      try {
        const nppesUrl = `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`
        const nppesRes = await fetch(nppesUrl, {
          signal: AbortSignal.timeout(10_000),
        })
        if (!nppesRes.ok) {
          sendJson(res, 502, { error: 'NPPES registry returned an error' })
          return
        }
        const nppesData = (await nppesRes.json()) as {
          result_count?: number
          results?: Array<{
            number?: string
            enumeration_type?: string
            basic?: Record<string, string>
            taxonomies?: Array<{
              code?: string
              desc?: string
              primary?: boolean
              state?: string
              license?: string
            }>
            addresses?: Array<{
              address_purpose?: string
              city?: string
              state?: string
            }>
          }>
        }

        if (!nppesData.result_count || nppesData.result_count === 0 || !nppesData.results?.[0]) {
          sendJson(res, 404, { error: `No NPPES record found for NPI: ${npi}` })
          return
        }

        const result = nppesData.results[0]
        const basic = result.basic ?? {}
        const enumerationType = result.enumeration_type === 'NPI-1' ? 'NPI-1' : 'NPI-2'
        const primaryTaxonomy = result.taxonomies?.find(t => t.primary) ?? result.taxonomies?.[0]
        const practiceAddress = result.addresses?.find(a => a.address_purpose === 'LOCATION')

        // Build response
        const response: Record<string, unknown> = {
          npi,
          enumeration_type: enumerationType,
          status: basic['status'] === 'A' ? 'active' : basic['status'] ?? 'unknown',
        }

        if (enumerationType === 'NPI-1') {
          // Individual provider
          const nameParts: string[] = []
          if (basic['name_prefix']) nameParts.push(basic['name_prefix'])
          if (basic['first_name']) nameParts.push(basic['first_name'])
          if (basic['middle_name']) nameParts.push(basic['middle_name'])
          if (basic['last_name']) nameParts.push(basic['last_name'])
          let displayName = nameParts.join(' ')
          if (basic['credential']) displayName += `, ${basic['credential']}`

          response['name'] = displayName
          response['first_name'] = basic['first_name'] ?? ''
          response['last_name'] = basic['last_name'] ?? ''
          response['credential'] = basic['credential'] ?? undefined
        } else {
          // Organization
          response['name'] = basic['organization_name'] ?? 'Unknown Organization'
          response['organization_name'] = basic['organization_name'] ?? undefined
        }

        if (primaryTaxonomy) {
          response['specialty'] = primaryTaxonomy.desc ?? undefined
          response['taxonomy_code'] = primaryTaxonomy.code ?? undefined
          response['license_state'] = primaryTaxonomy.state ?? undefined
          response['license_number'] = primaryTaxonomy.license ?? undefined
        }

        if (practiceAddress) {
          response['practice_state'] = practiceAddress.state ?? undefined
          response['practice_city'] = practiceAddress.city ?? undefined
        }

        sendJson(res, 200, response)
      } catch {
        sendJson(res, 502, { error: 'Failed to reach NPPES registry' })
      }
      return
    }

    // GET /v1/questionnaires/:typeId — questionnaire for provider type
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

    // POST /v1/connect — connection handshake
    if (req.method === 'POST' && pathname === '/v1/connect') {
      const body = await readBody(req)
      let parsed: unknown
      try {
        parsed = JSON.parse(body)
      } catch {
        sendJson(res, 400, { error: 'Invalid JSON' })
        return
      }

      const envelope = parsed as {
        signed_message?: unknown
        patient_public_key?: string
      }

      if (!envelope.signed_message || !envelope.patient_public_key) {
        sendJson(res, 400, { error: 'Missing signed_message or patient_public_key' })
        return
      }

      if (!SignedMessageValidator.Check(envelope.signed_message)) {
        sendJson(res, 400, { error: 'Invalid signed_message format' })
        return
      }

      const signedMessage = envelope.signed_message as SignedMessage
      const result = broker.connect(signedMessage, envelope.patient_public_key)

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

  const server: AxonServer = {
    get url() {
      return baseUrl
    },
    get registry() {
      return registry
    },

    async start(): Promise<string> {
      return new Promise<string>((resolve, reject) => {
        httpServer = http.createServer((req, res) => {
          handleRequest(req, res).catch((err) => {
            if (!res.headersSent) {
              sendJson(res, 500, {
                error: err instanceof Error ? err.message : 'Internal server error',
              })
            }
          })
        })

        httpServer.on('error', reject)
        httpServer.listen(port, host, () => {
          const addr = httpServer!.address()
          if (typeof addr === 'object' && addr !== null) {
            baseUrl = `http://${host === '0.0.0.0' ? 'localhost' : host}:${addr.port}`
          }
          resolve(baseUrl)
        })
      })
    },

    async stop(): Promise<void> {
      if (httpServer === undefined) return

      return new Promise<void>((resolve, reject) => {
        httpServer!.close((err) => {
          httpServer = undefined
          if (err) reject(err)
          else resolve()
        })
      })
    },
  }

  return server
}

export { PersistentTokenStore } from './tokens.js'
