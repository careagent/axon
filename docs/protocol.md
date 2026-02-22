# Axon Protocol Overview

## Overview

The Axon protocol defines how CareAgents discover providers and establish direct peer-to-peer connections through the Axon broker. The protocol covers five areas: connection handshake, cryptographic identity, message format, consent token format, and credential standards.

Any two CareAgents implementing the Axon protocol can communicate. The protocol is designed to be stateless, patient-initiated, and signed -- every request carries an Ed25519 signature, replay protection via nonce and timestamp, and the broker verifies credentials before granting a connection.

## Protocol Documents

The protocol is specified across five documents in the `spec/` directory:

| Specification | Path | Describes |
|---------------|------|-----------|
| Handshake | [spec/handshake.md](../spec/handshake.md) | Connection pipeline (10 steps), denial codes (6 categories), grant/denial response formats, post-handshake flow, audit trail |
| Identity | [spec/identity.md](../spec/identity.md) | Ed25519 key generation, signing, verification, JWK wire format, Neuron compatibility |
| Message | [spec/message.md](../spec/message.md) | ConnectRequest schema, SignedMessage envelope, replay protection (nonce + timestamp window), validation rules |
| Consent | [spec/consent.md](../spec/consent.md) | Consent token format (descriptive only -- Axon never touches consent), token lifecycle, HIPAA boundary rationale |
| Credential | [spec/credential.md](../spec/credential.md) | CredentialRecord schema, status lifecycle (pending/active/expired/suspended/revoked), verification levels, NPI validation |

## Key Properties

The Axon protocol has these defining characteristics:

- **Stateless** -- Every `connect()` call is a self-contained atomic operation. No session state is maintained between calls.
- **Patient-initiated** -- Only patient CareAgents initiate connections. The broker never contacts providers.
- **Signed requests** -- Every request carries an Ed25519 signature over the payload. The broker verifies the signature before any processing.
- **Replay-protected** -- Each request includes a cryptographic nonce (16+ random bytes) and a timestamp. The broker rejects replayed nonces and timestamps outside the 5-minute window.
- **Credentials-only** -- The broker checks provider credentials (registry `credential_status`) and endpoint health. It never verifies consent tokens -- consent is between the patient and the Neuron.
- **Transmit and exit** -- After granting a connection, Axon is not in the data path. The patient connects directly to the Neuron endpoint.

## Implementation

The protocol is fully implemented in two source modules:

- **`src/protocol/`** -- Identity functions (`generateKeyPair`, `signPayload`, `verifySignature`, `generateNonce`), `NonceStore` for replay protection, TypeBox schemas and compiled validators (`ConnectRequestSchema`, `SignedMessageSchema`), and the protocol error hierarchy.
- **`src/broker/`** -- `AxonBroker.connect()` implements the full handshake pipeline, and `AuditTrail` provides hash-chained JSONL logging for tamper-evident audit records.

See [docs/architecture.md](./architecture.md) for the component layer view and dependency graph.

## Versioning

The current protocol version is `1.0.0`. The `version` field in `ConnectRequest` is typed as a literal `'1.0.0'` -- requests with any other version are rejected during schema validation.

Future protocol versions will extend the schema to accept multiple version literals simultaneously, allowing the broker to route to version-specific processing logic while maintaining backward compatibility within the major version.

Changes to the protocol follow the governance process described in [docs/governance.md](./governance.md).
