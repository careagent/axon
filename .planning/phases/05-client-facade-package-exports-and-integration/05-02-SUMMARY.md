---
phase: 05-client-facade-package-exports-and-integration
plan: 02
subsystem: testing
tags: [mock-server, http, integration-testing, fixtures, node-http]

# Dependency graph
requires:
  - phase: 03-provider-registry-and-credential-management
    provides: AxonRegistry with NPI validation and search
  - phase: 04-protocol-specification-and-connection-broker
    provides: AxonBroker with Ed25519 connect pipeline and AuditTrail
provides:
  - createMockAxonServer() factory for consumer integration testing
  - Pre-seeded realistic fixtures with valid NPIs and credential states
  - Configurable failure modes for error path testing
  - Full HTTP API matching neuron AxonClient contract
affects: [05-03 (package exports wiring), neuron integration tests, provider-core tests, patient-core tests]

# Tech tracking
tech-stack:
  added: []
  patterns: [mock-server-with-real-internals, fixture-seeded-testing, configurable-failure-modes]

key-files:
  created:
    - src/mock/fixtures.ts
    - src/mock/server.ts
    - src/mock/index.ts
    - test/mock-server.test.ts
  modified: []

key-decisions:
  - "Mock server uses real AxonRegistry and AxonBroker internally for schema-validated state management"
  - "Fixture NPIs validated against Luhn algorithm: 1245319599 (org), 1679576722, 1376841239, 1003000126 (providers)"
  - "Failure modes short-circuit before broker pipeline for deterministic test behavior"
  - "neuronTokens map tracks registration_id to NPI for route dispatch"

patterns-established:
  - "Mock servers backed by real domain classes: ensures mock matches production behavior"
  - "Fixture data with expired credentials: always include at least one denial scenario"

requirements-completed: [CLIT-03]

# Metrics
duration: 4min
completed: 2026-02-22
---

# Phase 5 Plan 02: Mock Axon Server Summary

**Mock HTTP server with pre-seeded fixtures using real AxonRegistry and AxonBroker internals for consumer integration testing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T15:32:07Z
- **Completed:** 2026-02-22T15:36:16Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created realistic test fixtures with 1 organization and 3 physicians (2 active, 1 expired credentials) using Luhn-validated NPIs
- Built full MockAxonServer HTTP server implementing all neuron AxonClient routes plus search and connect
- Configurable failure modes (expiredCredentials, endpointUnavailable) for deterministic error path testing
- 12 integration tests covering all routes, search filtering, connect grant/denial, and failure modes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create mock fixtures with realistic pre-seeded data** - `298d643` (feat)
2. **Task 2: Create MockAxonServer HTTP server with route handlers and failure configuration** - `a8d0be3` (feat)

## Files Created/Modified
- `src/mock/fixtures.ts` - MockFixtures type and DEFAULT_FIXTURES with 1 org + 3 providers (valid NPIs, active/expired credentials)
- `src/mock/server.ts` - createMockAxonServer() with all HTTP routes backed by real AxonRegistry and AxonBroker
- `src/mock/index.ts` - Barrel export for mock subpath entry point
- `test/mock-server.test.ts` - 12 integration tests covering registration, heartbeat, search, connect, and failure modes

## Decisions Made
- Mock server uses real AxonRegistry and AxonBroker internally rather than simple in-memory maps, ensuring all mock responses go through schema validation and the real connect pipeline
- Fixture NPI numbers verified against Luhn algorithm at development time: 1245319599 (org), 1679576722 (Dr. Sarah Chen), 1376841239 (Dr. James Wilson), 1003000126 (Dr. Robert Hayes with expired credentials)
- Failure modes (expiredCredentials, endpointUnavailable) short-circuit before the broker pipeline to provide deterministic test behavior without needing to manipulate registry state
- neuronTokens map created to track registration_id to NPI mapping, since the HTTP API uses registration_id in URLs but the registry uses NPI as primary key

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed NPI collision in test data**
- **Found during:** Task 2 (mock server tests)
- **Issue:** Test cases tried to register neurons with NPIs already used by pre-seeded fixture providers (e.g., 1679576722 for Dr. Sarah Chen)
- **Fix:** Changed test NPIs to unused valid NPIs: 1000000004, 1000000020, 1000000038, 1000000046
- **Files modified:** test/mock-server.test.ts
- **Verification:** All 207 tests pass
- **Committed in:** a8d0be3 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minimal -- test data adjustment only, no architectural changes.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Mock module files created and working, ready for Plan 03 to wire into tsdown.config.ts and package.json exports
- src/mock/index.ts provides the barrel export that Plan 03 will add as a subpath export

## Self-Check: PASSED

All files verified present: src/mock/fixtures.ts, src/mock/server.ts, src/mock/index.ts, test/mock-server.test.ts
All commits verified: 298d643, a8d0be3

---
*Phase: 05-client-facade-package-exports-and-integration*
*Completed: 2026-02-22*
