# Phase 5: Client Facade, Package Exports, and Integration - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Expose Axon's internal modules through a clean public API surface with purpose-specific entry points, provide a mock server for consumer integration testing, and verify that the three authorized consumers (provider-core, patient-core, neuron) can correctly import and use Axon. No new capabilities are added — this phase wraps and validates what Phases 1-4 built.

</domain>

<decisions>
## Implementation Decisions

### Entry point design
- Export both flat named exports (`import { AxonRegistry, AxonBroker } from '@careagent/axon'`) AND a namespaced `Axon` object (`Axon.Registry`, `Axon.Broker`) for convenience
- Claude's Discretion: strict isolation (separate tsdown entries per subpath) vs. convenience aliases (one bundle, narrower re-exports) — pick what fits tsdown and zero-dependency constraint best
- Claude's Discretion: which modules get subpaths beyond the roadmap three (taxonomy, questionnaires, types) — determine based on consumer needs
- Claude's Discretion: whether `@careagent/axon/types` exports pure TypeScript types only or includes runtime TypeBox schemas — decide based on realistic consumer needs

### Mock server shape
- Pre-seeded with realistic fixtures (sample providers, valid credentials, taxonomy data) so consumers can test immediately without setup
- Claude's Discretion: in-process programmatic mock vs. standalone HTTP server — pick what best serves integration testing without overcomplicating v1
- Claude's Discretion: whether to simulate failure scenarios (expired credentials, connection denial) or happy paths only
- Claude's Discretion: packaging as `@careagent/axon/mock` subpath vs. separate package — pick based on packaging simplicity

### Client facade API
- Claude's Discretion: unified `AxonClient` class vs. standalone class composition — determine based on existing class structure and consumption simplicity
- Claude's Discretion: centralized config vs. per-class configuration — determine based on existing constructor patterns
- Claude's Discretion: whether to re-export internal utilities (NPI validation, Ed25519 helpers) or keep API surface to classes + types only
- Claude's Discretion: whether to include a version export (`Axon.version`) — follow standard library conventions

### Integration test scope
- Integration tests will run against real consumer packages (provider-core, patient-core, neuron) — they will be available before testing
- Dedicated compatibility matrix test suite (separate from module tests) that cross-validates: questionnaire taxonomy refs resolve, CANS mappings valid, every entry point exports documented API
- Claude's Discretion: full workflow testing vs. import-and-basic-call for provider-core taxonomy consumption
- Claude's Discretion: real Ed25519 crypto vs. mocked crypto in integration tests

</decisions>

<specifics>
## Specific Ideas

- Consumer packages (provider-core, patient-core, neuron) will be ready before integration testing — use real imports, not simulations
- The Axon namespace object should provide both styles: `import { AxonRegistry } from '@careagent/axon'` AND `import { Axon } from '@careagent/axon'; Axon.Registry`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-client-facade-package-exports-and-integration*
*Context gathered: 2026-02-22*
