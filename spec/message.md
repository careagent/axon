# Axon Protocol Message Format Specification

## Overview

The Axon protocol uses versioned, signed messages with replay protection. Every message sent to the broker is wrapped in a `SignedMessage` envelope containing a base64url-encoded payload and its Ed25519 signature. The broker validates the envelope, verifies the signature, and then processes the inner message.

Currently, the only message type is `ConnectRequest` (version `1.0.0`). The protocol is designed for version evolution through the `version` field.

## ConnectRequest Schema

A `ConnectRequest` is the payload inside a `SignedMessage` sent by a patient CareAgent to initiate a connection through the Axon broker.

| Field               | Type     | Constraints                     | Description                                            |
| ------------------- | -------- | ------------------------------- | ------------------------------------------------------ |
| `version`           | `string` | Literal `'1.0.0'`              | Protocol version                                       |
| `type`              | `string` | Literal `'connect_request'`    | Message type discriminator                             |
| `timestamp`         | `string` | ISO 8601 format                | When the request was created (for replay protection)   |
| `nonce`             | `string` | Base64url, >= 16 random bytes  | Cryptographic nonce (for replay protection)            |
| `patient_agent_id`  | `string` | Non-empty                      | Identifier for the patient's CareAgent instance        |
| `provider_npi`      | `string` | 10-digit NPI                   | Target provider's National Provider Identifier         |
| `patient_public_key`| `string` | Base64url, 43 characters       | Patient's Ed25519 public key for signature verification|

### TypeScript type

```typescript
interface ConnectRequest {
  version: '1.0.0'
  type: 'connect_request'
  timestamp: string          // ISO 8601, e.g. "2026-02-22T13:30:00.000Z"
  nonce: string              // base64url, e.g. "dGhpcyBpcyBhIHRlc3Q"
  patient_agent_id: string   // e.g. "patient-agent-abc123"
  provider_npi: string       // e.g. "1234567893"
  patient_public_key: string // base64url, 43 chars
}
```

### TypeBox schema

The `ConnectRequest` is defined as a TypeBox schema with compiled validation:

```typescript
import { Type } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

const Base64UrlString = Type.String({ pattern: '^[A-Za-z0-9_-]+$' })

const ConnectRequestSchema = Type.Object({
  version: Type.Literal('1.0.0'),
  type: Type.Literal('connect_request'),
  timestamp: Type.String(),
  nonce: Base64UrlString,
  patient_agent_id: Type.String(),
  provider_npi: Type.String(),
  patient_public_key: Base64UrlString,
})

const ConnectRequestValidator = TypeCompiler.Compile(ConnectRequestSchema)
```

The `Base64UrlString` pattern (`^[A-Za-z0-9_-]+$`) enforces that nonce and public key fields contain only valid base64url characters. This catches malformed inputs before cryptographic operations.

## SignedMessage Envelope

All protocol messages are wrapped in a `SignedMessage` envelope for transport:

```typescript
interface SignedMessage {
  payload: string    // base64url-encoded JSON string
  signature: string  // base64url-encoded Ed25519 signature (64 bytes)
}
```

### Construction

The `SignedMessage` is constructed by the patient CareAgent:

```typescript
import { signPayload, generateKeyPair, generateNonce } from '@careagent/axon'

// 1. Generate or load keys
const keys = generateKeyPair()

// 2. Build the ConnectRequest
const request = {
  version: '1.0.0' as const,
  type: 'connect_request' as const,
  timestamp: new Date().toISOString(),
  nonce: generateNonce(),           // 16 random bytes, base64url encoded
  patient_agent_id: 'patient-agent-123',
  provider_npi: '1234567893',
  patient_public_key: keys.publicKey,
}

// 3. Serialize to JSON (these exact bytes are signed)
const jsonPayload = JSON.stringify(request)

// 4. Sign the JSON bytes
const signature = signPayload(jsonPayload, keys.privateKey, keys.publicKey)

// 5. Wrap in SignedMessage envelope
const signedMessage = {
  payload: Buffer.from(jsonPayload).toString('base64url'),
  signature: signature,  // already base64url from signPayload
}
```

### Signing semantics

The signature is computed over the **original JSON bytes** (step 3), not the base64url-encoded payload (step 5). The broker reverses this process:

1. Decode `payload` from base64url to get the original JSON string.
2. Verify the `signature` against those decoded bytes using the patient's public key.
3. Parse the JSON string into a `ConnectRequest` object.
4. Validate against the `ConnectRequestSchema`.

This means the signature covers the exact request content. Any modification to the payload (field changes, reordering, whitespace) would invalidate the signature.

### TypeBox schema

```typescript
const SignedMessageSchema = Type.Object({
  payload: Base64UrlString,
  signature: Base64UrlString,
})

const SignedMessageValidator = TypeCompiler.Compile(SignedMessageSchema)
```

## Replay Protection

The protocol uses two mechanisms to prevent replay attacks:

### Nonce uniqueness

The `nonce` field must contain at least 16 cryptographically random bytes encoded as base64url (producing at least 22 characters). The broker maintains an in-memory `NonceStore` that tracks all nonces seen within the time window. If a nonce has been seen before, the request is rejected with `NONCE_REPLAYED`.

```typescript
import { randomBytes } from 'node:crypto'

// Generate a 16-byte nonce (22 base64url characters)
const nonce = randomBytes(16).toString('base64url')
```

With 16 bytes of randomness, the probability of nonce collision is negligible (birthday bound at ~2^64 attempts).

### Timestamp window

The `timestamp` field must be within 5 minutes of the broker's clock (past or future). Requests with timestamps outside this window are rejected with `TIMESTAMP_EXPIRED`. This bounds the window during which a captured request could theoretically be replayed.

```typescript
// NonceStore validates both nonce and timestamp
const result = nonceStore.validate(request.nonce, request.timestamp)

if (!result.valid) {
  // result.reason is 'timestamp_expired' or 'nonce_replayed'
}
```

### Cleanup

The `NonceStore` cleans up expired nonces on each `validate()` call. Nonces older than the 5-minute window are removed from the store. This keeps memory usage bounded proportional to request rate rather than growing unbounded.

## Validation Rules

The broker applies validation in this order:

1. **SignedMessage envelope** -- The outer message must match `SignedMessageSchema` (both `payload` and `signature` are base64url strings).

2. **Base64url decode** -- The `payload` is decoded from base64url to a UTF-8 string. Decode failure results in `SIGNATURE_INVALID`.

3. **Signature verification** -- The Ed25519 signature is verified over the decoded payload bytes using the patient's public key. Failure results in `SIGNATURE_INVALID`.

4. **JSON parse** -- The decoded payload is parsed as JSON. Parse failure results in `SIGNATURE_INVALID`.

5. **Schema validation** -- The parsed object is validated against `ConnectRequestSchema` using the compiled TypeBox validator. This checks:
   - `version` is exactly `'1.0.0'`
   - `type` is exactly `'connect_request'`
   - `timestamp` is a string
   - `nonce` matches the base64url pattern
   - `patient_public_key` matches the base64url pattern
   - All required fields are present

   Schema validation failure results in `SIGNATURE_INVALID` (to avoid leaking structural information about what failed).

6. **Nonce/timestamp** -- Checked after schema validation. Produces `NONCE_REPLAYED` or `TIMESTAMP_EXPIRED`.

## Versioning

The current protocol version is `1.0.0`. The `version` field in `ConnectRequest` is typed as `Type.Literal('1.0.0')` -- it must be exactly this string.

Future protocol versions will extend the schema:

```typescript
// Future: version becomes a union
const VersionSchema = Type.Union([
  Type.Literal('1.0.0'),
  Type.Literal('1.1.0'),
])
```

This allows the broker to accept multiple protocol versions simultaneously and route to version-specific processing logic. The `version` field is checked during schema validation, so unknown versions are rejected before any processing occurs.

Version `1.0.0` covers the initial handshake protocol. New versions may add fields to `ConnectRequest`, introduce new message types, or modify validation rules while maintaining backward compatibility within the major version.

## See Also

- [identity.md](./identity.md) -- Ed25519 signing standard used for SignedMessage signatures
- [handshake.md](./handshake.md) -- Connection pipeline where messages are processed and validated
- [credential.md](./credential.md) -- Credential checks that occur after message validation
- [Protocol Overview](../docs/protocol.md) -- Entry point to all protocol specifications
