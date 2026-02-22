---
phase: 04-protocol-specification-and-connection-broker
plan: 02
subsystem: broker
tags: [connection-broker, audit-trail, hash-chain, sha256, jsonl, ed25519, vitest]

# Dependency graph
requires:
  - phase: 04-protocol-specification-and-connection-broker
    provides: "Ed25519 identity primitives, protocol schemas, NonceStore, protocol error types"
  - phase: 03-registry-and-credentials
    provides: "AxonRegistry with NPI validation, credential management, endpoint storage"
provides:
  - "AuditTrail: hash-chained JSONL audit trail with SHA-256 chain integrity and verifyChain() tamper detection"
  - "AxonBroker: stateless connection pipeline (signature -> nonce -> credentials -> endpoint -> grant/deny)"
  - "Six categorical denial codes: SIGNATURE_INVALID, NONCE_REPLAYED, TIMESTAMP_EXPIRED, PROVIDER_NOT_FOUND, CREDENTIALS_INVALID, ENDPOINT_UNAVAILABLE"
  - "60 new tests covering protocol primitives and broker pipeline end-to-end"
  - "Protocol and broker modules exported from @careagent/axon package root"
affects: [04-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Hash-chained JSONL append-only audit trail", "Stateless broker pipeline with categorical denial codes", "Endpoint resolution through organization affiliations", "Stale heartbeat detection (5-minute threshold)"]

key-files:
  created:
    - src/broker/audit.ts
    - src/broker/broker.ts
    - src/broker/index.ts
    - test/protocol.test.ts
    - test/broker.test.ts
  modified:
    - src/index.ts
    - src/types/index.ts

key-decisions:
  - "Re-exported protocol types from types/index.ts as type-only re-exports to resolve ambiguous module exports with protocol/index.ts"
  - "Endpoint resolution for individual providers goes through first affiliation's organization_npi to find Neuron endpoint"
  - "Stale heartbeat threshold set to 5 minutes (300,000ms) matching research recommendation"
  - "Entry-level credential_status checked directly (not individual credential records) for connection gating"

patterns-established:
  - "Audit trail: append-only JSONL with hash chain, genesis prev_hash is 64 zeros, verifyChain() for integrity"
  - "Broker pipeline: decode -> verify signature -> parse JSON -> validate schema -> log attempt -> check nonce -> lookup provider -> check credentials -> resolve endpoint -> grant/deny"
  - "Denial messages: categorical human-readable strings, no sensitive details leaked to caller"

requirements-completed: [BROK-01, BROK-02, BROK-03]

# Metrics
duration: 6min
completed: 2026-02-22
---

# Phase 4 Plan 2: Connection Broker and Audit Trail Summary

**Stateless AxonBroker connection pipeline with hash-chained JSONL audit trail, six denial codes, and 60 new tests covering protocol primitives and broker end-to-end**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-22T13:33:07Z
- **Completed:** 2026-02-22T13:39:17Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- AxonBroker.connect() processes signed requests through full stateless pipeline: signature verification, nonce replay protection, credential status check, endpoint resolution, grant/deny
- Hash-chained JSONL audit trail with SHA-256 integrity verification and chain recovery across process restarts
- All six denial codes exercised in tests: SIGNATURE_INVALID, NONCE_REPLAYED, TIMESTAMP_EXPIRED, PROVIDER_NOT_FOUND, CREDENTIALS_INVALID, ENDPOINT_UNAVAILABLE
- Credential status enforcement: pending, expired, suspended, and revoked all denied
- Endpoint resolution through organization affiliations with stale heartbeat detection
- Protocol module: 100% coverage; Broker module: 89% statements, 87% branches
- All 195 tests passing (60 new, 135 existing) with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: AuditTrail class and AxonBroker pipeline** - `85bcf1b` (feat)
2. **Task 2: Protocol and broker test suites** - `7e7deb8` (test)

## Files Created/Modified
- `src/broker/audit.ts` - AuditTrail class with hash-chained JSONL, SHA-256 chain integrity, and verifyChain() static method
- `src/broker/broker.ts` - AxonBroker class with stateless connect() pipeline, six denial codes, endpoint resolution
- `src/broker/index.ts` - Broker module barrel export
- `src/index.ts` - Added protocol and broker module exports to package root
- `src/types/index.ts` - Changed protocol type exports to type-only re-exports to resolve ambiguity
- `test/protocol.test.ts` - 31 tests: identity key generation, sign/verify, schema validation, nonce store, error types
- `test/broker.test.ts` - 29 tests: audit trail integrity, broker happy path, all denial codes, credential status, endpoint failures

## Decisions Made
- Re-exported protocol types from types/index.ts as `export type { ... } from` to resolve TS2308 ambiguous export conflict with protocol/index.ts (both modules were re-exporting the same types)
- Endpoint resolution for individual providers uses first affiliation's organization_npi for Neuron endpoint lookup (per plan specification)
- Stale heartbeat threshold is 5 minutes (300,000ms) -- connections denied when last_heartbeat is older than this
- Entry-level credential_status (not individual credential records) used for connection gating -- all non-active statuses result in CREDENTIALS_INVALID denial

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Resolved ambiguous module exports**
- **Found during:** Task 1 (Module wiring)
- **Issue:** Adding `export * from './protocol/index.js'` to src/index.ts caused TS2308 errors because types/index.ts and protocol/index.ts both exported ConnectRequest, ConnectGrant, ConnectDenial, SignedMessage, DenialCode
- **Fix:** Changed types/index.ts to use `export type { ... } from '../protocol/schemas.js'` instead of re-declaring via Static<typeof>
- **Files modified:** src/types/index.ts
- **Verification:** `pnpm exec tsc --noEmit` passes
- **Committed in:** 85bcf1b (Task 1 commit)

**2. [Rule 1 - Bug] Fixed invalid NPI in test fixtures**
- **Found during:** Task 2 (Test suite creation)
- **Issue:** Test organization NPI `1023456789` failed Luhn validation causing 12 test failures
- **Fix:** Changed test organization NPI to `1245319599` (verified valid NPI from existing test suite)
- **Files modified:** test/broker.test.ts
- **Verification:** All 195 tests pass
- **Committed in:** 7e7deb8 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required. All operations use node:crypto built-in module.

## Next Phase Readiness
- AuditTrail and AxonBroker ready for Plan 03 spec document generation
- Full protocol and broker layer tested end-to-end with >80% coverage
- Module exports wired: `import { AxonBroker, AuditTrail } from '@careagent/axon'` works

## Self-Check: PASSED

All 7 files verified present on disk. Both task commits (85bcf1b, 7e7deb8) verified in git log.

---
*Phase: 04-protocol-specification-and-connection-broker*
*Completed: 2026-02-22*
