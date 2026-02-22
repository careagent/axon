---
phase: 01-package-foundation-and-clinical-action-taxonomy
plan: 01
subsystem: infra
tags: [pnpm, typescript, tsdown, vitest, typebox, esm, zero-deps]

# Dependency graph
requires:
  - phase: none
    provides: "First phase, no prior dependencies"
provides:
  - "pnpm/TypeScript/tsdown/vitest package scaffold with zero runtime deps"
  - "TypeBox schemas for TaxonomyVersion, TaxonomyAction, ProviderType"
  - "TypeCompiler-validated JSON loader (loadTaxonomy)"
  - "Exported types derived from TypeBox schemas via Static inference"
affects: [01-02-PLAN, 01-03-PLAN, phase-2, phase-3]

# Tech tracking
tech-stack:
  added: [typescript 5.9.3, tsdown 0.20.3, vitest 4.0.18, "@sinclair/typebox 0.34.48", "@vitest/coverage-v8 4.0.18", "@tsconfig/node22 22.0.5", "@types/node 25.3.0"]
  patterns: [esm-only-package, zero-runtime-deps, typebox-schema-first, typecompiler-validation]

key-files:
  created:
    - package.json
    - tsconfig.json
    - tsdown.config.ts
    - vitest.config.ts
    - src/index.ts
    - src/taxonomy/index.ts
    - src/taxonomy/schemas.ts
    - src/taxonomy/loader.ts
    - src/types/index.ts
    - data/taxonomy/.gitkeep
    - .gitignore
    - pnpm-workspace.yaml
  modified: []

key-decisions:
  - "Removed isolatedDeclarations from tsconfig -- incompatible with TypeBox schema inference pattern; all other strict flags retained"
  - "Used fixedExtension: false in tsdown to produce .js/.d.ts (matching package.json exports) instead of .mjs/.d.mts"
  - "Added inlineOnly: ['@sinclair/typebox'] to tsdown to explicitly declare bundled devDependency"
  - "Used createRequire for JSON loading in ESM context (Node.js standard pattern)"

patterns-established:
  - "TypeBox schema-first: define schemas, derive types via Static<typeof Schema>"
  - "Zero runtime deps: all libraries in devDependencies, bundled by tsdown"
  - "Module re-export chain: src/index.ts -> taxonomy/index.ts -> schemas.ts/loader.ts"
  - "TypeCompiler validation: compile schema validators at module load time for runtime JSON validation"

requirements-completed: [AXON-01, TAXO-03, TAXO-07]

# Metrics
duration: 8min
completed: 2026-02-21
---

# Phase 1 Plan 01: Package Scaffold Summary

**pnpm/TypeScript/tsdown/vitest scaffold with TypeBox taxonomy schemas, TypeCompiler JSON loader, and zero runtime dependencies**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-21T22:46:58Z
- **Completed:** 2026-02-21T22:54:47Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Package scaffolded with pnpm, TypeScript 5.9, tsdown 0.20, vitest 4.0, TypeBox 0.34 -- all in devDependencies
- TypeBox schemas define TaxonomyVersion, TaxonomyAction, ProviderType, AtomicAction, GovernedBy, ProviderTypeCategory
- TypeCompiler-validated JSON loader ready for taxonomy data file (data/taxonomy/v1.0.0.json)
- All types exported via Static inference through the module chain
- Maximum TypeScript strictness: strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, noPropertyAccessFromIndexSignature

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize pnpm package with TypeScript, tsdown, vitest, and TypeBox** - `57efe31` (feat)
2. **Task 2: Define TypeBox taxonomy schemas and JSON loader with TypeCompiler validation** - `449cbc1` (feat)

## Files Created/Modified
- `package.json` - Package manifest with @careagent/axon, zero runtime deps, build/test scripts
- `tsconfig.json` - Maximum strictness TypeScript config extending @tsconfig/node22
- `tsdown.config.ts` - ESM library build config with TypeBox inlined, .js/.d.ts output
- `vitest.config.ts` - Test config with v8 coverage at 80% thresholds, passWithNoTests
- `src/index.ts` - Package entry point re-exporting taxonomy and types
- `src/taxonomy/index.ts` - Taxonomy module barrel re-exporting schemas and loader
- `src/taxonomy/schemas.ts` - TypeBox schema definitions with TypeCompiler validator
- `src/taxonomy/loader.ts` - JSON loader with TypeCompiler validation and error reporting
- `src/types/index.ts` - TypeScript types derived from TypeBox schemas via Static
- `data/taxonomy/.gitkeep` - Placeholder for taxonomy data directory
- `.gitignore` - Ignore node_modules, dist, coverage, tsbuildinfo
- `pnpm-workspace.yaml` - esbuild build permission for pnpm
- `pnpm-lock.yaml` - Lockfile for reproducible installs

## Decisions Made
- **Removed isolatedDeclarations:** TypeBox's `Type.*` functions return complex generic types that cannot be annotated explicitly, which is fundamentally incompatible with `isolatedDeclarations`. All other strict flags retained. tsdown handles DTS generation via rolldown-plugin-dts which runs full tsc inference.
- **fixedExtension: false in tsdown:** Produces `.js`/`.d.ts` instead of `.mjs`/`.d.mts`, matching the `"type": "module"` ESM semantics and package.json export paths.
- **inlineOnly config:** Explicitly declares `@sinclair/typebox` as an intentionally bundled devDependency to suppress tsdown warnings.
- **passWithNoTests in vitest:** Vitest v4 exits with code 1 when no test files exist; passWithNoTests ensures `pnpm test` passes at this scaffold stage.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added .gitignore for node_modules and dist**
- **Found during:** Task 1
- **Issue:** No .gitignore existed; node_modules and dist would be committed
- **Fix:** Created .gitignore with node_modules/, dist/, coverage/, *.tsbuildinfo
- **Files modified:** .gitignore
- **Verification:** git status shows clean staging
- **Committed in:** 57efe31 (Task 1 commit)

**2. [Rule 3 - Blocking] Added passWithNoTests to vitest config**
- **Found during:** Task 1
- **Issue:** Vitest v4 exits with code 1 when no test files are found; plan requires "pnpm test passes"
- **Fix:** Added `passWithNoTests: true` to vitest.config.ts
- **Files modified:** vitest.config.ts
- **Verification:** pnpm test exits with code 0
- **Committed in:** 57efe31 (Task 1 commit)

**3. [Rule 3 - Blocking] Configured fixedExtension: false for .js output**
- **Found during:** Task 1
- **Issue:** tsdown defaults to .mjs/.d.mts for ESM on node platform; package.json expects .js/.d.ts
- **Fix:** Set `fixedExtension: false` in tsdown.config.ts
- **Files modified:** tsdown.config.ts
- **Verification:** Build produces dist/index.js and dist/index.d.ts
- **Committed in:** 57efe31 (Task 1 commit)

**4. [Rule 3 - Blocking] Added @types/node for node:module types**
- **Found during:** Task 2
- **Issue:** loader.ts imports from 'node:module' and uses import.meta.url; @tsconfig/node22 does not include Node.js types
- **Fix:** Added @types/node as devDependency
- **Files modified:** package.json, pnpm-lock.yaml
- **Verification:** tsc --noEmit passes
- **Committed in:** 449cbc1 (Task 2 commit)

**5. [Rule 1 - Bug] Removed isolatedDeclarations from tsconfig**
- **Found during:** Task 2
- **Issue:** TypeBox's Type.* functions return complex inferred generic types; isolatedDeclarations requires explicit type annotations on all exports, which is incompatible with TypeBox's design pattern
- **Fix:** Removed isolatedDeclarations: true from tsconfig.json; all other strict flags retained
- **Files modified:** tsconfig.json
- **Verification:** tsc --noEmit passes; pnpm build produces correct .d.ts
- **Committed in:** 449cbc1 (Task 2 commit)

---

**Total deviations:** 5 auto-fixed (4 blocking, 1 bug)
**Impact on plan:** All auto-fixes necessary for correctness. The isolatedDeclarations removal is the only structural change -- TypeBox fundamentally requires type inference for schema definitions, and this is the standard pattern when using TypeBox with strict TypeScript. No scope creep.

## Issues Encountered
- esbuild build scripts needed manual approval via pnpm-workspace.yaml (pnpm v10 interactive `approve-builds` not available in non-interactive mode)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Package scaffold complete and verified (build, test, import all pass)
- TypeBox schemas ready for Plan 02 taxonomy data authoring (v1.0.0.json)
- Loader function ready to validate taxonomy JSON once data file is created
- All types exported for Plan 03 AxonTaxonomy API implementation

---
*Phase: 01-package-foundation-and-clinical-action-taxonomy*
*Completed: 2026-02-21*

## Self-Check: PASSED

All 12 created files verified on disk. Both task commits (57efe31, 449cbc1) verified in git log.
