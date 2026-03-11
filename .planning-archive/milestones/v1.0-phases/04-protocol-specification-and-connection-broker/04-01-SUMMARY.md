---
phase: 04-protocol-specification-and-connection-broker
plan: 01
subsystem: protocol
tags: [ed25519, cryptography, typebox, nonce, replay-protection, node-crypto]

# Dependency graph
requires:
  - phase: 03-registry-and-credentials
    provides: "TypeBox schema patterns (registry/schemas.ts), credential types, registry entry structure"
provides:
  - "Ed25519 key generation, signing, and verification primitives (identity.ts)"
  - "TypeBox protocol message schemas: ConnectRequest, ConnectGrant, ConnectDenial, SignedMessage"
  - "NonceStore for replay protection with configurable time window"
  - "Protocol error hierarchy: AxonProtocolError with 6 categorical denial codes"
  - "Protocol types exported from src/types/index.ts for consumer access"
affects: [04-02-PLAN, 04-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Ed25519 JWK key format with base64url encoding", "sign(null, ...) API for EdDSA", "NonceStore with time-bounded cleanup", "Protocol error hierarchy with categorical codes"]

key-files:
  created:
    - src/protocol/identity.ts
    - src/protocol/schemas.ts
    - src/protocol/nonce.ts
    - src/protocol/errors.ts
    - src/protocol/index.ts
  modified:
    - src/types/index.ts

key-decisions:
  - "signPayload accepts both privateKey and publicKey params because Ed25519 JWK import requires both d and x components"
  - "DenialCode is a TypeBox Union of 6 string literals matching the protocol error hierarchy codes"
  - "NonceStore cleanup runs on every validate() call; sufficient for v1 scale"
  - "Protocol barrel export does NOT wire into src/index.ts yet; deferred to Plan 02 when broker is ready"

patterns-established:
  - "Ed25519 identity: generate via generateKeyPairSync, export JWK x/d components as base64url raw 32-byte keys"
  - "Protocol signing: sign(null, Buffer.from(payload), keyObject) -- null algorithm required for Ed25519"
  - "Base64url enforcement: Type.String({ pattern: '^[A-Za-z0-9_-]+$' }) on all cryptographic fields"
  - "Protocol errors: extend AxonProtocolError with hardcoded categorical code per subclass"

requirements-completed: [PROT-02, PROT-03]

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 4 Plan 1: Protocol Primitives Summary

**Ed25519 identity primitives, TypeBox protocol message schemas, nonce-based replay protection, and categorical protocol error types using zero external dependencies (node:crypto only)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T13:27:39Z
- **Completed:** 2026-02-22T13:30:28Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Ed25519 key generation producing 43-character base64url keys compatible with Neuron JWK format
- Sign/verify round-trip working correctly with node:crypto Ed25519 (null algorithm, JWK import with both x and d components)
- ConnectRequest, ConnectGrant, ConnectDenial, SignedMessage schemas with compiled TypeBox validators
- NonceStore enforcing 5-minute timestamp window and preventing nonce replay with automatic cleanup
- Protocol error hierarchy with 6 categorical codes: SIGNATURE_INVALID, NONCE_REPLAYED, TIMESTAMP_EXPIRED, CREDENTIALS_INVALID, ENDPOINT_UNAVAILABLE, PROVIDER_NOT_FOUND
- All 135 existing tests continue to pass; zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Ed25519 identity module and protocol TypeBox schemas** - `e043968` (feat)
2. **Task 2: NonceStore replay protection, error types, and module wiring** - `f3a0313` (feat)

## Files Created/Modified
- `src/protocol/identity.ts` - Ed25519 key generation, signing, verification, nonce generation
- `src/protocol/schemas.ts` - TypeBox schemas for ConnectRequest, ConnectGrant, ConnectDenial, SignedMessage with compiled validators
- `src/protocol/nonce.ts` - NonceStore class with time-bounded replay protection
- `src/protocol/errors.ts` - AxonProtocolError hierarchy with 6 categorical error subclasses
- `src/protocol/index.ts` - Protocol module barrel export
- `src/types/index.ts` - Added protocol type exports (ConnectRequest, ConnectGrant, ConnectDenial, SignedMessage, DenialCode)

## Decisions Made
- signPayload requires both privateKey and publicKey parameters because Ed25519 JWK private key import needs both `d` and `x` fields (Pitfall 7 from research)
- DenialCode implemented as TypeBox Union of 6 string literals (not an enum) following existing project pattern from CredentialStatusSchema
- NonceStore runs cleanup synchronously on each validate() call; no periodic timer needed for v1 scale
- Protocol barrel export (src/protocol/index.ts) is NOT yet wired into src/index.ts; deferred to Plan 02 when AxonBroker is ready for export

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. All cryptographic operations use node:crypto built-in module.

## Next Phase Readiness
- All protocol primitives ready for AxonBroker.connect() pipeline in Plan 02
- Identity functions (signPayload, verifySignature) ready for message signature validation
- NonceStore ready for replay protection in broker pipeline
- Protocol error types ready for structured denial responses
- ConnectRequest/ConnectGrant/ConnectDenial schemas define the wire format for broker I/O

## Self-Check: PASSED

All 6 files verified present on disk. Both task commits (e043968, f3a0313) verified in git log.

---
*Phase: 04-protocol-specification-and-connection-broker*
*Completed: 2026-02-22*
