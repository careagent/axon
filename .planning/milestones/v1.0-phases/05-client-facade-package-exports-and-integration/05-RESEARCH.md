# Phase 5: Client Facade, Package Exports, and Integration - Research

**Researched:** 2026-02-22
**Domain:** TypeScript package exports, facade pattern, multi-entry bundling, consumer integration testing
**Confidence:** HIGH

## Summary

Phase 5 wraps Phases 1-4 into a consumable package with purpose-specific entry points, a namespaced facade object, and integration tests against the three authorized consumers: provider-core, patient-core, and neuron. No new capabilities are added -- this phase creates the public API surface and validates that consumers can import and use it.

The technical core is tsdown multi-entry bundling with package.json subpath exports. tsdown 0.20.3 (already installed) supports multi-entry via array or object `entry` config and can auto-generate `exports` fields. The zero-runtime-dependency constraint is already solved: `@sinclair/typebox` is inlined via `inlineOnly` in the existing tsdown config, and the published package has zero `dependencies` in package.json.

The neuron project has already built its own mock Axon server (`test/mock-axon/server.ts`) as a standalone HTTP server -- this validates the in-process programmatic mock approach and provides a reference implementation for the mock server Axon needs to ship as `@careagent/axon/mock`.

**Primary recommendation:** Use tsdown multi-entry with explicit entry files (`src/index.ts`, `src/taxonomy/index.ts`, `src/questionnaires/index.ts`, `src/types/index.ts`, `src/mock/index.ts`) and manually maintain the package.json `exports` map. Add a thin `src/facade.ts` that builds the `Axon` namespace object re-exporting the four core classes. Integration tests use vitest with real imports from the built package.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Export both flat named exports (`import { AxonRegistry, AxonBroker } from '@careagent/axon'`) AND a namespaced `Axon` object (`Axon.Registry`, `Axon.Broker`) for convenience
- Mock server pre-seeded with realistic fixtures (sample providers, valid credentials, taxonomy data) so consumers can test immediately without setup
- Integration tests will run against real consumer packages (provider-core, patient-core, neuron) -- they will be available before testing
- Dedicated compatibility matrix test suite (separate from module tests) that cross-validates: questionnaire taxonomy refs resolve, CANS mappings valid, every entry point exports documented API
- The Axon namespace object should provide both styles: `import { AxonRegistry } from '@careagent/axon'` AND `import { Axon } from '@careagent/axon'; Axon.Registry`

### Claude's Discretion
- **Entry point isolation:** strict isolation (separate tsdown entries per subpath) vs. convenience aliases (one bundle, narrower re-exports) -- pick what fits tsdown and zero-dependency constraint best
- **Additional subpaths:** which modules get subpaths beyond the roadmap three (taxonomy, questionnaires, types) -- determine based on consumer needs
- **Types entry content:** whether `@careagent/axon/types` exports pure TypeScript types only or includes runtime TypeBox schemas -- decide based on realistic consumer needs
- **Mock server shape:** in-process programmatic mock vs. standalone HTTP server -- pick what best serves integration testing without overcomplicating v1
- **Mock failure scenarios:** whether to simulate failure scenarios (expired credentials, connection denial) or happy paths only
- **Mock packaging:** `@careagent/axon/mock` subpath vs. separate package -- pick based on packaging simplicity
- **Facade shape:** unified `AxonClient` class vs. standalone class composition -- determine based on existing class structure
- **Config model:** centralized config vs. per-class configuration -- determine based on existing constructor patterns
- **Utility re-exports:** whether to re-export internal utilities (NPI validation, Ed25519 helpers) or keep API surface to classes + types only
- **Version export:** whether to include a version export (`Axon.version`) -- follow standard library conventions
- **Integration test depth:** full workflow testing vs. import-and-basic-call for provider-core taxonomy consumption
- **Crypto in integration tests:** real Ed25519 crypto vs. mocked crypto

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AXON-02 | Package exports TypeScript types, classes, and data for authorized consumers (provider-core, patient-core, neuron) | tsdown multi-entry with `exports` map in package.json; facade pattern for `Axon` namespace; existing class/type structure already organized per module |
| AXON-03 | Multiple entry points: full package, taxonomy-only, questionnaires-only, types-only | tsdown `entry` array with one file per subpath; package.json `exports` field with `import` + `types` conditions per subpath |
| CLIT-01 | `AxonRegistry`, `AxonBroker`, `AxonTaxonomy`, `AxonQuestionnaires` exported from package entry point | Already exported via `src/index.ts` barrel; add `Axon` namespace facade re-exporting as `Axon.Registry`, `Axon.Broker`, `Axon.Taxonomy`, `Axon.Questionnaires` |
| CLIT-02 | Consumer-specific entry points (taxonomy-only, registry-only, questionnaires-only, types-only) via tsdown multi-entry | Separate entry files per subpath; each gets its own tsdown chunk and `.d.ts`; package.json exports map routes subpaths |
| CLIT-03 | Mock Axon server for consumer integration testing (provider-core, patient-core, neuron) | In-process programmatic mock with pre-seeded fixtures; `@careagent/axon/mock` subpath export; reference implementation exists in neuron's `test/mock-axon/server.ts` |
| INTG-01 | Provider-core can consume taxonomy for `scope.permitted_actions` selection during onboarding | Provider-core has pending todo to integrate (`2026-02-21-integrate-scope-with-axon-actions-taxonomy.md`); test validates `AxonTaxonomy.getActionsForType('physician')` returns valid actions; CANS field `scope.permitted_actions` maps to taxonomy action IDs |
| INTG-02 | Patient-core can consume registry for provider discovery and connection initiation | Patient-core references axon in README; test validates `AxonRegistry.search()` and `AxonBroker.connect()` work from patient-core perspective |
| INTG-03 | Neuron can consume registry for organization/provider registration and endpoint management | Neuron already has `AxonClient` wrapper and mock server; test validates `AxonRegistry.registerNeuron()`, `AxonRegistry.registerProvider()`, and `AxonRegistry.updateEndpoint()` work correctly |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tsdown | 0.20.3 | Multi-entry bundling with dts generation | Already used; supports `entry` array/object, `inlineOnly` for zero-deps, auto-exports |
| vitest | 4.0.18 | Test runner for integration and compatibility tests | Already used; fast, native ESM, coverage via v8 |
| @sinclair/typebox | 0.34.48 | Runtime schema validation (inlined into bundle) | Already used; inlined via `inlineOnly` -- zero runtime dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js built-in `http` | - | Mock Axon HTTP server | For the mock server fixture factory |
| Node.js built-in `crypto` | - | Ed25519 identity for integration tests | Real crypto in integration tests (already proven in Phase 4) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual package.json exports | tsdown `exports: true` auto-generation | Auto-generation is experimental; manual gives full control and is more predictable for 5-6 subpaths |
| Standalone HTTP mock server | In-process mock with fixtures | Standalone adds complexity (process management); in-process is simpler, sufficient for v1 |
| Separate `@careagent/axon-mock` package | `@careagent/axon/mock` subpath | Subpath is simpler; one package, one install, consumers just import the subpath they need |

**Installation:**
No new packages needed. All tools are already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── index.ts                  # Main entry: re-exports all + Axon namespace
├── taxonomy/index.ts         # Subpath entry: @careagent/axon/taxonomy
├── questionnaires/index.ts   # Subpath entry: @careagent/axon/questionnaires
├── types/index.ts            # Subpath entry: @careagent/axon/types
├── mock/                     # NEW: Mock server module
│   ├── index.ts              # Subpath entry: @careagent/axon/mock
│   ├── server.ts             # MockAxonServer class
│   └── fixtures.ts           # Pre-seeded realistic data
├── registry/                 # Existing (no separate subpath)
├── protocol/                 # Existing (no separate subpath)
└── broker/                   # Existing (no separate subpath)

test/
├── taxonomy.test.ts          # Existing
├── ...                       # Existing module tests
├── compatibility-matrix.test.ts  # NEW: Cross-validation suite
└── integration/              # NEW: Consumer integration tests
    ├── entry-points.test.ts  # Every subpath resolves and exports correct API
    ├── provider-core.test.ts # Provider-core taxonomy consumption
    ├── patient-core.test.ts  # Patient-core registry + broker consumption
    └── neuron.test.ts        # Neuron registration + endpoint management
```

### Pattern 1: Facade Namespace Object
**What:** A single `Axon` object that collects all four core classes as named properties, enabling both import styles
**When to use:** When consumers want convenient grouped access without importing individual classes

```typescript
// src/index.ts (addition to existing barrel)
import { AxonRegistry } from './registry/index.js'
import { AxonBroker } from './broker/index.js'
import { AxonTaxonomy } from './taxonomy/index.js'
import { AxonQuestionnaires } from './questionnaires/index.js'

export const Axon = {
  Registry: AxonRegistry,
  Broker: AxonBroker,
  Taxonomy: AxonTaxonomy,
  Questionnaires: AxonQuestionnaires,
} as const
```

**Why a plain object, not a class:** All four core classes already exist as standalone entities. `AxonTaxonomy` and `AxonQuestionnaires` are fully static (no constructor). `AxonRegistry` takes a file path. `AxonBroker` takes a registry + audit trail. There is no shared configuration to unify. A plain `as const` object provides the namespace without introducing a constructor-based wrapper that would fight against the existing per-class initialization patterns.

### Pattern 2: tsdown Multi-Entry with Manual Exports Map
**What:** Explicit entry array in tsdown.config.ts + hand-maintained `exports` in package.json
**When to use:** When you need separate chunks with declaration files for each subpath export

```typescript
// tsdown.config.ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/taxonomy/index.ts',
    './src/questionnaires/index.ts',
    './src/types/index.ts',
    './src/mock/index.ts',
  ],
  format: ['es'],
  platform: 'node',
  dts: true,
  clean: true,
  fixedExtension: false,
  inlineOnly: ['@sinclair/typebox'],
})
```

```json
// package.json (exports field)
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./taxonomy": {
      "import": "./dist/taxonomy/index.js",
      "types": "./dist/taxonomy/index.d.ts"
    },
    "./questionnaires": {
      "import": "./dist/questionnaires/index.js",
      "types": "./dist/questionnaires/index.d.ts"
    },
    "./types": {
      "import": "./dist/types/index.js",
      "types": "./dist/types/index.d.ts"
    },
    "./mock": {
      "import": "./dist/mock/index.js",
      "types": "./dist/mock/index.d.ts"
    }
  }
}
```

**Critical note on tsdown multi-entry output paths:** With `entry: ['./src/index.ts', './src/taxonomy/index.ts']`, tsdown preserves directory structure under `src/` in the output. So `src/taxonomy/index.ts` becomes `dist/taxonomy/index.js`. This matches the desired subpath routing naturally. The existing single-entry build produces `dist/index.js` -- multi-entry should produce the same for the main entry plus `dist/taxonomy/index.js`, `dist/questionnaires/index.js`, etc.

### Pattern 3: In-Process Mock Server with Fixture Factory
**What:** A `createMockAxonServer()` function that returns an HTTP server pre-loaded with realistic data
**When to use:** Consumer integration tests need a running "Axon" to test against

```typescript
// src/mock/server.ts
import http from 'node:http'
import { AxonRegistry } from '../registry/registry.js'
import { AxonBroker } from '../broker/broker.js'
import { AuditTrail } from '../broker/audit.js'
import { loadFixtures } from './fixtures.js'

export interface MockAxonServer {
  readonly server: http.Server
  readonly registry: AxonRegistry
  readonly broker: AxonBroker
  readonly url: string
  start(): Promise<string>
  stop(): Promise<void>
}

export function createMockAxonServer(options?: {
  port?: number
}): MockAxonServer {
  // Pre-seeded with realistic fixtures
  // HTTP routes matching the API contract neuron's AxonClient expects
  // ...
}
```

**Reference:** Neuron already has a mock Axon server at `/Users/medomatic/Documents/Projects/neuron/test/mock-axon/server.ts` implementing:
- `POST /v1/neurons` -- register neuron
- `PUT /v1/neurons/:id/endpoint` -- heartbeat/endpoint update
- `POST /v1/neurons/:id/providers` -- register provider
- `DELETE /v1/neurons/:id/providers/:npi` -- remove provider
- `GET /v1/neurons/:id` -- get neuron state

The Axon mock server should implement these same routes (they are the contract) plus additional routes for provider-core and patient-core use cases (taxonomy data, registry search, broker connect).

### Pattern 4: Compatibility Matrix Test Suite
**What:** A dedicated test file that cross-validates data integrity across all modules
**When to use:** Ensuring questionnaire taxonomy references resolve, CANS field mappings are valid, and API surface matches documentation

```typescript
// test/compatibility-matrix.test.ts
describe('Compatibility Matrix', () => {
  describe('questionnaire-taxonomy cross-validation', () => {
    // Every action_assignment in every questionnaire references
    // an action ID that exists in AxonTaxonomy
  })

  describe('CANS field validation', () => {
    // Every cans_field in every questionnaire maps to a valid
    // field in VALID_CANS_FIELDS
  })

  describe('entry point API surface', () => {
    // Dynamic import of each subpath, verify expected exports exist
  })
})
```

### Anti-Patterns to Avoid
- **Wrapping static classes in an AxonClient instance:** AxonTaxonomy and AxonQuestionnaires are static (no constructor, lazy-loaded singleton data). Forcing them into an instance-based AxonClient would require either making them non-static (breaking change) or wrapping them in pass-through methods (unnecessary indirection). Use a plain namespace object instead.
- **Re-exporting everything from every subpath:** Each subpath should export only what its consumers need. `@careagent/axon/taxonomy` should not pull in registry or broker code.
- **Using `exports: true` auto-generation without review:** The auto-generation is experimental in tsdown 0.20.x. For 5-6 explicit subpaths, manual maintenance is safer and more predictable.
- **Creating the mock server as a separate npm package:** One package with subpath exports is simpler for consumers. They install `@careagent/axon` once and import from `@careagent/axon/mock` in devDependencies usage.

## Discretion Recommendations

Based on codebase analysis and consumer needs, here are recommendations for the areas left to Claude's discretion:

### Entry Point Isolation: Use Strict Isolation (Separate tsdown Entries)
**Recommendation:** Separate tsdown entry per subpath.
**Rationale:** The whole point of subpath exports is tree-shaking and minimal imports. If `@careagent/axon/taxonomy` pulls in registry code because they share a single bundle, the benefit is lost. tsdown multi-entry naturally produces separate chunks. The zero-dep constraint is met because TypeBox is inlined via `inlineOnly` into each chunk independently.

### Additional Subpaths: Add `mock` Only
**Recommendation:** Five subpaths: `.`, `./taxonomy`, `./questionnaires`, `./types`, `./mock`. No separate `./registry`, `./protocol`, or `./broker` subpaths.
**Rationale:** Consumer analysis shows:
- **Provider-core** needs taxonomy (for `scope.permitted_actions` validation during onboarding)
- **Patient-core** needs registry + broker (for provider discovery and connection) -- these are used together, so the main entry point serves this
- **Neuron** needs the mock server (for integration testing) and types (for TypeBox schema references)
- Registry, protocol, and broker are always used together (broker depends on registry + protocol). Separating them creates confusing partial imports with no real consumer benefit.

### Types Entry Content: Include Both Types AND TypeBox Schemas
**Recommendation:** `@careagent/axon/types` should export both the derived TypeScript types AND the TypeBox schema objects.
**Rationale:** Neuron's type system already uses TypeBox (`@sinclair/typebox`) with `Static<typeof Schema>` patterns. Exporting only derived types would force consumers to duplicate schema definitions if they need runtime validation. Since TypeBox is inlined anyway (zero-dep), including schemas in the types subpath costs nothing and provides runtime validation for consumers who want it. The existing `src/types/index.ts` already re-exports type-only protocol types -- extend this pattern to include schema exports.

### Mock Server Shape: In-Process Programmatic Mock
**Recommendation:** In-process `createMockAxonServer()` function, not a standalone HTTP server.
**Rationale:** Neuron's existing mock (`test/mock-axon/server.ts`) is already in-process. An in-process mock avoids process management complexity, port conflicts, and cleanup issues. Consumers call `createMockAxonServer()` in their test setup, get back a server they can start/stop, and it's garbage collected when the test ends.

### Mock Failure Scenarios: Include Happy Paths AND Key Failure Scenarios
**Recommendation:** Support both happy paths and critical failure scenarios (expired credentials, provider not found, invalid NPI).
**Rationale:** The neuron already tests for heartbeat failure and Axon-unreachable degraded mode. The mock needs to support these scenarios or neuron's integration tests cannot verify graceful degradation. Implement failures as configurable behaviors rather than always-on -- the default is happy path, but consumers can trigger failures via mock API.

### Mock Packaging: `@careagent/axon/mock` Subpath
**Recommendation:** Package as `@careagent/axon/mock`, not a separate package.
**Rationale:** One install, one version, one dependency. Consumers add `@careagent/axon` to their devDependencies and import `@careagent/axon/mock` in test files. This matches how testing utilities are typically distributed in modern packages.

### Facade Shape: Plain Namespace Object, NOT a Unified AxonClient Class
**Recommendation:** Use `Axon` as a plain `const` object with class references.
**Rationale:** The four core classes have incompatible initialization patterns:
- `AxonTaxonomy`: Fully static, lazy-loaded from filesystem, no constructor
- `AxonQuestionnaires`: Fully static, lazy-loaded from filesystem, no constructor
- `AxonRegistry`: Instance-based, takes a file path in constructor
- `AxonBroker`: Instance-based, takes a registry + audit trail in constructor
A unified `AxonClient` class would have to bridge these patterns awkwardly. A plain object preserves each class's natural usage while providing convenient grouping.

### Config Model: Per-Class (Keep Existing Pattern)
**Recommendation:** No centralized config. Each class keeps its existing constructor pattern.
**Rationale:** AxonTaxonomy and AxonQuestionnaires have no config (they read from filesystem paths relative to the package). AxonRegistry takes a persistence file path. AxonBroker takes dependencies. These patterns are clean and explicit. Centralizing config would add complexity for no consumer benefit.

### Utility Re-Exports: Re-export NPI Validation and Ed25519 Identity Helpers
**Recommendation:** Re-export `validateNPI`, `generateKeyPair`, `signPayload`, `verifySignature`, `generateNonce` from the main entry point.
**Rationale:** Neuron uses NPI validation (already has its own via `src/validators/npi.ts`). Provider-core and patient-core need Ed25519 helpers for signing/verifying. These are small, well-tested functions that consumers would otherwise have to reimplement. They are already exported from their module barrels and flow through `src/index.ts` -- just verify they remain accessible.

### Version Export: Yes, Include `Axon.version`
**Recommendation:** Export a `version` string from the main entry point, readable as `Axon.version`.
**Rationale:** Standard library convention. Useful for debugging and logging. Read from package.json at build time or hardcode in a constants file.

### Integration Test Depth: Import + Basic Call (Not Full Workflows)
**Recommendation:** Integration tests verify that imports resolve correctly and basic API calls work. Full workflow testing (e.g., complete onboarding flow) is out of scope for Phase 5.
**Rationale:** Full workflow tests require each consumer package to have implemented their Axon integration code (provider-core's todo for taxonomy integration is still pending). Phase 5 integration tests verify the *contract* -- that the entry points work, the types are correct, and basic operations succeed. Consumer-side workflow testing happens in each consumer's own test suite.

### Crypto in Integration Tests: Real Ed25519 Crypto
**Recommendation:** Use real Ed25519 crypto in integration tests.
**Rationale:** Already proven and fast in Phase 4 broker tests. Key generation + sign + verify takes milliseconds. Mocking crypto would reduce test confidence without meaningful speed improvement.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TypeScript declaration generation | Custom `.d.ts` authoring | tsdown `dts: true` | tsdown handles declaration bundling and subpath resolution automatically |
| Package exports field | Custom build script | Manual `exports` map in package.json + tsdown multi-entry | Explicit and predictable; 5-6 entries are easy to maintain manually |
| TypeBox inlining for zero-deps | Custom bundler plugin | `inlineOnly: ['@sinclair/typebox']` in tsdown config | Already working; handles deep imports from `@sinclair/typebox/compiler` |
| Mock HTTP server framework | Express/Fastify/Hono | Node.js built-in `http` module | Neuron's mock already uses this pattern; no dependencies needed for simple route matching |

**Key insight:** The existing build pipeline (tsdown + inlineOnly) already solves the hardest problem -- zero runtime dependencies with TypeBox schema inlining. Phase 5 extends this pipeline to multiple entries without changing the core approach.

## Common Pitfalls

### Pitfall 1: Circular Imports Between Subpath Entries
**What goes wrong:** Module A's entry imports from Module B's entry (e.g., taxonomy imports from types), creating circular resolution in bundled output
**Why it happens:** When entries share code, tsdown may create circular chunk references
**How to avoid:** Each subpath entry should import from internal source files (e.g., `../taxonomy/schemas.js`), never from other subpath entry points. The barrel exports are for consumers, not for internal cross-references.
**Warning signs:** Runtime `undefined` values, "cannot access before initialization" errors

### Pitfall 2: TypeBox Double-Inlining Across Chunks
**What goes wrong:** Each tsdown entry chunk inlines its own copy of TypeBox, inflating total package size
**Why it happens:** `inlineOnly` inlines into every chunk that uses TypeBox, not shared across chunks
**How to avoid:** Accept this trade-off for v1 -- each subpath is self-contained, which is the design goal. Monitor total package size. If size becomes an issue, consider a shared chunk strategy in v2.
**Warning signs:** Each chunk being 200KB+ when the single-entry bundle is 260KB today

### Pitfall 3: Missing `types` Condition in Exports Map
**What goes wrong:** TypeScript consumers get "Cannot find module '@careagent/axon/taxonomy'" errors even though the JS resolves
**Why it happens:** The `exports` field needs both `import` and `types` conditions for TypeScript to resolve declarations
**How to avoid:** Every entry in the `exports` map must have both `import` (points to `.js`) and `types` (points to `.d.ts`)
**Warning signs:** TypeScript errors in consumer projects; `tsc --noEmit` fails but runtime works

### Pitfall 4: Subpath Exports Blocking Internal Imports
**What goes wrong:** The `exports` field in package.json acts as a whitelist. Any path not listed is blocked for external consumers.
**Why it happens:** Node.js enforces `exports` strictly -- `import { something } from '@careagent/axon/registry/schemas'` would fail unless explicitly listed
**How to avoid:** Only expose the documented subpaths. Consumers should never import from internal paths. This is the correct behavior -- it prevents coupling to internals.
**Warning signs:** None -- this is working as designed. Only list the 5-6 subpaths you want consumers to use.

### Pitfall 5: Mock Server Fixtures Drifting from Real Schemas
**What goes wrong:** Mock returns data that doesn't match TypeBox schemas; consumers' integration tests pass against mock but fail against real Axon
**Why it happens:** Fixtures are hand-crafted JSON that isn't validated against the same schemas the real code uses
**How to avoid:** Create fixtures using the actual class APIs (`AxonRegistry.registerProvider()`, `AxonTaxonomy.getActionsForType()`) so they go through the same validation. Alternatively, validate fixtures against TypeBox schemas in the mock server's initialization.
**Warning signs:** Tests pass with mock but fail with real Axon; schema validation errors in consumer code

### Pitfall 6: `data/` Directory Not Included in Package
**What goes wrong:** `AxonTaxonomy` and `AxonQuestionnaires` use `readFileSync` with path walk-up to find `data/taxonomy/` and `data/questionnaires/`. If these aren't in the published package, the classes fail at runtime.
**Why it happens:** package.json `files` field controls what's published. Currently `files: ["dist", "data"]` -- this is correct.
**How to avoid:** Verify that `files` field includes `data`. After build, verify `npm pack --dry-run` lists the data files.
**Warning signs:** "ENOENT: no such file or directory" errors when consumers use AxonTaxonomy or AxonQuestionnaires

## Code Examples

### Multi-Entry tsdown Config
```typescript
// tsdown.config.ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/taxonomy/index.ts',
    './src/questionnaires/index.ts',
    './src/types/index.ts',
    './src/mock/index.ts',
  ],
  format: ['es'],
  platform: 'node',
  dts: true,
  clean: true,
  fixedExtension: false,
  inlineOnly: ['@sinclair/typebox'],
})
```

### Package.json Exports Map
```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./taxonomy": {
      "import": "./dist/taxonomy/index.js",
      "types": "./dist/taxonomy/index.d.ts"
    },
    "./questionnaires": {
      "import": "./dist/questionnaires/index.js",
      "types": "./dist/questionnaires/index.d.ts"
    },
    "./types": {
      "import": "./dist/types/index.js",
      "types": "./dist/types/index.d.ts"
    },
    "./mock": {
      "import": "./dist/mock/index.js",
      "types": "./dist/mock/index.d.ts"
    }
  }
}
```

### Axon Namespace Object
```typescript
// In src/index.ts (addition to existing barrel exports)
import { AxonRegistry } from './registry/index.js'
import { AxonBroker } from './broker/index.js'
import { AxonTaxonomy } from './taxonomy/index.js'
import { AxonQuestionnaires } from './questionnaires/index.js'

/** Version of the @careagent/axon package */
export const AXON_VERSION = '0.1.0'

/**
 * Convenience namespace object grouping all Axon core classes.
 *
 * @example
 * ```ts
 * import { Axon } from '@careagent/axon'
 *
 * Axon.Taxonomy.getActionsForType('physician')
 * Axon.Questionnaires.getForType('physician')
 * const registry = new Axon.Registry('/tmp/registry.json')
 * ```
 */
export const Axon = {
  Registry: AxonRegistry,
  Broker: AxonBroker,
  Taxonomy: AxonTaxonomy,
  Questionnaires: AxonQuestionnaires,
  version: AXON_VERSION,
} as const
```

### Mock Server Entry Point
```typescript
// src/mock/index.ts
export { createMockAxonServer } from './server.js'
export type { MockAxonServer, MockAxonOptions } from './server.js'
export { DEFAULT_FIXTURES } from './fixtures.js'
export type { MockFixtures } from './fixtures.js'
```

### Compatibility Matrix Test
```typescript
// test/compatibility-matrix.test.ts
import { describe, it, expect } from 'vitest'
import { AxonTaxonomy } from '../src/taxonomy/taxonomy.js'
import { AxonQuestionnaires } from '../src/questionnaires/questionnaires.js'
import { VALID_CANS_FIELDS } from '../src/questionnaires/cans-fields.js'

describe('Compatibility Matrix', () => {
  it('every questionnaire action reference resolves in taxonomy', () => {
    const types = AxonTaxonomy.getProviderTypes()
    for (const type of types) {
      const q = AxonQuestionnaires.getForType(type.id)
      if (!q) continue
      for (const question of q.questions) {
        if (!question.options) continue
        for (const option of question.options) {
          if (!option.action_assignments) continue
          for (const assignment of option.action_assignments) {
            expect(
              AxonTaxonomy.validateAction(assignment.action_id),
              `Action ${assignment.action_id} in questionnaire ${q.provider_type} not found in taxonomy`
            ).toBe(true)
          }
        }
      }
    }
  })

  it('every questionnaire CANS field mapping is valid', () => {
    const types = AxonTaxonomy.getProviderTypes()
    for (const type of types) {
      const q = AxonQuestionnaires.getForType(type.id)
      if (!q) continue
      for (const question of q.questions) {
        if (question.cans_field) {
          expect(
            VALID_CANS_FIELDS.has(question.cans_field),
            `CANS field ${question.cans_field} in questionnaire ${q.provider_type} not in allowlist`
          ).toBe(true)
        }
      }
    }
  })
})
```

### Entry Point Verification Test
```typescript
// test/integration/entry-points.test.ts
import { describe, it, expect } from 'vitest'

describe('Entry point exports', () => {
  it('@careagent/axon main entry exports core classes', async () => {
    // Use dynamic import from built output
    const axon = await import('../../dist/index.js')
    expect(axon.AxonRegistry).toBeDefined()
    expect(axon.AxonBroker).toBeDefined()
    expect(axon.AxonTaxonomy).toBeDefined()
    expect(axon.AxonQuestionnaires).toBeDefined()
    expect(axon.Axon).toBeDefined()
    expect(axon.Axon.Registry).toBe(axon.AxonRegistry)
  })

  it('@careagent/axon/taxonomy exports taxonomy only', async () => {
    const taxonomy = await import('../../dist/taxonomy/index.js')
    expect(taxonomy.AxonTaxonomy).toBeDefined()
    expect(taxonomy.loadTaxonomy).toBeDefined()
    // Should NOT export registry, broker, etc.
    expect((taxonomy as Record<string, unknown>).AxonRegistry).toBeUndefined()
  })
})
```

## Consumer Analysis

### Provider-Core
**Location:** `/Users/medomatic/Documents/Projects/provider-core`
**Current Axon usage:** None (no `@careagent/axon` dependency yet)
**Planned usage:** Pending todo `integrate-scope-with-axon-actions-taxonomy.md`:
1. Validate `scope.permitted_actions` strings against taxonomy
2. Present selectable actions during onboarding filtered by provider type
3. Reference taxonomy action IDs in credential validation and skill gating

**What provider-core needs from Axon:**
- `@careagent/axon/taxonomy` -- `AxonTaxonomy.getActionsForType(providerType)` for onboarding
- `@careagent/axon/types` -- TypeScript types for `TaxonomyAction`, `ProviderType`
- Package structure: zero runtime deps (provider-core is also zero-dep)

### Patient-Core
**Location:** `/Users/medomatic/Documents/Projects/patient-core`
**Current Axon usage:** None (referenced in README only)
**Planned usage:** Provider discovery and connection initiation

**What patient-core needs from Axon:**
- Main entry `@careagent/axon` -- `AxonBroker.connect()` for connection initiation
- `@careagent/axon/types` -- TypeScript types for `ConnectRequest`, `ConnectGrant`, `ConnectDenial`
- Ed25519 identity helpers (`generateKeyPair`, `signPayload`, `verifySignature`) for consent tokens

### Neuron
**Location:** `/Users/medomatic/Documents/Projects/neuron`
**Current Axon usage:** Has its own `AxonClient` HTTP wrapper (`src/registration/axon-client.ts`) and mock server (`test/mock-axon/server.ts`)
**Key finding:** Neuron communicates with Axon via HTTP API, NOT by importing Axon classes directly. Neuron's `AxonClient` makes HTTP requests to endpoints like `POST /v1/neurons`, `PUT /v1/neurons/:id/endpoint`, etc.

**What neuron needs from Axon:**
- `@careagent/axon/mock` -- Replace neuron's custom mock server with Axon's official mock
- `@careagent/axon/types` -- TypeScript types for `RegistryEntry`, `NeuronEndpoint`, `CredentialRecord` for type-safe API interactions
- The mock server must implement the HTTP API contract neuron's `AxonClient` expects (see routes above)

**Critical insight for mock server design:** The mock server is NOT a wrapper around `AxonRegistry` in-memory class. It is an HTTP server implementing the REST API that neuron's `AxonClient` calls over the network. The mock must implement HTTP routes, not provide direct class access. However, internally it can use `AxonRegistry` to manage state, which ensures fixture data matches real schemas.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single entry point | Subpath exports via package.json `exports` | Node.js 12.7+ (2019), widely adopted 2022+ | Enables tree-shaking and purpose-specific imports |
| `main` + `types` fields | `exports` field with conditions | Node.js 12.7+ / TypeScript 4.7+ | `exports` takes precedence over `main`; backward compat via keeping both |
| tsup for library bundling | tsdown (powered by Rolldown/Oxc) | 2024-2025 | Faster builds, same API surface as tsup |

**Deprecated/outdated:**
- Using `typesVersions` for subpath type resolution is legacy -- `exports` with `types` condition is the modern approach (TypeScript 4.7+, `moduleResolution: "node16"` or `"bundler"`)

## Open Questions

1. **tsdown multi-entry chunk deduplication**
   - What we know: tsdown with `inlineOnly` inlines TypeBox into each entry's chunk independently
   - What's unclear: Whether tsdown 0.20.3 supports shared chunks across entries to avoid TypeBox duplication
   - Recommendation: Accept duplication for v1; total package size is unlikely to be a problem. Monitor with `npm pack --dry-run` and `du -sh dist/`. If needed, investigate tsdown's `splitting` option in v2.

2. **Integration test against unbuilt consumer packages**
   - What we know: Provider-core and patient-core exist but haven't integrated Axon yet (no `@careagent/axon` dependency)
   - What's unclear: Whether integration tests should wait for consumer integration or test the contract from Axon's side
   - Recommendation: Test from Axon's side -- verify that the API Axon exports is what consumers will need. Use mock consumers in tests that simulate the expected import and usage patterns. Real consumer integration testing happens in each consumer's own CI.

3. **Mock server HTTP route completeness**
   - What we know: Neuron's mock implements 5 routes (register, heartbeat, add/remove/get provider). Provider-core and patient-core may need additional routes (search, connect).
   - What's unclear: The full HTTP API surface Axon would expose in production (v1 is a library, not a hosted service)
   - Recommendation: Start with the routes neuron's `AxonClient` already calls (proven contract). Add search and connect mock routes for patient-core testing. Document the mock API surface explicitly.

## Sources

### Primary (HIGH confidence)
- **Axon codebase** -- Direct analysis of all source files in `/Users/medomatic/Documents/Projects/axon/src/`
- **Neuron codebase** -- Direct analysis of `/Users/medomatic/Documents/Projects/neuron/src/registration/axon-client.ts` (HTTP API contract), `/Users/medomatic/Documents/Projects/neuron/test/mock-axon/server.ts` (mock server reference), `/Users/medomatic/Documents/Projects/neuron/PRD.md` (integration requirements)
- **Provider-core codebase** -- Direct analysis of pending todo and `scope.permitted_actions` usage
- **Patient-core codebase** -- Direct analysis of axon references and dependency structure
- **tsdown official docs** -- https://tsdown.dev/options/package-exports (auto-exports), https://tsdown.dev/options/entry (multi-entry)

### Secondary (MEDIUM confidence)
- **tsdown multi-entry output structure** -- Verified against neuron's tsdown config (`entry: ['src/index.ts', 'src/cli/index.ts']`) producing `dist/index.mjs` and `dist/cli/index.mjs`
- **Package.json exports specification** -- https://hirok.io/posts/package-json-exports (comprehensive guide)

### Tertiary (LOW confidence)
- **tsdown chunk deduplication with inlineOnly** -- Not verified; assumed each chunk gets independent TypeBox inlining based on rollup/rolldown bundling behavior

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already installed and proven in Phases 1-4
- Architecture: HIGH -- patterns derived from direct codebase analysis and working reference implementations
- Pitfalls: HIGH -- identified from real codebase constraints (readFileSync data loading, TypeBox inlining, exports field requirements)
- Consumer analysis: HIGH -- based on direct reading of three consumer codebases
- Mock server design: MEDIUM -- HTTP route contract is proven (neuron's mock), but completeness of route surface for all three consumers needs validation during implementation

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable domain -- package exports and bundling patterns are mature)
