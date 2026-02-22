---
phase: 04-protocol-specification-and-connection-broker
plan: 03
subsystem: protocol
tags: [specification, documentation, ed25519, handshake, consent, credential, wire-format]

# Dependency graph
requires:
  - phase: 04-protocol-specification-and-connection-broker
    provides: "Ed25519 identity primitives, protocol schemas, NonceStore, protocol error types, AxonBroker pipeline, AuditTrail"
  - phase: 03-registry-and-credentials
    provides: "CredentialRecord schema, NPI validation, registry entry structure"
provides:
  - "spec/handshake.md: Full connect() pipeline specification with all 6 denial codes, grant/denial formats, post-handshake Neuron flow"
  - "spec/identity.md: Ed25519 key format, JWK compatibility, signing/verification, base64url wire format"
  - "spec/message.md: ConnectRequest schema, SignedMessage envelope, replay protection, versioning"
  - "spec/consent.md: Descriptive-only consent token format (Axon never touches consent)"
  - "spec/credential.md: CredentialRecord schema, status lifecycle, verification levels, broker check behavior"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["Code-first specification: specs describe implemented behavior to prevent spec-code drift"]

key-files:
  created:
    - spec/handshake.md
    - spec/identity.md
    - spec/message.md
    - spec/consent.md
    - spec/credential.md
  modified: []

key-decisions:
  - "Specs written code-first: every section references and describes actual implemented behavior from Plans 01 and 02"
  - "Consent spec is explicitly descriptive-only with dedicated 'Axon Role (None)' section and design rationale for HIPAA boundary"
  - "Denial codes documented with pipeline step mapping so developers know which check produces each code"

patterns-established:
  - "Protocol specs use narrative style with structured headings, TypeScript code examples, and field-level tables"
  - "Cross-references between spec documents (handshake.md links to identity.md and message.md)"

requirements-completed: [PROT-01, PROT-04, PROT-05]

# Metrics
duration: 4min
completed: 2026-02-22
---

# Phase 4 Plan 3: Protocol Specification Documents Summary

**Five code-first protocol spec documents covering handshake pipeline, Ed25519 identity, message format, consent tokens (descriptive), and credential schema with TypeScript examples throughout**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T13:43:20Z
- **Completed:** 2026-02-22T13:47:55Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Handshake spec documenting the full connect() pipeline with ASCII flow diagram, all 6 denial codes mapped to pipeline steps, grant/denial response formats, and post-handshake Neuron flow
- Identity spec documenting Ed25519 key format with JWK structure, signing/verification using node:crypto (null algorithm), base64url wire format table, and Neuron interoperability
- Message spec documenting ConnectRequest schema with TypeBox definitions, SignedMessage envelope construction, dual replay protection (nonce + timestamp), and versioning strategy
- Consent spec as descriptive-only document explicitly stating Axon's non-involvement, with wire format, token lifecycle diagram, and HIPAA boundary design rationale
- Credential spec documenting CredentialRecord schema matching src/registry/schemas.ts exactly, status lifecycle diagram, verification levels (v1/v2), broker credential check behavior, and NPI Luhn validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Write handshake, identity, and message spec documents** - `86353ad` (docs)
2. **Task 2: Write consent and credential spec documents** - `4c1ca70` (docs)

## Files Created/Modified
- `spec/handshake.md` - Connection handshake pipeline specification with denial codes and post-handshake Neuron flow
- `spec/identity.md` - Ed25519 identity, key format, signing/verification, and wire format specification
- `spec/message.md` - ConnectRequest schema, SignedMessage envelope, replay protection, and versioning specification
- `spec/consent.md` - Descriptive consent token format specification (Axon never touches consent)
- `spec/credential.md` - CredentialRecord schema, status lifecycle, verification levels, and broker check specification

## Decisions Made
- All specs written code-first, directly describing the implemented behavior from Plans 01 and 02 to prevent spec-code drift
- Consent spec explicitly includes a "Design Rationale" section explaining why Axon does not touch consent (separation of concerns, HIPAA boundary, transmit-and-exit principle)
- Denial codes in handshake spec are mapped to specific pipeline steps for developer clarity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - documentation-only plan with no external service configuration required.

## Next Phase Readiness
- All five protocol spec documents complete in spec/ directory
- Phase 4 (Protocol Specification and Connection Broker) is fully complete
- Specs serve as canonical reference for CareAgent ecosystem developers building against Axon's protocol

## Self-Check: PASSED

All 5 files verified present on disk. Both task commits (86353ad, 4c1ca70) verified in git log.

---
*Phase: 04-protocol-specification-and-connection-broker*
*Completed: 2026-02-22*
