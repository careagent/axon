/**
 * Protocol error hierarchy for Axon connection brokering.
 *
 * Each error carries a categorical `code` matching the DenialCode union type
 * from protocol schemas. Error messages are human-readable but must NOT
 * contain sensitive details (credential specifics, endpoint internals, etc.).
 * Detailed context belongs in the audit trail only.
 */

/** Base class for all Axon protocol errors. */
export class AxonProtocolError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'AxonProtocolError'
    this.code = code
  }
}

/** Signature verification failed. */
export class AxonSignatureError extends AxonProtocolError {
  constructor(message: string) {
    super('SIGNATURE_INVALID', message)
    this.name = 'AxonSignatureError'
  }
}

/** Nonce replay or timestamp expiration detected. */
export class AxonReplayError extends AxonProtocolError {
  constructor(code: 'NONCE_REPLAYED' | 'TIMESTAMP_EXPIRED', message: string) {
    super(code, message)
    this.name = 'AxonReplayError'
  }
}

/** Provider credentials are not in 'active' status. */
export class AxonCredentialError extends AxonProtocolError {
  constructor(message: string) {
    super('CREDENTIALS_INVALID', message)
    this.name = 'AxonCredentialError'
  }
}

/** Neuron endpoint is unavailable (unreachable, stale heartbeat, or not configured). */
export class AxonEndpointError extends AxonProtocolError {
  constructor(message: string) {
    super('ENDPOINT_UNAVAILABLE', message)
    this.name = 'AxonEndpointError'
  }
}

/** Provider NPI not found in registry. */
export class AxonProviderNotFoundError extends AxonProtocolError {
  constructor(message: string) {
    super('PROVIDER_NOT_FOUND', message)
    this.name = 'AxonProviderNotFoundError'
  }
}
