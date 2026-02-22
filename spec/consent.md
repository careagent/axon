# Axon Consent Token Format Specification

> **This is a descriptive specification.** Axon does not implement, verify, store, or inspect consent tokens. This document exists so that CareAgent ecosystem developers understand the consent token format that flows between patient CareAgents and Neurons.

## Overview

Consent tokens represent a patient's authorization for a provider (via their Neuron) to access specific clinical data or perform specific actions. Consent tokens are created by the patient CareAgent, presented to the Neuron during the post-handshake phase, and verified by the Neuron using the patient's Ed25519 public key.

Consent is a direct relationship between the patient and the provider's Neuron. Axon -- as trust infrastructure -- facilitates the initial connection but never participates in consent exchange or verification.

## Axon's Role (None)

Axon does **not**:

- Verify consent tokens
- Store consent tokens
- Inspect consent token payloads
- Require consent tokens for connection brokering
- Proxy consent tokens between parties

The broker's `connect()` pipeline checks only:

1. Request signature (Ed25519)
2. Nonce replay protection
3. Provider credentials (registry `credential_status`)
4. Neuron endpoint availability (health status and heartbeat freshness)

Consent verification happens entirely at the Neuron level, during the post-handshake phase after Axon has granted the connection. The Neuron's `ConsentVerifier` validates the token signature and payload during the `CHALLENGE_RESPONSE` step of the Neuron handshake. The `ConsentHandshakeHandler` orchestrates this flow.

**Why this matters:** If Axon inspected consent tokens, it would need to understand clinical scopes, making it a HIPAA covered entity. By design, Axon handles only trust infrastructure (identity, credentials, endpoint discovery) and never touches clinical data or authorizations.

## Token Wire Format

Consent tokens use the same signed-payload envelope as other protocol messages:

```typescript
interface ConsentToken {
  payload: string    // base64url-encoded JSON
  signature: string  // base64url-encoded Ed25519 signature (64 bytes)
}
```

The `payload` is the base64url encoding of a JSON string containing the consent details. The `signature` is the patient's Ed25519 signature over the original JSON bytes (before base64url encoding), matching the signing semantics described in [identity.md](./identity.md).

### Construction (patient CareAgent side)

```typescript
import { signPayload } from '@careagent/axon'

const consentPayload = {
  patient_agent_id: 'patient-agent-123',
  provider_npi: '1234567893',
  scope: ['read:medications', 'read:allergies'],
  issued_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
}

const jsonPayload = JSON.stringify(consentPayload)
const signature = signPayload(jsonPayload, keys.privateKey, keys.publicKey)

const consentToken = {
  payload: Buffer.from(jsonPayload).toString('base64url'),
  signature,
}
```

### Verification (Neuron side)

```typescript
import { createPublicKey, verify } from 'node:crypto'

// Import the patient's public key (received during HANDSHAKE_INIT)
const publicKey = createPublicKey({
  key: { kty: 'OKP', crv: 'Ed25519', x: patientPublicKeyB64 },
  format: 'jwk',
})

// Decode and verify
const payloadBytes = Buffer.from(consentToken.payload, 'base64url')
const signatureBytes = Buffer.from(consentToken.signature, 'base64url')
const isValid = verify(null, payloadBytes, publicKey, signatureBytes)
```

## Token Payload

The consent token payload schema is owned by the Neuron implementation. This section documents the expected structure for ecosystem reference.

> **Note:** The exact schema may evolve with the Neuron implementation. Consult the Neuron specification for the authoritative definition.

Expected payload fields:

| Field              | Type       | Description                                         |
| ------------------ | ---------- | --------------------------------------------------- |
| `patient_agent_id` | `string`   | The patient CareAgent's identifier                  |
| `provider_npi`     | `string`   | The NPI of the provider being authorized            |
| `scope`            | `string[]` | List of authorized data types or actions             |
| `issued_at`        | `string`   | ISO 8601 timestamp when consent was granted          |
| `expires_at`       | `string`   | ISO 8601 timestamp when consent expires              |

The `scope` field specifies what the provider's Neuron is authorized to access or do. Scopes are defined by the CareAgent ecosystem and may include clinical data categories (e.g., `read:medications`) or action types (e.g., `schedule:appointment`).

## Token Lifecycle

```
Patient CareAgent              Neuron
      |                          |
      |  1. Create consent token |
      |     (sign with Ed25519)  |
      |                          |
      |  2. HANDSHAKE_INIT ----> |
      |     (agent_id, npi, key) |
      |                          |
      |  <---- CHALLENGE -----   |
      |     (32-byte nonce)      |
      |                          |
      |  3. CHALLENGE_RESPONSE ->|
      |     (signed nonce +      |
      |      consent token)      |
      |                          |
      |     4. Neuron verifies:  |
      |        - Nonce signature |
      |        - Consent token   |
      |          signature       |
      |        - Consent scope   |
      |        - Consent expiry  |
      |                          |
      |  <-- HANDSHAKE_COMPLETE  |
      |     (relationship_id)    |
      |                          |
```

1. **Creation** -- The patient CareAgent creates and signs the consent token before initiating the connection. The token is scoped to a specific provider NPI and set of authorized actions.

2. **Presentation** -- The consent token is sent to the Neuron as part of the `CHALLENGE_RESPONSE` message, along with the signed challenge nonce.

3. **Verification** -- The Neuron's `ConsentVerifier` validates the token:
   - Verifies the Ed25519 signature using the patient's public key (received in `HANDSHAKE_INIT`)
   - Checks that `provider_npi` matches the Neuron's own provider
   - Validates that the token has not expired (`expires_at` is in the future)
   - Records the authorized `scope` for the relationship

4. **Relationship** -- If verification passes, the Neuron creates a relationship via its `RelationshipStore` and returns a `relationship_id` in the `HANDSHAKE_COMPLETE` message.

## Design Rationale

Axon deliberately does not touch consent for three reasons:

1. **Separation of concerns** -- Axon is trust infrastructure: it verifies that providers are who they claim to be (credentials) and that their systems are reachable (endpoint health). Consent is a clinical authorization between a patient and a specific provider. Mixing these concerns would create unnecessary coupling.

2. **HIPAA boundary** -- Consent tokens contain clinical scope information (what data types the patient is authorizing access to). If Axon inspected or stored consent tokens, it would become a HIPAA covered entity or business associate, adding regulatory complexity. By never touching consent, Axon remains purely in the trust/discovery layer.

3. **Transmit and exit** -- Axon's core principle is that it facilitates connections but does not remain in the data path. After granting a connection, Axon has no further involvement. Consent verification is part of the ongoing patient-provider relationship, which is the Neuron's domain.

This separation means that consent policies can evolve independently of the Axon protocol. Neurons can implement granular consent models, revocation, and scope changes without requiring Axon protocol updates.

## See Also

- [handshake.md](./handshake.md) -- Connection handshake that precedes consent exchange (consent is post-handshake)
- [identity.md](./identity.md) -- Ed25519 key format used for consent token signatures
- [Protocol Overview](../docs/protocol.md) -- Entry point to all protocol specifications
