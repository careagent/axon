# Phase 4: Protocol Specification and Connection Broker - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Ed25519 identity exchange, signed message protocol, and stateless handshake brokering with audit trail. Two CareAgents complete the full discover-verify-connect handshake through Axon with cryptographic identity verification, replay protection, and an immutable audit trail. Five protocol spec documents in `spec/`.

Axon is both a library (exported types, taxonomy, questionnaires) AND a service (registry and broker that CareAgents reach over the network for discovery and connection brokering). The broker and registry are server-side components — Neurons register with Axon, heartbeat to Axon, and patient CareAgents discover providers through Axon.

</domain>

<decisions>
## Implementation Decisions

### Handshake flow design
- Patient CareAgent initiates all connections (provider side does not initiate)
- Axon broker checks credentials and endpoint status only — consent is handled entirely between patient CareAgent and Neuron (not Axon's responsibility)
- Consent token verification, challenge-response identity proof, and relationship creation all happen at the Neuron level after Axon grants the connection
- This aligns with Neuron Phase 3's existing implementation: ConsentHandshakeHandler runs on the Neuron side with no Axon involvement in consent

### Audit trail structure
- Hash-chained JSONL format (SHA-256 chain), matching Neuron's audit trail format for ecosystem consistency
- Tamper-evident: each entry's hash includes the previous entry's hash
- Append-only, no clinical content in any audit entry (Axon never touches PHI)

### Spec document style
- Primary audience: internal CareAgent developers (provider-core, patient-core, neuron teams)
- TypeScript code examples included inline for practical reference
- Assumes reader knows the CareAgent ecosystem; focuses on contracts and wire formats

### Denial & error behavior
- Decisions left to Claude's discretion (see below)

### Claude's Discretion
- **Sync vs async handshake**: Pick based on the "stateless broker" design principle (roadmap explicitly says stateless)
- **Handshake grant result**: What the successful connect() returns to the patient CareAgent (endpoint, token, or both)
- **Audit event granularity**: Connection-level vs step-level events — pick based on what's useful for debugging without being excessive
- **Audit persistence model**: File-backed JSONL vs SQLite — Axon runs as a service, so pick what's appropriate for a server-side component (Neuron uses SQLite-backed audit for reference)
- **Audit queryability**: Runtime queryable vs offline analysis — pick what's practical for v1
- **Spec format tone**: RFC-style vs narrative — pick for internal developer audience
- **Spec timing**: Spec-first vs code-first — pick what avoids spec-code drift while being practical
- **Denial reason specificity**: Specific codes to caller vs generic deny with audit-only detail — balance security (information leakage) vs developer experience
- **Retry semantics**: Single atomic attempt vs broker-side retry for transient failures — align with stateless broker principle
- **Heartbeat as connection gate**: Whether stale endpoint heartbeat should deny connections — pick based on patient experience and safety
- **Error type taxonomy**: Shared ecosystem errors vs Axon-specific errors — consider Neuron already depends on Axon types

</decisions>

<specifics>
## Specific Ideas

- Neuron Phase 3 already built the full consent verification and handshake subsystem (ConsentVerifier, ConsentHandshakeHandler, RelationshipStore, TerminationHandler). Axon's protocol must align with these existing implementations.
- Neuron's consent token format: custom JSON payload + Ed25519 signature (not JWT). Payload is base64url-encoded JSON, signature is base64url-encoded 64 bytes. Wire format uses `{ payload: base64url, signature: base64url }`.
- Neuron's handshake sequence: HANDSHAKE_INIT (patient sends agent_id, provider_npi, public_key) -> CHALLENGE (Neuron sends 32-byte nonce) -> CHALLENGE_RESPONSE (patient signs nonce + sends consent token) -> HANDSHAKE_COMPLETE (relationship_id returned).
- Neuron's public key format: base64url-encoded raw 32-byte Ed25519 public key, imported via JWK `{ kty: 'OKP', crv: 'Ed25519', x: base64urlKey }`.
- Neuron Phase 2 builds an AxonClient HTTP wrapper and mock Axon server — Axon's broker API must be network-accessible (HTTP or similar).
- Neuron Phase 2 heartbeat: 60-second interval, exponential backoff when Axon is unreachable.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-protocol-specification-and-connection-broker*
*Context gathered: 2026-02-22*
