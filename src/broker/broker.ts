import { randomUUID } from 'node:crypto'
import type { AxonRegistry } from '../registry/registry.js'
import type { AuditTrail } from './audit.js'
import { NonceStore } from '../protocol/nonce.js'
import { verifySignature } from '../protocol/identity.js'
import { ConnectRequestValidator } from '../protocol/schemas.js'
import type {
  ConnectGrant,
  ConnectDenial,
  ConnectRequest,
  DenialCode,
  SignedMessage,
} from '../types/index.js'

/** Human-readable messages for each denial code. */
const DENIAL_MESSAGES: Record<DenialCode, string> = {
  SIGNATURE_INVALID: 'Request signature verification failed',
  NONCE_REPLAYED: 'Request nonce has already been used',
  TIMESTAMP_EXPIRED: 'Request timestamp is outside the acceptable window',
  PROVIDER_NOT_FOUND: 'Provider NPI not found in registry',
  CREDENTIALS_INVALID: 'Provider credentials are not in active status',
  ENDPOINT_UNAVAILABLE: 'Provider endpoint is not available',
}

/** Stale heartbeat threshold: 5 minutes in milliseconds. */
const HEARTBEAT_STALE_MS = 300_000

/**
 * Stateless connection broker that processes signed connect requests
 * through a pipeline of credential verification, endpoint resolution,
 * and audit logging.
 *
 * Each connect() call is a single synchronous attempt with no retries.
 * The broker never touches PHI -- it only verifies identity, checks
 * credentials, and resolves endpoints.
 *
 * @example
 * ```ts
 * const broker = new AxonBroker(registry, auditTrail)
 * const result = broker.connect(signedMessage, patientPublicKey)
 * if (result.type === 'connect_grant') {
 *   // proceed with Neuron handshake at result.neuron_endpoint
 * }
 * ```
 */
export class AxonBroker {
  private readonly registry: AxonRegistry
  private readonly audit: AuditTrail
  private readonly nonceStore: NonceStore

  constructor(
    registry: AxonRegistry,
    audit: AuditTrail,
    nonceStore?: NonceStore,
  ) {
    this.registry = registry
    this.audit = audit
    this.nonceStore = nonceStore ?? new NonceStore()
  }

  /**
   * Process a signed connect request through the stateless broker pipeline.
   *
   * Pipeline: decode payload -> verify signature -> validate schema ->
   * check nonce/timestamp -> lookup provider -> check credentials ->
   * resolve endpoint -> grant or deny.
   *
   * @param signedMessage - Base64url-encoded payload with Ed25519 signature
   * @param patientPublicKey - Base64url-encoded Ed25519 public key of the patient
   * @returns ConnectGrant on success, ConnectDenial on any validation failure
   */
  connect(
    signedMessage: SignedMessage,
    patientPublicKey: string,
  ): ConnectGrant | ConnectDenial {
    const connectionId = randomUUID()

    // Step 1: Decode the payload from base64url
    let payloadStr: string
    try {
      payloadStr = Buffer.from(
        signedMessage.payload,
        'base64url',
      ).toString('utf-8')
    } catch {
      return this.deny(connectionId, 'SIGNATURE_INVALID')
    }

    // Step 2: Verify signature over the decoded payload bytes
    let signatureValid: boolean
    try {
      signatureValid = verifySignature(
        payloadStr,
        signedMessage.signature,
        patientPublicKey,
      )
    } catch {
      signatureValid = false
    }

    if (!signatureValid) {
      return this.deny(connectionId, 'SIGNATURE_INVALID')
    }

    // Step 3: Parse JSON
    let parsed: unknown
    try {
      parsed = JSON.parse(payloadStr)
    } catch {
      return this.deny(connectionId, 'SIGNATURE_INVALID')
    }

    // Step 4: Validate against ConnectRequest schema
    if (!ConnectRequestValidator.Check(parsed)) {
      return this.deny(connectionId, 'SIGNATURE_INVALID')
    }

    const request = parsed as ConnectRequest

    // Step 5: Log connect attempt
    this.audit.log({
      type: 'connect_attempt',
      connectionId,
      details: {
        patient_agent_id: request.patient_agent_id,
        provider_npi: request.provider_npi,
      },
    })

    // Step 6: Validate nonce and timestamp
    const nonceResult = this.nonceStore.validate(
      request.nonce,
      request.timestamp,
    )
    if (!nonceResult.valid) {
      const code: DenialCode =
        nonceResult.reason === 'nonce_replayed'
          ? 'NONCE_REPLAYED'
          : 'TIMESTAMP_EXPIRED'
      return this.deny(connectionId, code, request.provider_npi)
    }

    // Step 7: Look up provider in registry
    const entry = this.registry.findByNPI(request.provider_npi)
    if (entry === undefined) {
      return this.deny(
        connectionId,
        'PROVIDER_NOT_FOUND',
        request.provider_npi,
      )
    }

    // Step 8: Check credential status
    if (entry.credential_status !== 'active') {
      return this.deny(
        connectionId,
        'CREDENTIALS_INVALID',
        request.provider_npi,
      )
    }

    // Step 9: Resolve endpoint
    let endpointUrl: string | undefined
    let protocolVersion: string | undefined

    if (entry.entity_type === 'organization') {
      // Organization: use its own neuron_endpoint directly
      if (entry.neuron_endpoint === undefined) {
        return this.deny(
          connectionId,
          'ENDPOINT_UNAVAILABLE',
          request.provider_npi,
        )
      }

      if (entry.neuron_endpoint.health_status === 'unreachable') {
        return this.deny(
          connectionId,
          'ENDPOINT_UNAVAILABLE',
          request.provider_npi,
        )
      }

      // Check heartbeat staleness
      if (this.isHeartbeatStale(entry.neuron_endpoint.last_heartbeat)) {
        return this.deny(
          connectionId,
          'ENDPOINT_UNAVAILABLE',
          request.provider_npi,
        )
      }

      endpointUrl = entry.neuron_endpoint.url
      protocolVersion = entry.neuron_endpoint.protocol_version
    } else {
      // Individual provider: look up organization via first affiliation
      if (
        entry.affiliations === undefined ||
        entry.affiliations.length === 0
      ) {
        return this.deny(
          connectionId,
          'ENDPOINT_UNAVAILABLE',
          request.provider_npi,
        )
      }

      const firstAffiliation = entry.affiliations[0]!
      const orgEntry = this.registry.findByNPI(
        firstAffiliation.organization_npi,
      )

      if (
        orgEntry === undefined ||
        orgEntry.neuron_endpoint === undefined
      ) {
        return this.deny(
          connectionId,
          'ENDPOINT_UNAVAILABLE',
          request.provider_npi,
        )
      }

      if (orgEntry.neuron_endpoint.health_status === 'unreachable') {
        return this.deny(
          connectionId,
          'ENDPOINT_UNAVAILABLE',
          request.provider_npi,
        )
      }

      // Check heartbeat staleness
      if (this.isHeartbeatStale(orgEntry.neuron_endpoint.last_heartbeat)) {
        return this.deny(
          connectionId,
          'ENDPOINT_UNAVAILABLE',
          request.provider_npi,
        )
      }

      endpointUrl = orgEntry.neuron_endpoint.url
      protocolVersion = orgEntry.neuron_endpoint.protocol_version
    }

    // Step 10: Grant connection
    this.audit.log({
      type: 'connect_granted',
      connectionId,
      details: {
        provider_npi: request.provider_npi,
        neuron_endpoint: endpointUrl,
      },
    })

    return {
      type: 'connect_grant',
      connection_id: connectionId,
      provider_npi: request.provider_npi,
      neuron_endpoint: endpointUrl,
      protocol_version: protocolVersion,
    }
  }

  /**
   * Log a denial and return a ConnectDenial response.
   */
  private deny(
    connectionId: string,
    code: DenialCode,
    providerNpi?: string,
  ): ConnectDenial {
    this.audit.log({
      type: 'connect_denied',
      connectionId,
      details: {
        code,
        ...(providerNpi !== undefined && { provider_npi: providerNpi }),
      },
    })

    return {
      type: 'connect_denial',
      connection_id: connectionId,
      code,
      message: DENIAL_MESSAGES[code],
    }
  }

  /**
   * Check if a heartbeat timestamp is stale (older than 5 minutes).
   */
  private isHeartbeatStale(lastHeartbeat: string | undefined): boolean {
    if (lastHeartbeat === undefined) {
      return false
    }
    const heartbeatTime = new Date(lastHeartbeat).getTime()
    return Date.now() - heartbeatTime > HEARTBEAT_STALE_MS
  }
}
