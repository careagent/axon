# Phase 1: Package Foundation and Clinical Action Taxonomy - Research

**Researched:** 2026-02-21
**Domain:** TypeScript library scaffolding, tsdown build tooling, TypeBox schema validation, vitest testing, JSON versioned data design
**Confidence:** HIGH (stack verified against official docs and Context7-equivalent sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Taxonomy hierarchy design:**
- Seven atomic action categories (chart, order, charge, perform, interpret, educate, coordinate) are fixed for v1 — no new top-level categories
- Hierarchy depth is Claude's discretion — pick what fits the Physician action set (could be 2 or 3 levels deep where clinically meaningful)
- MD and DO are treated as a single 'physician' type with identical action sets; credential distinction lives in the registry (Phase 3)
- Common cross-type actions are a fixed curated set — explicitly defined, not derived per-category
- Taxonomy represents capability eligibility by provider type, not assigned scope for an individual provider. Who assigns/selects actions (self, institution, governing body) is a policy question for onboarding (Phase 2), not the taxonomy
- Each action includes a `governed_by` field indicating which authorities govern it (array — an action can be governed by multiple bodies, e.g., state board + DEA for prescribing)
- Every leaf action has an ID + human-readable description — self-documenting for consuming UIs

**Taxonomy data shape:**
- Single taxonomy file (`data/taxonomy/v1.0.0.json`) with a version field inside — single version runtime, not multi-version
- CANS.md stamps `scope.taxonomy_version` as a string for the version active at onboarding time
- Provider types live inside the taxonomy JSON — one self-contained file with actions, provider types, and mappings
- Provider types are grouped under categories (medical, dental, behavioral health, allied health, etc.) — structured for UI grouping
- Common actions are explicitly listed per type — no implicit inheritance; every type's action list is complete and self-contained (redundant but explicit)

**API surface design:**
- Full introspection: `getProviderTypes()`, `getProviderTypesByCategory()`, `getType(id)` in addition to the required `getActionsForType()` and `validateAction()`
- `getActionsForType()` returns action IDs only (string[]) — keeps CANS.md lightweight. Full action objects available via separate method (e.g., `getAction(id)`)
- API style and version access pattern are Claude's discretion (static class vs instantiated, property vs method)

**Package tooling choices:**
- Domain-organized source: `src/taxonomy/`, `src/types/`, `src/index.ts` — scales for Phase 2+ modules
- Maximum TypeScript strictness: `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- TypeBox introduced in Phase 1 for taxonomy type definitions — establishes the runtime-validatable pattern early
- Test scope is Claude's discretion (data integrity tests, API tests, or both)

### Claude's Discretion

- Taxonomy hierarchy depth (2 or 3 levels, based on clinical fit)
- AxonTaxonomy API style (static class vs instantiated class)
- Version access (property vs method)
- Test strategy scope (data validation + API, or API-only)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AXON-01 | Package scaffold with pnpm, TypeScript, tsdown build, vitest testing, and zero runtime npm dependencies | tsdown `noExternal: ['@sinclair/typebox']` or TypeBox as devDependency with inline bundling; pnpm init pattern; vitest 4.0 config |
| TAXO-01 | Hierarchical action vocabulary with dot-notation identifiers under seven atomic actions | JSON data design pattern with `id`, `atomic_action`, `parent` fields; dot-notation as string convention |
| TAXO-02 | Every action maps to one or more of the 49 provider types via `applicable_types` | `applicable_types: string[]` field on each action in the JSON; AxonTaxonomy builds inverted index at load time |
| TAXO-03 | Taxonomy is versioned with semver; CANS.md records which taxonomy version was used (`scope.taxonomy_version`) | `version` field in taxonomy JSON root; `getVersion()` method returns it; file named `v1.0.0.json` |
| TAXO-04 | `AxonTaxonomy.getActionsForType()` returns all valid actions for a given provider type | Inverted index built at construction time: `Map<providerTypeId, string[]>` of action IDs |
| TAXO-05 | `AxonTaxonomy.validateAction()` confirms an action ID exists in the current taxonomy version | `Set<string>` of all action IDs for O(1) lookup |
| TAXO-06 | Full Physician (MD, DO) action set in v1; common cross-type actions for all 49 types; type-specific actions for others are v2 | Taxonomy JSON includes all physician actions + shared cross-type set; non-physician type-specific actions marked as pending |
| TAXO-07 | Taxonomy data is a versioned JSON data file (`data/taxonomy/v1.0.0.json`), not hardcoded enums | JSON loaded at module init via `createRequire` or `import()` with `assert { type: 'json' }` (Node.js 22); TypeBox validates at load |
</phase_requirements>

---

## Summary

Phase 1 establishes the `@careagent/axon` package scaffold and implements the clinical action taxonomy — the controlled vocabulary that every CANS.md `scope.permitted_actions` field references. The technical work divides cleanly into two tracks: (1) package infrastructure (pnpm/TypeScript/tsdown/vitest wiring) and (2) taxonomy data + API.

The standard stack is well-established and all components have been verified as current. The most important decision point for planning is the TypeBox bundling strategy: TypeBox must either be in `devDependencies` and bundled inline by tsdown (using `noExternal: ['@sinclair/typebox']`), or TypeBox's validation code must be used only at build/test time, with the runtime output having zero npm dependencies. The PRD and CONTEXT.md both mandate zero runtime deps, which means TypeBox validation code gets bundled into the dist. This is the correct approach: tsdown's `noExternal` option explicitly handles this.

The taxonomy JSON design is the critical domain decision for this phase. The data shape must accommodate: (a) actions with dot-notation IDs, (b) per-type `applicable_types` arrays for TAXO-02, (c) provider type definitions grouped by category, (d) a `governed_by` field per action, (e) semver version string at the root. The AxonTaxonomy class loads this JSON once and builds two in-memory indexes: an action ID Set for O(1) `validateAction()`, and an inverted Map from providerTypeId → string[] for O(1) `getActionsForType()`.

**Primary recommendation:** Scaffold with pnpm + TypeScript 5.7 + tsdown 0.20 (noExternal for TypeBox) + vitest 4.0 + @vitest/coverage-v8. Load `v1.0.0.json` at module initialization, validate with TypeBox TypeCompiler, build indexes in constructor. Use a static class for `AxonTaxonomy` since there is only one taxonomy version at runtime.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ~5.7 | Static typing and compilation | Project mandate; tsdown generates .d.ts natively |
| tsdown | ~0.20 | Library bundler (replaces tsup) | Project mandate; built on Rolldown/Rust, ESM-first, handles noExternal for zero-deps output |
| vitest | ~4.0 | Test runner | Project mandate; Vitest 4.0 released Oct 2025, stable, Node.js unit testing focus |
| @sinclair/typebox | ~0.34 | Runtime schema validation + TypeScript type inference | Project mandate; zero runtime deps itself; TypeCompiler gives fast compiled validators; version 0.34.41 current |
| pnpm | latest 9.x | Package manager | Project mandate |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitest/coverage-v8 | ~4.0 | V8 coverage provider for vitest | Required to get coverage reports and enforce 80% threshold |
| @tsconfig/node22 | latest | Base tsconfig for Node.js 22 | Provides target, module, lib defaults aligned with Node 22 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tsdown | tsup | tsup is older, CJS-first, not esm-first by default; tsdown is the void(0) successor with Rolldown performance |
| tsdown | tsc only | tsc alone doesn't bundle inline deps; harder to achieve zero-runtime-dep output |
| @sinclair/typebox | zod | Zod has runtime deps, larger bundle; TypeBox is pure JSON Schema, zero deps, faster compiled validation |
| @vitest/coverage-v8 | @vitest/coverage-istanbul | v8 is built into Node.js, no extra native binary; istanbul is more accurate but adds complexity |

**Installation:**
```bash
pnpm init
pnpm add -D typescript tsdown vitest @vitest/coverage-v8 @sinclair/typebox @tsconfig/node22
```

Note: `@sinclair/typebox` goes in `devDependencies` because tsdown will bundle it inline. The output dist has zero runtime npm deps.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── taxonomy/
│   ├── index.ts          # re-exports AxonTaxonomy
│   ├── taxonomy.ts       # AxonTaxonomy class
│   ├── schemas.ts        # TypeBox schemas for TaxonomyVersion, TaxonomyAction, ProviderType
│   └── loader.ts         # JSON load + TypeBox validation at init
├── types/
│   └── index.ts          # Shared TypeScript interfaces (re-exported from TypeBox schemas)
└── index.ts              # Package entry point

data/
└── taxonomy/
    └── v1.0.0.json       # The single versioned taxonomy data file

test/
├── taxonomy.test.ts      # API tests (getActionsForType, validateAction, etc.)
└── taxonomy-data.test.ts # Data integrity tests (every action maps to ≥1 type, etc.)
```

### Pattern 1: TypeBox Schema Definition for Taxonomy Data

**What:** Define TypeBox schemas for the taxonomy JSON shape. Use `Static<typeof Schema>` to get TypeScript types from the schemas. This establishes the single source of truth for both runtime validation and TypeScript types.

**When to use:** Wherever a type is also validated at runtime — the taxonomy JSON load, future questionnaire schemas, registry entries.

```typescript
// Source: @sinclair/typebox github.com/sinclairzx81/typebox
import { Type, Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

const AtomicActionSchema = Type.Union([
  Type.Literal('chart'),
  Type.Literal('order'),
  Type.Literal('charge'),
  Type.Literal('perform'),
  Type.Literal('interpret'),
  Type.Literal('educate'),
  Type.Literal('coordinate'),
])

const GovernedBySchema = Type.Union([
  Type.Literal('state_board'),
  Type.Literal('institution'),
  Type.Literal('specialty_board'),
  Type.Literal('federal'),
  Type.Literal('professional_association'),
])

const TaxonomyActionSchema = Type.Object({
  id: Type.String(),                         // e.g., "chart.progress_note"
  atomic_action: AtomicActionSchema,
  display_name: Type.String(),
  description: Type.String(),
  applicable_types: Type.Array(Type.String()),  // IDs of the 49 provider types
  governed_by: Type.Array(GovernedBySchema),
  parent: Type.Optional(Type.String()),        // parent action ID (if nested)
  added_in: Type.String(),                     // semver string
  deprecated_in: Type.Optional(Type.String()),
})

const ProviderTypeCategorySchema = Type.Union([
  Type.Literal('medical'),
  Type.Literal('dental'),
  Type.Literal('behavioral_health'),
  Type.Literal('allied_health'),
  Type.Literal('emergency'),
  Type.Literal('administrative'),
])

const ProviderTypeSchema = Type.Object({
  id: Type.String(),                     // e.g., "physician"
  display_name: Type.String(),
  category: ProviderTypeCategorySchema,
  member_roles: Type.Array(Type.String()),  // e.g., ["MD", "DO"]
})

const TaxonomyVersionSchema = Type.Object({
  version: Type.String(),                   // semver e.g., "1.0.0"
  effective_date: Type.String(),            // ISO 8601
  description: Type.String(),
  provider_types: Type.Array(ProviderTypeSchema),
  actions: Type.Array(TaxonomyActionSchema),
})

export type TaxonomyVersion = Static<typeof TaxonomyVersionSchema>
export type TaxonomyAction = Static<typeof TaxonomyActionSchema>
export type ProviderType = Static<typeof ProviderTypeSchema>

// Compiled validator for fast load-time validation
export const TaxonomyVersionValidator = TypeCompiler.Compile(TaxonomyVersionSchema)
```

### Pattern 2: JSON Data File Loading with Node.js 22

**What:** Load the versioned taxonomy JSON file using Node.js `createRequire` or `import()`. Validate at load time with TypeBox. Build indexes for O(1) lookups.

**When to use:** Any time a JSON data file must be loaded, validated, and indexed at module initialization.

```typescript
// Source: Node.js 22 docs; tsdown bundling resolves JSON imports
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

function loadTaxonomy(): TaxonomyVersion {
  const data = require('../../../data/taxonomy/v1.0.0.json') as unknown
  if (!TaxonomyVersionValidator.Check(data)) {
    const errors = [...TaxonomyVersionValidator.Errors(data)]
    throw new Error(`Taxonomy data invalid: ${errors[0]?.message ?? 'unknown error'}`)
  }
  return data
}
```

**Note on JSON imports:** With `"module": "nodenext"` in tsconfig, use `createRequire` for JSON. Alternatively, tsdown can bundle the JSON file inline. The `createRequire` approach is more portable and works without bundler JSON plugin config.

**Alternative — static import with assert (if tsdown handles it):**
```typescript
import taxonomyData from '../../data/taxonomy/v1.0.0.json' assert { type: 'json' }
```
JSON import assertions work in Node.js 22 but require `"resolveJsonModule": true` in tsconfig and tsdown to include the JSON in the bundle. The `createRequire` pattern is safer for bundler compatibility.

### Pattern 3: AxonTaxonomy Static Class with Lazy Initialization

**What:** A static class that loads and indexes the taxonomy once. Recommended over instantiated class because there is exactly one taxonomy version at runtime — no need for instances.

**When to use:** Singleton data service with no per-instance state.

```typescript
// Source: project convention (static class pattern)
export class AxonTaxonomy {
  private static _data: TaxonomyVersion | undefined
  private static _actionIndex: Map<string, TaxonomyAction> | undefined
  private static _typeIndex: Map<string, string[]> | undefined
  private static _actionSet: Set<string> | undefined

  private static get data(): TaxonomyVersion {
    if (!AxonTaxonomy._data) {
      AxonTaxonomy._data = loadTaxonomy()
      AxonTaxonomy._buildIndexes()
    }
    return AxonTaxonomy._data
  }

  private static _buildIndexes(): void {
    const data = AxonTaxonomy._data!
    AxonTaxonomy._actionIndex = new Map(data.actions.map(a => [a.id, a]))
    AxonTaxonomy._actionSet = new Set(data.actions.map(a => a.id))

    // Build inverted index: providerTypeId → actionId[]
    const typeIndex = new Map<string, string[]>()
    for (const action of data.actions) {
      for (const typeId of action.applicable_types) {
        const existing = typeIndex.get(typeId) ?? []
        existing.push(action.id)
        typeIndex.set(typeId, existing)
      }
    }
    AxonTaxonomy._typeIndex = typeIndex
  }

  static getVersion(): string {
    return AxonTaxonomy.data.version
  }

  static getActionsForType(providerTypeId: string): string[] {
    void AxonTaxonomy.data // trigger init
    return AxonTaxonomy._typeIndex?.get(providerTypeId) ?? []
  }

  static validateAction(actionId: string): boolean {
    void AxonTaxonomy.data // trigger init
    return AxonTaxonomy._actionSet?.has(actionId) ?? false
  }

  static getAction(actionId: string): TaxonomyAction | undefined {
    void AxonTaxonomy.data // trigger init
    return AxonTaxonomy._actionIndex?.get(actionId)
  }

  static getProviderTypes(): ProviderType[] {
    return AxonTaxonomy.data.provider_types
  }

  static getProviderTypesByCategory(category: string): ProviderType[] {
    return AxonTaxonomy.data.provider_types.filter(t => t.category === category)
  }

  static getType(id: string): ProviderType | undefined {
    return AxonTaxonomy.data.provider_types.find(t => t.id === id)
  }
}
```

### Pattern 4: tsdown Configuration for Zero Runtime Deps

**What:** Bundle TypeBox inline so the output dist has zero runtime npm dependencies.

**When to use:** Any library with a "zero runtime deps" constraint that uses devDependency libraries internally.

```typescript
// tsdown.config.ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['es'],
  platform: 'node',
  dts: true,
  clean: true,
  // Bundle TypeBox inline — it's a devDep but its code is included in the output.
  // tsdown's default: devDeps are bundled if imported; deps/peerDeps are external.
  // Since @sinclair/typebox is in devDependencies, it will be bundled automatically.
  // No noExternal needed IF typebox is in devDependencies (not dependencies).
})
```

**Key insight:** tsdown's default behavior bundles devDependencies when imported. If `@sinclair/typebox` is in `devDependencies` (not `dependencies`), it gets bundled inline automatically — achieving zero runtime npm deps without any special config. Verify the final output `package.json` has no `dependencies` field (only `devDependencies`).

If TypeBox is accidentally placed in `dependencies`, use:
```typescript
noExternal: ['@sinclair/typebox']  // force inline bundling
```

### Pattern 5: Vitest Configuration with 80% Coverage

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
```

### Pattern 6: tsconfig.json for Maximum Strictness

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@tsconfig/node22/tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "resolveJsonModule": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "isolatedDeclarations": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

**Note:** `isolatedDeclarations: true` is compatible with tsdown's fast type generation. It requires explicit return type annotations on exported functions — plan for this in API implementations.

### Anti-Patterns to Avoid

- **Hardcoded action strings as TypeScript enums or const objects:** Defeats the "taxonomy is data, not code" requirement (TAXO-07). All action definitions belong in `v1.0.0.json`.
- **Implicit inheritance of common actions:** CONTEXT.md explicitly states every type's action list must be complete and self-contained. Build the inverted index from `applicable_types` arrays — never assume a type inherits actions it's not explicitly listed for.
- **Lazy validation skipping:** Always validate the JSON at load time with TypeBox TypeCompiler. Silent corruption of taxonomy data would break CANS.md generation in consuming packages.
- **mutable static class state:** The indexes should be built once and never mutated. TypeBox can validate at load; after that, throw if invalid rather than silently returning empty arrays.
- **Mixing provider type definitions with action definitions in separate files:** Keep all taxonomy data in the single `v1.0.0.json` file as locked in CONTEXT.md.
- **`noExternal: () => true` (bundle everything):** Too aggressive. TypeBox in devDependencies is already bundled by default. `skipNodeModulesBundle` would break it — don't use that flag.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Runtime schema validation of JSON data | Custom validation functions checking each field manually | TypeBox TypeCompiler.Compile() | TypeCompiler generates JIT-compiled validators; handles nested objects, unions, optional fields, arrays correctly |
| TypeScript type inference from schema | Separate interface declarations duplicating the schema | `Static<typeof Schema>` from TypeBox | Single source of truth; types stay in sync with validators automatically |
| Library bundling with inline deps | Custom rollup/webpack configuration | tsdown with default devDep bundling | tsdown handles ESM output, .d.ts generation, tree-shaking, and dep bundling in one tool |
| Test runner and coverage | Jest + nyc or custom setup | vitest + @vitest/coverage-v8 | Native ESM support, fast, same ecosystem as tsdown (void(0)) |
| JSON load path resolution | `__dirname` hacks, `process.cwd()` assumptions | `createRequire(import.meta.url)` | ESM-safe, works in both bundled and unbundled contexts |

**Key insight:** TypeBox is both a type system and a validation library. Writing separate TypeScript interfaces AND separate validation logic doubles the maintenance surface and always drifts apart. The TypeBox `Static<typeof Schema>` + `TypeCompiler.Compile(Schema)` pattern is the single-source-of-truth approach this project needs.

---

## Common Pitfalls

### Pitfall 1: TypeBox in `dependencies` instead of `devDependencies`

**What goes wrong:** Package ships with `@sinclair/typebox` as a runtime npm dependency, violating the zero-deps constraint (AXON-01). Consumers must install TypeBox.

**Why it happens:** Developer adds TypeBox via `pnpm add @sinclair/typebox` (without `-D`) because it's used in source files.

**How to avoid:** Always `pnpm add -D @sinclair/typebox`. tsdown bundles devDeps imported in source. Verify the output: after `pnpm build`, run `node -e "require('./dist/index.js')"` and confirm no npm module resolution needed. The `package.json` should have no `dependencies` field (or an empty one).

**Warning signs:** `package.json` has `"dependencies": { "@sinclair/typebox": "..." }` after install.

### Pitfall 2: `noUncheckedIndexedAccess` Breaking Index Lookups

**What goes wrong:** Code like `const action = actionMap[id]` returns `TaxonomyAction | undefined` with `noUncheckedIndexedAccess`. This breaks callers expecting `TaxonomyAction`.

**Why it happens:** TypeScript plain object index access (`obj[key]`) doesn't account for missing keys without this flag. The flag makes undefined explicit.

**How to avoid:** Use `Map.get()` which already returns `T | undefined`. For the action index, always use `Map<string, TaxonomyAction>` with `.get()` — never plain object indexing. Handle the undefined case explicitly in all lookup methods.

**Warning signs:** TypeScript errors on `_actionIndex[id]` after enabling the flag; compiler saying result might be undefined.

### Pitfall 3: `exactOptionalPropertyTypes` Breaking Optional Field Assignment

**What goes wrong:** Code that assigns `undefined` to optional properties (e.g., `action.deprecated_in = undefined`) fails to compile. With `exactOptionalPropertyTypes`, optional `field?: T` does NOT accept `undefined` — it means "property may be absent," not "property may be undefined."

**Why it happens:** Common JavaScript pattern of setting optional fields to `undefined` to "clear" them.

**How to avoid:** When constructing objects with optional fields, simply omit the property rather than setting it to `undefined`. Use `Partial<T>` carefully with this flag. TypeBox's `Type.Optional()` correctly generates optional properties in the JSON schema.

**Warning signs:** TypeScript error "Type 'undefined' is not assignable to type 'string'" on a property typed as `string | undefined` but declared as `optional?: string`.

### Pitfall 4: `isolatedDeclarations` Requiring Return Type Annotations

**What goes wrong:** TypeScript errors on exported functions that lack explicit return types when `isolatedDeclarations: true` is enabled. tsdown uses this mode for fast type generation.

**Why it happens:** `isolatedDeclarations` requires each exported function's return type to be inferable from the declaration alone (no cross-file inference).

**How to avoid:** Annotate all exported function and method return types explicitly. For the AxonTaxonomy static class, this means: `static getActionsForType(id: string): string[]`, `static validateAction(id: string): boolean`, etc.

**Warning signs:** `tsc` errors about "Return type annotation is required" on exported functions.

### Pitfall 5: JSON Import Path Resolution in ESM + bundled dist

**What goes wrong:** Relative paths to `data/taxonomy/v1.0.0.json` break when the code is bundled into `dist/` — the relative path `../../data/taxonomy/v1.0.0.json` no longer resolves correctly.

**Why it happens:** tsdown changes the file's location in the bundle; relative paths from source don't map to relative paths from dist.

**How to avoid:** Two options:
1. Use `createRequire(import.meta.url)` from the source file location — tsdown will inline the JSON content when bundling.
2. Configure tsdown to include the JSON file as an asset and use `new URL('../data/taxonomy/v1.0.0.json', import.meta.url)` pattern.

The safest approach: let tsdown bundle/inline the JSON. Since `data/taxonomy/v1.0.0.json` is referenced by source code, tsdown will include it in the bundle output automatically when using `createRequire` or ESM `import`. Test with `pnpm build && node -e "import('./dist/index.js').then(m => console.log(m.AxonTaxonomy.getVersion()))"`.

**Warning signs:** `MODULE_NOT_FOUND` errors or `ENOENT` when running the built dist.

### Pitfall 6: `applicable_types` Array vs. Inverted Index Design

**What goes wrong:** Building `getActionsForType()` by scanning all actions and filtering each time (O(n) on every call). For 49 types × potentially hundreds of actions, this is called frequently during onboarding.

**Why it happens:** Intuitive "filter actions array" implementation.

**How to avoid:** Build the inverted index once at initialization: `Map<providerTypeId, string[]>`. This makes `getActionsForType()` O(1).

**Warning signs:** `getActionsForType` implementation contains `Array.filter()` called on every invocation rather than index lookup.

### Pitfall 7: Taxonomy Action Count vs. Completeness for TAXO-02/06

**What goes wrong:** Tests pass but `getActionsForType('physician')` returns far fewer actions than expected because common cross-type actions weren't included with the physician type, or vice versa.

**Why it happens:** CONTEXT.md mandates "no implicit inheritance" — every type must be explicitly listed in each action's `applicable_types`. Easy to forget to add 'physician' to every common action.

**How to avoid:** Write a data integrity test that:
1. Loads the taxonomy
2. Asserts that `physician` type has actions under all 7 atomic categories (chart, order, charge, perform, interpret, educate, coordinate)
3. Asserts that every one of the 49 provider types has at least the common cross-type actions
4. Asserts that every action has `applicable_types.length >= 1`

This is exactly what the success criterion "every one of the 49 provider types has at least the common cross-type actions available" requires.

---

## Code Examples

Verified patterns from official sources and official documentation:

### TypeBox Schema with Union Discriminants
```typescript
// Source: github.com/sinclairzx81/typebox README (0.34.x)
import { Type, Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

// Union of literal strings — correct pattern for controlled vocabularies
const AtomicActionSchema = Type.Union([
  Type.Literal('chart'),
  Type.Literal('order'),
  Type.Literal('charge'),
  Type.Literal('perform'),
  Type.Literal('interpret'),
  Type.Literal('educate'),
  Type.Literal('coordinate'),
])
export type AtomicAction = Static<typeof AtomicActionSchema>
// Result: type AtomicAction = 'chart' | 'order' | 'charge' | 'perform' | 'interpret' | 'educate' | 'coordinate'
```

### TypeCompiler Validation Pattern
```typescript
// Source: betterstack.com/community/guides/scaling-nodejs/typebox-explained/
const Validator = TypeCompiler.Compile(TaxonomyVersionSchema)

function loadAndValidate(rawJson: unknown): TaxonomyVersion {
  if (!Validator.Check(rawJson)) {
    const errors = [...Validator.Errors(rawJson)]
    throw new Error(
      `Taxonomy JSON schema validation failed: ${errors.map(e => `${e.path}: ${e.message}`).join('; ')}`
    )
  }
  return rawJson
}
```

### tsdown.config.ts — Complete Example
```typescript
// Source: tsdown.dev/options/dependencies, tsdown.dev/guide/getting-started
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['es'],
  platform: 'node',
  dts: true,
  clean: true,
  sourcemap: false,
  // @sinclair/typebox is in devDependencies → bundled inline by default
  // Result: dist/index.js has zero runtime npm dependencies
})
```

### vitest.config.ts — Complete Example
```typescript
// Source: vitest.dev/config/coverage
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/types/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      reporter: ['text', 'html'],
    },
  },
})
```

### package.json — Library Package Shape
```json
{
  "name": "@careagent/axon",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist", "data"],
  "scripts": {
    "build": "tsdown",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  },
  "engines": {
    "node": ">=22.12.0"
  },
  "devDependencies": {
    "@sinclair/typebox": "~0.34",
    "@tsconfig/node22": "latest",
    "@vitest/coverage-v8": "~4.0",
    "tsdown": "~0.20",
    "typescript": "~5.7",
    "vitest": "~4.0"
  }
}
```

### Taxonomy JSON Data Shape — Skeleton
```json
{
  "version": "1.0.0",
  "effective_date": "2026-02-21",
  "description": "Axon clinical action taxonomy v1.0.0 — full Physician actions + common cross-type actions",
  "provider_types": [
    {
      "id": "physician",
      "display_name": "Physician",
      "category": "medical",
      "member_roles": ["MD", "DO"]
    },
    {
      "id": "advanced_practice_provider",
      "display_name": "Advanced Practice Provider",
      "category": "medical",
      "member_roles": ["NP", "PA", "CRNA", "CNM", "CNS"]
    }
  ],
  "actions": [
    {
      "id": "chart.progress_note",
      "atomic_action": "chart",
      "display_name": "Progress Note",
      "description": "Document a patient's clinical progress, current status, and plan updates",
      "applicable_types": ["physician", "advanced_practice_provider", "nursing"],
      "governed_by": ["state_board", "institution"],
      "added_in": "1.0.0"
    },
    {
      "id": "order.medication",
      "atomic_action": "order",
      "display_name": "Medication Order",
      "description": "Prescribe or order medication for a patient",
      "applicable_types": ["physician", "advanced_practice_provider"],
      "governed_by": ["state_board", "federal"],
      "added_in": "1.0.0"
    }
  ]
}
```

### Data Integrity Test Pattern
```typescript
// test/taxonomy-data.test.ts
import { describe, it, expect } from 'vitest'
import { AxonTaxonomy } from '../src/taxonomy/taxonomy.js'

const ATOMIC_ACTIONS = ['chart', 'order', 'charge', 'perform', 'interpret', 'educate', 'coordinate']
const ALL_49_TYPE_IDS = [
  'physician', 'advanced_practice_provider', 'nursing', 'nursing_support',
  'pharmacy', 'dental', 'behavioral_mental_health', /* ... all 49 ... */
]

describe('taxonomy data integrity', () => {
  it('has actions under all 7 atomic categories for physician type', () => {
    const actions = AxonTaxonomy.getActionsForType('physician')
    const coveredCategories = new Set(actions.map(id => id.split('.')[0]))
    for (const category of ATOMIC_ACTIONS) {
      expect(coveredCategories.has(category), `Missing actions under '${category}' for physician`).toBe(true)
    }
  })

  it('every action maps to at least one provider type', () => {
    const allActions = AxonTaxonomy.getActionsForType('physician') // get all via scan
    // Better: expose getAllActions() or iterate via internal data
  })

  it('every provider type has at least the common cross-type actions', () => {
    for (const typeId of ALL_49_TYPE_IDS) {
      const actions = AxonTaxonomy.getActionsForType(typeId)
      expect(actions.length, `Provider type '${typeId}' has no actions`).toBeGreaterThan(0)
    }
  })

  it('validateAction returns true for known IDs and false for unknown', () => {
    expect(AxonTaxonomy.validateAction('chart.progress_note')).toBe(true)
    expect(AxonTaxonomy.validateAction('chart.made_up_action')).toBe(false)
    expect(AxonTaxonomy.validateAction('')).toBe(false)
  })
})
```

---

## Taxonomy Content Decisions (for the Planner)

This section captures the domain decisions needed to actually build the `v1.0.0.json` file. These are not tooling questions — they're clinical taxonomy design questions the planner must account for as tasks.

### Hierarchy Depth Recommendation

**Recommendation: 2 levels for most actions, 3 levels for high-volume categories (chart, perform).**

The PRD examples show both depths: `chart.progress_note` (2 levels) and `perform.craniotomy` (2 levels). A 3-level example would be `perform.surgical.craniotomy`. The CONTEXT.md says depth is Claude's discretion.

**Rationale for mostly 2 levels:** The dot-notation ID doubles as the CANS scope token. 3-level IDs like `chart.clinical.progress_note` add verbosity to `scope.permitted_actions` lists without clinical benefit for most actions. Reserve 3 levels for subspecialty-specific actions where a middle grouping (e.g., `perform.surgical.*`) aids UI grouping and questionnaire filtering.

**Practical guidance for planner:** Design the Physician action set first. If natural groupings emerge under a category (e.g., many surgical procedures), use 3 levels for that subset. Otherwise keep 2 levels.

### Common Cross-Type Actions

CONTEXT.md mandates a "fixed curated set" of common actions explicitly listed per type. Based on the PRD examples, the common cross-type actions should include at minimum:

| Category | Common Actions |
|----------|----------------|
| chart | `chart.progress_note`, `chart.communication` |
| educate | `educate.patient_education`, `educate.discharge_instructions` |
| coordinate | `coordinate.referral`, `coordinate.care_transition` |

Every one of the 49 provider types should have these common actions in their `applicable_types`. Physician-specific and specialty-specific actions are additional.

### Physician Action Set Scope (TAXO-06)

The full Physician action set needs to cover:
- **chart:** progress notes, H&P, consultation notes, operative notes, discharge summaries, procedure notes, referral letters
- **order:** medications (incl. controlled substances), labs, imaging, procedures, referrals, diet, activity restrictions, home health
- **charge:** E&M coding, procedure coding, modifier selection, ICD coding, CPT selection
- **perform:** physical exam, minor procedures (injection, laceration repair, biopsy), major surgical procedures (by subspecialty), critical care procedures
- **interpret:** imaging studies, lab results, EKG/ECG, pathology, electrodiagnostics, genetic tests
- **educate:** patient education, medication counseling, informed consent, surgical risks/benefits
- **coordinate:** referrals, care transitions, insurance auth, specialist consultation, social services, case management

### The 49 Provider Types

All 49 types are enumerated in PRD.md section 2.4.3. The taxonomy must include all 49 as `provider_types` entries with their `id`, `display_name`, `category`, and `member_roles`. The type-specific action sets (non-physician) will have only common cross-type actions for v1; full type-specific action sets are TAXO-08 (v2).

**Provider category groupings** (matching CONTEXT.md "grouped under categories" requirement):
- `medical`: physician, advanced_practice_provider, nursing, nursing_support, pharmacy
- `dental`: dental
- `behavioral_health`: behavioral_mental_health
- `allied_health`: physical_rehabilitation, occupational_therapy, speech_language, respiratory, audiology, vision_optometry, nutrition_dietetics, podiatry, chiropractic, midwifery, genetic_counseling, orthotics_prosthetics, recreational_therapy, creative_arts_therapy, acupuncture_traditional_medicine, massage_bodywork, athletic_training, sleep_medicine, wound_care, lactation, vision_rehabilitation, deaf_hard_of_hearing, kinesiotherapy, child_life
- `diagnostics`: radiology_imaging, laboratory, cardiac_vascular_diagnostics, neurodiagnostics, dialysis_nephrology, medical_physics, ophthalmic
- `emergency`: emergency_prehospital
- `surgical`: surgical, anesthesia_technology
- `administrative`: sterile_processing, health_information_coding, community_public_health, home_health_hospice, patient_navigation, clinical_research, organ_tissue, rehabilitation_engineering

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tsup for library bundling | tsdown (Rolldown-based) | 2024-2025 | Faster builds, better ESM-first output, native --isolated-declarations support |
| tsc --watch + separate bundler | tsdown single command | 2024 | Unified build + type gen in one tool |
| jest + babel for TS testing | vitest native ESM | 2023-2024 | No transpilation needed, faster, native ESM |
| Vitest 3.x | Vitest 4.0 (Oct 2025) | Oct 2025 | Stable Browser Mode (irrelevant here), `expect.schemaMatching` for Standard Schema v1 validation |
| `Static<typeof Schema>` | `typeof Schema.static` | TypeBox 0.33+ | Both still work; `.static` is newer shorthand; canonical in docs is still `Static<typeof>` |
| AJV for JSON Schema validation | TypeBox TypeCompiler | 2023+ | TypeBox TypeCompiler generates compiled validator without AJV runtime dep |

**Deprecated/outdated:**
- `@vitest/coverage-c8`: replaced by `@vitest/coverage-v8` (c8 was the old V8 coverage tool; v8 is the current one)
- `poolMatchGlobs`, `environmentMatchGlobs`, `deps.external/inline` vitest config options: removed in Vitest 4.0

---

## Open Questions

1. **JSON bundling behavior with tsdown 0.20 and `createRequire`**
   - What we know: tsdown bundles devDependencies imported in source; JSON files via `createRequire` may or may not be inlined
   - What's unclear: Whether tsdown 0.20 inlines JSON loaded via `createRequire` into the bundle, or whether the `data/` directory must be shipped separately alongside `dist/`
   - Recommendation: Test both approaches in the scaffold task. If `createRequire` JSON is not inlined, ship `data/` as a package artifact (already in the PRD's file structure) and resolve paths via `new URL('../../../data/taxonomy/v1.0.0.json', import.meta.url)`; this requires `"files": ["dist", "data"]` in `package.json`.

2. **AxonTaxonomy class style: static vs. exported singleton instance**
   - What we know: CONTEXT.md says API style is Claude's discretion; static class pattern is recommended in this research
   - What's unclear: Whether consuming code (provider-core) prefers `AxonTaxonomy.getActionsForType(...)` or `axonTaxonomy.getActionsForType(...)`
   - Recommendation: Use static class. No instances needed; the taxonomy is process-global. Static class is more familiar to TypeScript consumers and avoids injection concerns.

3. **Taxonomy action count validation**
   - What we know: TAXO-06 requires full Physician actions + common cross-type actions for all 49 types; "full" Physician action set is not quantified
   - What's unclear: The exact list of actions under each category for Physicians — this is clinical domain knowledge
   - Recommendation: The planner should create a task specifically for authoring the taxonomy JSON data, and reference the PRD section 2.5.2 examples as seed content. The task should be time-boxed; the goal is "clinically coherent and complete enough for demo" not "exhaustive professional society standard."

4. **`resolveJsonModule` + `nodenext` module compatibility**
   - What we know: `"module": "nodenext"` may require file extensions in imports; `resolveJsonModule` is needed for static JSON imports
   - What's unclear: Whether `import taxonomyData from '../../data/taxonomy/v1.0.0.json'` works with both `nodenext` and tsdown's bundler
   - Recommendation: Test during scaffold task. Fallback to `createRequire` pattern which is definitively ESM-safe.

---

## Sources

### Primary (HIGH confidence)
- tsdown.dev/guide/getting-started — Installation, config format, platform options
- tsdown.dev/options/dependencies — external, noExternal, skipNodeModulesBundle options
- deepwiki.com/rolldown/tsdown/7.2-external-dependencies — noExternal: () => true pattern, inlineOnly, default behavior
- github.com/tsconfig/bases/blob/main/bases/node22.json — Exact Node 22 tsconfig settings
- github.com/sinclairzx81/typebox — TypeBox 0.34.x API: Type, Static, TypeCompiler
- betterstack.com/community/guides/scaling-nodejs/typebox-explained/ — TypeCompiler.Compile pattern
- vitest.dev/blog/vitest-4 — Vitest 4.0 breaking changes, features
- vitest.dev/config/coverage — Coverage thresholds configuration API

### Secondary (MEDIUM confidence)
- alan.norbauer.com/articles/tsdown-bundler/ — unbundle: true pattern for Node.js libraries; ESM-first confirmation
- WebSearch: vitest 4.0 release date (Oct 22, 2025), latest version 4.0.18
- WebSearch: TypeScript strict flags `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` — confirmed as 2025 recommended settings

### Tertiary (LOW confidence)
- WebSearch: JSON versioning patterns — general schema versioning approaches (not authoritative for this specific use case)
- WebSearch: Healthcare taxonomy codes (NUCC/CMS) — informational context only; Axon taxonomy is purpose-built, not NUCC-based

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against official docs and changelogs; versions confirmed current as of Feb 2026
- Architecture patterns: HIGH — tsdown dependency bundling, TypeBox TypeCompiler, vitest coverage configs all verified against official docs
- Taxonomy JSON design: HIGH (structure) / MEDIUM (content) — data shape is clear from PRD; clinical content of Physician action set requires domain judgment
- Pitfalls: HIGH — most pitfalls derive from known TypeScript strict mode behaviors and confirmed tsdown default behavior

**Research date:** 2026-02-21
**Valid until:** 2026-04-21 (tsdown is beta-quality Rolldown; check for breaking changes in any tsdown release notes before use; TypeBox 0.34.x is stable)
