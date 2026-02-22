# Axon Ed25519 Identity Specification

## Overview

All Axon protocol identities use Ed25519 key pairs. Keys are represented as base64url-encoded raw 32-byte values extracted from the JWK (JSON Web Key) format. This format is compatible with the Neuron ecosystem, enabling interoperable key exchange between Axon, Neurons, and CareAgents.

Ed25519 was chosen for its fixed-size keys (32 bytes), deterministic signatures (no random nonce in signing), 128-bit security level, and resistance to timing attacks. All cryptographic operations use `node:crypto` (FIPS-compliant).

## Key Format

An Ed25519 key pair consists of two 32-byte values:

- **Public key** -- The `x` component from JWK export. 43 base64url characters (32 raw bytes).
- **Private key** -- The `d` component from JWK export. 43 base64url characters (32 raw bytes).

### JWK Structure

Public key JWK (for verification):

```json
{
  "kty": "OKP",
  "crv": "Ed25519",
  "x": "<43 base64url characters>"
}
```

Private key JWK (for signing, includes public key):

```json
{
  "kty": "OKP",
  "crv": "Ed25519",
  "x": "<43 base64url characters>",
  "d": "<43 base64url characters>"
}
```

The `x` and `d` values are the raw 32-byte key material encoded as base64url strings without padding.

### TypeScript interface

```typescript
interface AxonKeyPair {
  /** base64url-encoded raw 32-byte Ed25519 public key (JWK 'x' component) */
  publicKey: string
  /** base64url-encoded raw 32-byte Ed25519 private key (JWK 'd' component) */
  privateKey: string
}
```

## Key Generation

Generate an Ed25519 key pair using `node:crypto`:

```typescript
import { generateKeyPairSync } from 'node:crypto'

function generateKeyPair(): AxonKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const pubJwk = publicKey.export({ format: 'jwk' }) as { x: string }
  const privJwk = privateKey.export({ format: 'jwk' }) as { x: string; d: string }
  return {
    publicKey: pubJwk.x,   // 43 base64url characters
    privateKey: privJwk.d, // 43 base64url characters
  }
}
```

The `generateKeyPairSync('ed25519')` call produces `KeyObject` instances. Exporting to JWK format gives access to the raw key bytes as base64url strings. Only the `x` (public) and `d` (private) components are extracted -- the `kty` and `crv` fields are implicit in the protocol.

## Signing

Sign a payload with the Ed25519 private key:

```typescript
import { sign, createPrivateKey } from 'node:crypto'

function signPayload(
  payload: string,
  privateKeyB64: string,
  publicKeyB64: string,
): string {
  const keyObject = createPrivateKey({
    key: { kty: 'OKP', crv: 'Ed25519', d: privateKeyB64, x: publicKeyB64 },
    format: 'jwk',
  })
  return sign(null, Buffer.from(payload), keyObject).toString('base64url')
}
```

**Important details:**

- The first argument to `sign()` must be `null`. Ed25519 uses its own internal hash (SHA-512); specifying an algorithm is an error. Do **not** use `createSign()` -- it does not support Ed25519.
- The `createPrivateKey` JWK import requires both `d` (private) and `x` (public) components. This is why `signPayload` accepts both keys.
- The signature is 64 raw bytes, producing 86 base64url characters.
- The exact bytes of the `payload` string are signed. The payload is the JSON-serialized `ConnectRequest` before base64url encoding.

## Verification

Verify an Ed25519 signature over a payload:

```typescript
import { verify, createPublicKey } from 'node:crypto'

function verifySignature(
  payload: string,
  signature: string,
  publicKeyB64: string,
): boolean {
  const keyObject = createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: publicKeyB64 },
    format: 'jwk',
  })
  return verify(
    null,
    Buffer.from(payload),
    keyObject,
    Buffer.from(signature, 'base64url'),
  )
}
```

**Important details:**

- The first argument to `verify()` must be `null`, matching the signing call. Do **not** use `createVerify()`.
- The `createPublicKey` JWK import needs only the `x` component (no private key required).
- Returns `true` if the signature is valid, `false` otherwise. Does not throw on invalid signatures.

## Wire Format

All keys and signatures on the wire use **base64url encoding** (RFC 4648 Section 5, no padding).

| Value      | Raw bytes | Base64url characters | Character set     |
| ---------- | --------- | -------------------- | ----------------- |
| Public key | 32        | 43                   | `[A-Za-z0-9_-]`  |
| Private key| 32        | 43                   | `[A-Za-z0-9_-]`  |
| Signature  | 64        | 86                   | `[A-Za-z0-9_-]`  |
| Nonce      | >= 16     | >= 22                | `[A-Za-z0-9_-]`  |

**Base64url vs standard base64:** Standard base64 uses `+`, `/`, and `=` padding. Base64url uses `-`, `_`, and no padding. The Axon protocol exclusively uses base64url. The protocol schemas enforce the pattern `^[A-Za-z0-9_-]+$` on all cryptographic fields.

## Neuron Compatibility

Axon's key format is directly compatible with the Neuron ecosystem. Neurons import public keys using the same JWK structure:

```typescript
// Neuron-side key import (identical format)
import { createPublicKey } from 'node:crypto'

const patientPublicKey = createPublicKey({
  key: { kty: 'OKP', crv: 'Ed25519', x: publicKeyB64 },
  format: 'jwk',
})
```

This means:

- Keys generated by Axon's `generateKeyPair()` work directly with Neuron's verification.
- Keys generated by a Neuron work directly with Axon's `verifySignature()`.
- The patient CareAgent's public key travels through both systems: first in the `ConnectRequest` to Axon (for signature verification), then in the `HANDSHAKE_INIT` to the Neuron (for challenge-response).

## Security Notes

- **Deterministic signatures:** Ed25519 signing is deterministic -- the same message and key always produce the same signature. There is no random nonce in the signing process (unlike ECDSA), eliminating a class of implementation bugs.
- **128-bit security:** Ed25519 provides approximately 128 bits of security, equivalent to RSA-3072 or P-256 ECDSA.
- **Timing resistance:** Ed25519 implementations in `node:crypto` use constant-time operations, preventing timing side-channel attacks.
- **FIPS compliance:** All cryptographic operations use the `node:crypto` module, which is backed by OpenSSL and FIPS-compliant.
- **No key stretching:** Ed25519 keys are used directly for signing. There is no key derivation function (KDF) or password-based key stretching. Keys must be stored securely by the CareAgent.

## See Also

- [message.md](./message.md) -- SignedMessage envelope where Ed25519 signatures are used
- [handshake.md](./handshake.md) -- Connection pipeline where identity is verified (Steps 2 and 4)
- [consent.md](./consent.md) -- Consent tokens signed with the same Ed25519 keys
- [Protocol Overview](../docs/protocol.md) -- Entry point to all protocol specifications
