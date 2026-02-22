import { describe, it, expect } from 'vitest'
import {
  generateKeyPair,
  signPayload,
  verifySignature,
  generateNonce,
} from '../src/protocol/identity.js'
import {
  ConnectRequestValidator,
  SignedMessageValidator,
} from '../src/protocol/schemas.js'
import { NonceStore } from '../src/protocol/nonce.js'
import {
  AxonProtocolError,
  AxonSignatureError,
  AxonReplayError,
  AxonCredentialError,
  AxonEndpointError,
  AxonProviderNotFoundError,
} from '../src/protocol/errors.js'

// --- Identity Tests ---

describe('Identity: generateKeyPair', () => {
  it('returns an object with publicKey and privateKey strings', () => {
    const kp = generateKeyPair()
    expect(typeof kp.publicKey).toBe('string')
    expect(typeof kp.privateKey).toBe('string')
  })

  it('public key is 43 characters (32 bytes base64url)', () => {
    const kp = generateKeyPair()
    expect(kp.publicKey).toHaveLength(43)
  })

  it('private key is 43 characters (32 bytes base64url)', () => {
    const kp = generateKeyPair()
    expect(kp.privateKey).toHaveLength(43)
  })

  it('keys contain only base64url characters', () => {
    const kp = generateKeyPair()
    expect(kp.publicKey).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(kp.privateKey).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('Identity: signPayload and verifySignature', () => {
  it('round-trip: sign then verify with correct key -> true', () => {
    const kp = generateKeyPair()
    const payload = 'hello world'
    const sig = signPayload(payload, kp.privateKey, kp.publicKey)
    expect(verifySignature(payload, sig, kp.publicKey)).toBe(true)
  })

  it('verify with wrong public key -> false', () => {
    const kp1 = generateKeyPair()
    const kp2 = generateKeyPair()
    const payload = 'hello world'
    const sig = signPayload(payload, kp1.privateKey, kp1.publicKey)
    expect(verifySignature(payload, sig, kp2.publicKey)).toBe(false)
  })

  it('verify tampered message -> false', () => {
    const kp = generateKeyPair()
    const payload = 'hello world'
    const sig = signPayload(payload, kp.privateKey, kp.publicKey)
    expect(verifySignature('hello worlD', sig, kp.publicKey)).toBe(false)
  })

  it('verify tampered signature -> false', () => {
    const kp = generateKeyPair()
    const payload = 'hello world'
    const sig = signPayload(payload, kp.privateKey, kp.publicKey)
    // Change one character in the signature
    const tampered = sig.charAt(0) === 'A' ? 'B' + sig.slice(1) : 'A' + sig.slice(1)
    expect(verifySignature(payload, tampered, kp.publicKey)).toBe(false)
  })
})

describe('Identity: generateNonce', () => {
  it('returns a 22-character base64url string (16 bytes default)', () => {
    const nonce = generateNonce()
    expect(nonce).toHaveLength(22)
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('returns a 43-character base64url string for 32 bytes', () => {
    const nonce = generateNonce(32)
    expect(nonce).toHaveLength(43)
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

// --- Schema Validation Tests ---

describe('Schema: ConnectRequest', () => {
  const validRequest = {
    version: '1.0.0' as const,
    type: 'connect_request' as const,
    timestamp: new Date().toISOString(),
    nonce: generateNonce(),
    patient_agent_id: 'patient-agent-123',
    provider_npi: '1234567893',
    patient_public_key: generateKeyPair().publicKey,
  }

  it('valid ConnectRequest passes validation', () => {
    expect(ConnectRequestValidator.Check(validRequest)).toBe(true)
  })

  it('missing required field (nonce) fails validation', () => {
    const { nonce: _nonce, ...missing } = validRequest
    expect(ConnectRequestValidator.Check(missing)).toBe(false)
  })

  it('invalid version fails validation', () => {
    expect(ConnectRequestValidator.Check({ ...validRequest, version: '2.0.0' })).toBe(false)
  })

  it('non-base64url nonce (with + or = characters) fails validation', () => {
    expect(
      ConnectRequestValidator.Check({ ...validRequest, nonce: 'abc+def=ghi' }),
    ).toBe(false)
  })
})

describe('Schema: SignedMessage', () => {
  it('valid SignedMessage passes validation', () => {
    const kp = generateKeyPair()
    const payload = Buffer.from('test').toString('base64url')
    const signature = signPayload('test', kp.privateKey, kp.publicKey)
    expect(SignedMessageValidator.Check({ payload, signature })).toBe(true)
  })

  it('missing payload fails validation', () => {
    expect(
      SignedMessageValidator.Check({ signature: 'abc123' }),
    ).toBe(false)
  })

  it('missing signature fails validation', () => {
    expect(
      SignedMessageValidator.Check({ payload: 'abc123' }),
    ).toBe(false)
  })
})

// --- NonceStore Tests ---

describe('NonceStore', () => {
  it('fresh nonce with valid timestamp returns valid', () => {
    const store = new NonceStore()
    const result = store.validate(generateNonce(), new Date().toISOString())
    expect(result).toEqual({ valid: true })
  })

  it('same nonce second time returns nonce_replayed', () => {
    const store = new NonceStore()
    const nonce = generateNonce()
    const ts = new Date().toISOString()
    store.validate(nonce, ts)
    const result = store.validate(nonce, ts)
    expect(result).toEqual({ valid: false, reason: 'nonce_replayed' })
  })

  it('timestamp >5 minutes in the past returns timestamp_expired', () => {
    const store = new NonceStore()
    const pastTs = new Date(Date.now() - 6 * 60 * 1000).toISOString()
    const result = store.validate(generateNonce(), pastTs)
    expect(result).toEqual({ valid: false, reason: 'timestamp_expired' })
  })

  it('timestamp >5 minutes in the future returns timestamp_expired', () => {
    const store = new NonceStore()
    const futureTs = new Date(Date.now() + 6 * 60 * 1000).toISOString()
    const result = store.validate(generateNonce(), futureTs)
    expect(result).toEqual({ valid: false, reason: 'timestamp_expired' })
  })

  it('timestamp at exactly 5 minutes (just within window) returns valid', () => {
    const store = new NonceStore()
    // Just under 5 minutes -- within window
    const borderTs = new Date(Date.now() - 4 * 60 * 1000 - 59 * 1000).toISOString()
    const result = store.validate(generateNonce(), borderTs)
    expect(result).toEqual({ valid: true })
  })

  it('different nonces with valid timestamps all accepted', () => {
    const store = new NonceStore()
    const ts = new Date().toISOString()
    expect(store.validate(generateNonce(), ts).valid).toBe(true)
    expect(store.validate(generateNonce(), ts).valid).toBe(true)
    expect(store.validate(generateNonce(), ts).valid).toBe(true)
  })

  it('expired nonces are cleaned up on subsequent validate calls', () => {
    // Use a very short window (50ms) to test cleanup
    const store = new NonceStore(50)
    const nonce1 = generateNonce()
    store.validate(nonce1, new Date().toISOString())

    // Wait for expiry then validate a new nonce (triggers cleanup)
    const start = Date.now()
    while (Date.now() - start < 100) {
      // busy wait past the 50ms window
    }

    // A new validation triggers cleanup of old nonces
    const nonce2 = generateNonce()
    store.validate(nonce2, new Date().toISOString())

    // The old nonce should have been cleaned up, so re-using it
    // with a fresh timestamp should succeed (it's no longer in the store)
    const result = store.validate(nonce1, new Date().toISOString())
    expect(result.valid).toBe(true)
  })
})

// --- Error Type Tests ---

describe('Protocol Errors', () => {
  it('AxonSignatureError is instanceof AxonProtocolError', () => {
    const err = new AxonSignatureError('test')
    expect(err).toBeInstanceOf(AxonProtocolError)
  })

  it('AxonSignatureError has code SIGNATURE_INVALID', () => {
    const err = new AxonSignatureError('test')
    expect(err.code).toBe('SIGNATURE_INVALID')
  })

  it('AxonReplayError(NONCE_REPLAYED) has correct code', () => {
    const err = new AxonReplayError('NONCE_REPLAYED', 'test')
    expect(err.code).toBe('NONCE_REPLAYED')
  })

  it('AxonCredentialError has code CREDENTIALS_INVALID', () => {
    const err = new AxonCredentialError('test')
    expect(err.code).toBe('CREDENTIALS_INVALID')
  })

  it('AxonEndpointError has code ENDPOINT_UNAVAILABLE', () => {
    const err = new AxonEndpointError('test')
    expect(err.code).toBe('ENDPOINT_UNAVAILABLE')
  })

  it('AxonProviderNotFoundError has code PROVIDER_NOT_FOUND', () => {
    const err = new AxonProviderNotFoundError('test')
    expect(err.code).toBe('PROVIDER_NOT_FOUND')
  })

  it('all errors have name matching their class', () => {
    expect(new AxonSignatureError('test').name).toBe('AxonSignatureError')
    expect(new AxonReplayError('NONCE_REPLAYED', 'test').name).toBe('AxonReplayError')
    expect(new AxonCredentialError('test').name).toBe('AxonCredentialError')
    expect(new AxonEndpointError('test').name).toBe('AxonEndpointError')
    expect(new AxonProviderNotFoundError('test').name).toBe('AxonProviderNotFoundError')
  })
})
