# Axon Connection Handshake Specification

## Overview

Axon's connection handshake is a single synchronous `connect()` call on the `AxonBroker`. The patient CareAgent initiates every connection -- providers never initiate. The broker checks the request signature, validates credentials, resolves the provider's Neuron endpoint, and returns either a **grant** or a **denial**.

After a grant, the patient CareAgent connects directly to the Neuron at the returned endpoint for the full multi-step handshake (challenge-response, consent verification, relationship creation). Axon is not involved after the grant -- it transmits and exits.

**Key properties:**

- **Stateless:** No session state between calls. Every `connect()` is a self-contained atomic operation.
- **Patient-initiated:** The patient CareAgent always initiates. The broker never contacts providers.
- **Credentials-only:** The broker checks provider credentials and endpoint health. It never verifies consent tokens.
- **Signed requests:** Every request carries an Ed25519 signature over the payload. The broker verifies the signature before processing.

## Handshake Flow

The connection handshake follows a linear pipeline. Each step must succeed for the next step to execute. Any failure produces an immediate denial.

```
Patient CareAgent                    Axon Broker                     Neuron
      |                                  |                             |
      |  1. Construct ConnectRequest     |                             |
      |  2. Sign payload (Ed25519)       |                             |
      |  3. Send SignedMessage --------> |                             |
      |                                  |  4. Verify signature        |
      |                                  |  5. Check nonce/timestamp   |
      |                                  |  6. Look up provider (NPI)  |
      |                                  |  7. Check credentials       |
      |                                  |  8. Resolve Neuron endpoint |
      |                                  |  9. Grant or deny           |
      |  <-------- ConnectGrant -------- |                             |
      |                                  |                             |
      |  10. Connect to Neuron endpoint  |                             |
      |  ------------------------------------------------> |          |
      |            (Axon is no longer involved)              |          |
```

### Step-by-step pipeline

1. **Construct ConnectRequest** -- The patient CareAgent builds a `ConnectRequest` message with their agent ID, the target provider's NPI, a cryptographic nonce, a timestamp, and their Ed25519 public key. See [message.md](./message.md) for the full schema.

2. **Sign payload** -- The patient signs the JSON-serialized `ConnectRequest` bytes using their Ed25519 private key. See [identity.md](./identity.md) for signing details.

3. **Send SignedMessage** -- The patient wraps the base64url-encoded request and its base64url-encoded signature into a `SignedMessage` envelope and sends it to the Axon broker.

4. **Verify signature** -- The broker decodes the base64url payload, then verifies the Ed25519 signature using the patient's public key. If verification fails, the broker returns `SIGNATURE_INVALID`.

5. **Check nonce/timestamp** -- The broker validates that the nonce has not been seen before and that the timestamp is within the 5-minute window. Replayed nonces produce `NONCE_REPLAYED`; expired timestamps produce `TIMESTAMP_EXPIRED`.

6. **Look up provider** -- The broker searches the registry for the target NPI. If not found, the broker returns `PROVIDER_NOT_FOUND`.

7. **Check credentials** -- The broker checks the provider's registry entry `credential_status` field. Only `'active'` status passes. All other statuses (`pending`, `expired`, `suspended`, `revoked`) produce `CREDENTIALS_INVALID`.

8. **Resolve Neuron endpoint** -- For organization providers, the broker uses the organization's `neuron_endpoint` directly. For individual providers, the broker resolves through the first organizational affiliation's `organization_npi`. The endpoint must exist, be `reachable`, and have a heartbeat within the last 5 minutes. Any failure produces `ENDPOINT_UNAVAILABLE`.

9. **Grant or deny** -- If all checks pass, the broker returns a `ConnectGrant` with the Neuron endpoint URL and a `connection_id` for audit correlation. If any check fails, the broker returns a `ConnectDenial` with a categorical denial code.

## Request Format

The patient CareAgent constructs a `ConnectRequest` and wraps it in a `SignedMessage`. See [message.md](./message.md) for the full `ConnectRequest` schema and `SignedMessage` envelope format.

```typescript
import { generateKeyPair, signPayload, generateNonce } from '@careagent/axon'

const keys = generateKeyPair()

const request = {
  version: '1.0.0',
  type: 'connect_request' as const,
  timestamp: new Date().toISOString(),
  nonce: generateNonce(),
  patient_agent_id: 'patient-agent-123',
  provider_npi: '1234567893',
  patient_public_key: keys.publicKey,
}

const payload = JSON.stringify(request)
const signature = signPayload(payload, keys.privateKey, keys.publicKey)

const signedMessage = {
  payload: Buffer.from(payload).toString('base64url'),
  signature,
}
```

## Grant Response

A `ConnectGrant` is returned when all pipeline checks pass.

| Field              | Type     | Description                                                       |
| ------------------ | -------- | ----------------------------------------------------------------- |
| `type`             | `string` | Always `'connect_grant'`                                          |
| `connection_id`    | `string` | UUID for audit trail correlation (shared between Axon and Neuron) |
| `provider_npi`     | `string` | The NPI of the provider being connected to                        |
| `neuron_endpoint`  | `string` | URL where the patient CareAgent should connect next               |
| `protocol_version` | `string` | The Neuron endpoint's protocol version                            |

```typescript
interface ConnectGrant {
  type: 'connect_grant'
  connection_id: string    // e.g. "550e8400-e29b-41d4-a716-446655440000"
  provider_npi: string     // e.g. "1234567893"
  neuron_endpoint: string  // e.g. "https://neuron.example.com/ws"
  protocol_version: string // e.g. "1.0.0"
}
```

The `connection_id` is generated by the broker as a UUID. Both Axon's audit trail and the Neuron can use it to correlate events across the connection lifecycle. The `neuron_endpoint` is the URL where the patient CareAgent connects next to begin the Neuron-level handshake.

## Denial Response

A `ConnectDenial` is returned when any pipeline check fails.

| Field           | Type     | Description                                           |
| --------------- | -------- | ----------------------------------------------------- |
| `type`          | `string` | Always `'connect_denial'`                             |
| `connection_id` | `string` | UUID for audit trail correlation                      |
| `code`          | `string` | One of the 6 categorical denial codes (see below)     |
| `message`       | `string` | Human-readable categorical message (no sensitive data) |

```typescript
interface ConnectDenial {
  type: 'connect_denial'
  connection_id: string
  code: DenialCode
  message: string
}
```

### Denial Codes

| Code                   | Pipeline Step       | Meaning                                                    |
| ---------------------- | ------------------- | ---------------------------------------------------------- |
| `SIGNATURE_INVALID`    | Signature (Step 4)  | Ed25519 signature verification failed, payload decode failed, or schema validation failed |
| `NONCE_REPLAYED`       | Nonce (Step 5)      | The request nonce has already been used within the time window |
| `TIMESTAMP_EXPIRED`    | Nonce (Step 5)      | The request timestamp is outside the 5-minute acceptance window |
| `PROVIDER_NOT_FOUND`   | Lookup (Step 6)     | The target NPI does not exist in the Axon registry         |
| `CREDENTIALS_INVALID`  | Credentials (Step 7)| Provider's `credential_status` is not `'active'`           |
| `ENDPOINT_UNAVAILABLE` | Endpoint (Step 8)   | Neuron endpoint is missing, unreachable, or has a stale heartbeat |

**Security note:** Denial messages are categorical and human-readable but intentionally vague. Specific details (which credential expired, when the last heartbeat was received, which affiliation was checked) are logged to the audit trail only and are never returned to the caller. This prevents information leakage about provider status.

## Post-Handshake

After receiving a `ConnectGrant`, the patient CareAgent connects directly to the Neuron at the `neuron_endpoint` URL. Axon has no involvement in this phase -- the broker's job is complete.

The Neuron-level handshake follows this sequence:

1. **HANDSHAKE_INIT** -- Patient sends `agent_id`, `provider_npi`, and `public_key` to the Neuron.
2. **CHALLENGE** -- Neuron responds with a 32-byte cryptographic nonce challenge.
3. **CHALLENGE_RESPONSE** -- Patient signs the nonce and sends the signature along with their consent token.
4. **HANDSHAKE_COMPLETE** -- Neuron verifies the signature and consent token, creates a relationship, and returns a `relationship_id`.

This sequence is implemented by the Neuron's `ConsentHandshakeHandler` and `ConsentVerifier` components. The patient CareAgent can pass the `connection_id` from the Axon grant to the Neuron for end-to-end audit correlation.

## Audit Trail

Every `connect()` call generates audit events regardless of outcome:

- **`connect_attempt`** -- Logged after successful schema validation, recording `patient_agent_id` and `provider_npi`.
- **`connect_granted`** -- Logged on successful grant, recording `provider_npi` and `neuron_endpoint`.
- **`connect_denied`** -- Logged on denial, recording the `code` and optionally the `provider_npi`.

Audit entries are appended to a hash-chained JSONL file. Each entry includes the SHA-256 hash of the previous entry (`prev_hash`), creating a tamper-evident chain. The genesis entry uses 64 zeros as its `prev_hash`. See the `AuditTrail` class in `src/broker/audit.ts` for implementation details.

**No clinical content** appears in audit entries. Axon never touches PHI -- audit entries contain only connection metadata (agent IDs, NPIs, denial codes, endpoints).

## Design Principles

1. **Stateless** -- The broker holds no session state between `connect()` calls. The only state is the nonce store (for replay protection, cleaned up on a rolling window) and the registry (provider data). Each call is fully self-contained.

2. **Atomic** -- Every `connect()` is a single attempt with no retries. If the endpoint is unreachable, the broker denies immediately rather than retrying. The patient CareAgent can retry by sending a new request with a fresh nonce and timestamp.

3. **Patient-initiated** -- Only patient CareAgents initiate connections. The broker never reaches out to providers. This aligns with the patient-centered trust model: patients choose their providers.

4. **Credentials-only** -- The broker verifies provider identity (NPI in registry), credential status (active), and endpoint availability (reachable, fresh heartbeat). It does not verify consent tokens -- consent is between the patient and the Neuron.

5. **Transmit and exit** -- After granting a connection, Axon is not in the data path. The patient connects directly to the Neuron. Axon never proxies, relays, or inspects clinical traffic.

## See Also

- [identity.md](./identity.md) -- Ed25519 key generation, signing, and verification used in Steps 2 and 4
- [message.md](./message.md) -- ConnectRequest schema and SignedMessage envelope format
- [credential.md](./credential.md) -- CredentialRecord schema and status lifecycle checked in Step 7
- [consent.md](./consent.md) -- Consent token format (verified by Neuron post-handshake, not by Axon)
- [Protocol Overview](../docs/protocol.md) -- Entry point to all protocol specifications
