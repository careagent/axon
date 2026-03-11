# Stack Research

**Domain:** Healthcare provider registry and trust infrastructure — TypeScript pnpm library
**Researched:** 2026-02-21
**Confidence:** HIGH (core tools verified against official sources and npm registry)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | ^5.9.3 | Language | PRD specifies ~5.7; current stable is 5.9.3. `isolatedDeclarations` (added 5.5) enables fast .d.ts generation via oxc-transform. 5.9 adds `--module node20` and deferred imports. Backward-compatible within 5.x. |
| Node.js | >=22.12.0 | Runtime | PRD constraint. Ed25519, `node:crypto`, `node:fs/promises` all stable here. |
| pnpm | ^10.30.1 | Package manager | PRD constraint. Current stable is 10.30.1. Workspace support, strict dependency isolation, fastest install. |
| @sinclair/typebox | ~0.34.48 | Schema validation + static types | PRD constraint. Stay on 0.34.x — TypeBox 1.0 moved to new `typebox` package (ESM-only, breaking changes). 0.34.x actively maintained through 2026+. Gets bundled into output by tsdown (consumers see zero npm deps). |

### Build Tools (dev only)

| Tool | Version | Purpose | Why |
|------|---------|---------|-----|
| tsdown | ~0.20.3 | Library bundler | Built on Rolldown (Rust) + oxc-transform. Succeeds tsup (tsup is no longer actively maintained). Handles multiple entry points via `entry: {}`, auto-generates `package.json` exports (`exports: true`). Bundles devDependencies that are actually imported (e.g., TypeBox), so consumers see zero npm runtime deps. 0.20.3 is current as of Feb 5 2026. |
| vitest | ~4.0.17 | Test runner | PRD constraint. Released Oct 22 2025. Native TypeScript/ESM support via Vite/esbuild. Built-in v8 coverage with configurable thresholds. Jest-compatible API. Requires Node.js >=20 and Vite >=6.0. |
| @vitest/coverage-v8 | ~4.0.17 | Coverage | Matches vitest version. V8 native coverage — no Istanbul instrumentation overhead. Required for the 80% coverage threshold per PRD. |

### Supporting Libraries (dev only — all bundled or type-only)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tsconfig/node22 | latest | Base tsconfig | Provides `"module": "NodeNext"`, `"target": "ES2022"`, `"lib": ["es2024"]` tuned for Node 22. Eliminates guesswork on 100+ tsconfig options. |
| oxlint | ^1.0 | Fast linting | Rust-based, 520+ rules, 50-100x faster than ESLint. v1.0 stable June 2025. Type-aware linting in preview. Use for pre-commit and CI fast path. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Node.js built-in `node:crypto` | Ed25519 identity exchange, signing, verification | `crypto.generateKeyPairSync('ed25519')`, `crypto.sign()`, `crypto.verify()`. Fully supported in Node 22. No external deps. |
| Node.js built-in `node:fs/promises` | JSON file persistence for v1 registry | Write-to-temp-then-rename for atomicity. Sufficient for v1 in-memory + file-backed store. |
| Node.js built-in `node:crypto.randomUUID()` | UUID v4 generation (AxonMessage.message_id) | Available since Node 14.17. No external dep needed. |

---

## Installation

```bash
# Runtime dependencies (zero — all bundled or built-in)
# None

# Dev dependencies
pnpm add -D typescript@^5.9.3
pnpm add -D tsdown@~0.20.3
pnpm add -D vitest@~4.0.17
pnpm add -D @vitest/coverage-v8@~4.0.17
pnpm add -D @sinclair/typebox@~0.34.48
pnpm add -D @tsconfig/node22
pnpm add -D oxlint@^1.0
```

> **Key mechanic:** `@sinclair/typebox` goes in `devDependencies`. tsdown bundles devDependencies that are actually imported into the output dist. The published `@careagent/axon` package therefore declares zero `dependencies`, satisfying the zero-runtime-deps constraint while still using TypeBox for schema validation at runtime inside the bundle.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| tsdown | tsup | Never — tsup is no longer actively maintained (last significant update 2024). tsdown is its direct successor from the same void(0) ecosystem. |
| tsdown | tsc + rollup | If you need Rollup plugin ecosystem not yet ported to Rolldown. Not applicable here. |
| vitest | jest | Never for this project — Jest has poor native ESM support, requires transform config, slower. Vitest is the void(0) standard. |
| @sinclair/typebox ~0.34 | typebox 1.0 | If/when provider-core, patient-core, neuron all migrate simultaneously. 1.0 is ESM-only; 0.34.x is stable and supported. Not yet. |
| @sinclair/typebox ~0.34 | zod | If runtime dep constraints were relaxed and you prefer zod's API. Not applicable — zod would be a runtime dep and TypeBox is already specified. |
| @sinclair/typebox ~0.34 | valibot | Smaller bundle (~1KB), but TypeBox is the ecosystem standard for this project. |
| node:crypto (Ed25519) | @noble/ed25519 | If Node 22 built-in Ed25519 support is insufficient (it isn't). Noble is zero-dep but still a dep. |
| node:fs/promises (JSON) | node:sqlite | node:sqlite is experimental in Node 22, requires `--experimental-sqlite` flag. Not production-safe for v1. Consider for v2 registry backend. |
| node:crypto.randomUUID() | uuid npm package | uuid would be a runtime dep. Node 22 built-in is sufficient. |
| oxlint | eslint + typescript-eslint | If you need the full ESLint plugin ecosystem (e.g., import/order, specific type-checking rules). oxlint type-aware rules are in alpha. For CI speed, oxlint is the right call. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@noble/ed25519` / `@noble/curves` | Runtime npm dependency. Node 22 `node:crypto` has native Ed25519 — `crypto.generateKeyPairSync('ed25519')`, `crypto.sign()`, `crypto.verify()`. | `node:crypto` built-in |
| `better-sqlite3` | Native addon (requires build toolchain), runtime npm dependency. node:sqlite is experimental. For v1, JSON files suffice. | `node:fs/promises` for v1; evaluate `node:sqlite` for v2 when stable |
| `lowdb` / `node-persist` | Runtime npm dependencies. Abstractions over `fs` that add no value here when the data model is simple and known at build time. | `node:fs/promises` with write-to-temp atomicity pattern |
| `uuid` npm package | Runtime npm dependency. Node 22 has `crypto.randomUUID()` built-in. | `node.crypto.randomUUID()` |
| `zod` | Runtime npm dependency. TypeBox is already in the stack for this project. Mixing schema libraries creates two type systems. | `@sinclair/typebox` |
| `ajv` | Runtime npm dependency. TypeBox has a built-in Value module that handles validation — `Value.Check(schema, value)`. No separate validator needed. | `@sinclair/typebox/value` (bundled by tsdown) |
| `tsup` | No longer actively maintained. tsdown is its direct successor with better performance (Rust/Rolldown). | `tsdown` |
| `jest` | Poor ESM support, requires transform config for TypeScript, slower than vitest. The void(0) ecosystem (Vite, Vitest, tsdown, pnpm) is the standard for this project. | `vitest` |
| `typebox` (1.0, new package) | ESM-only breaking change from `@sinclair/typebox`. 1.0 removed Kind/ReadonlyKind symbols. Provider-core and other consumers must migrate simultaneously. Not yet. | `@sinclair/typebox ~0.34` |
| `node:sqlite` | Still experimental in Node 22 (requires `--experimental-sqlite` flag). Breaking changes possible before stable. Registry persistence in v1 does not need SQL. | `node:fs/promises` JSON store for v1 |
| `express` / any HTTP server | Axon v1 is a library package, not a server. The `AxonRegistry` and `AxonBroker` classes are consumed by other packages. | Pure TypeScript classes with no server layer |

---

## Stack Patterns by Variant

**If building the taxonomy and questionnaire data layer only (Phases 1-2):**
- All data lives in TypeScript files as `const` exported objects
- TypeBox schemas validate structure at import time via `Value.Check()`
- tsdown bundles `src/taxonomy/` and `src/questionnaires/` into separate entry points
- No Node.js I/O — pure data + type exports

**If building the registry storage layer (Phase 3):**
- `node:fs/promises` for JSON file read/write
- Write pattern: write to `registry.json.tmp`, verify, then `fs.rename()` (atomic on same filesystem)
- In-memory `Map<string, RegistryEntry>` as primary store; file as persistence
- File write is debounced (e.g., 500ms after last write) to avoid excessive I/O

**If building the protocol/crypto layer (Phase 4):**
- `node:crypto` — `generateKeyPairSync('ed25519')` for key generation
- Export as DER-encoded `KeyObject`, or serialize with `keyObject.export({ type: 'pkcs8', format: 'der' })`
- `crypto.sign('Ed25519', canonicalPayload, privateKey)` → `Buffer`
- `crypto.verify('Ed25519', canonicalPayload, publicKey, signature)` → `boolean`
- Message canonical form: `JSON.stringify(sorted keys)` or deterministic serialization
- `crypto.randomUUID()` for `message_id`

**If building the package exports (Phase 5):**
- tsdown `entry` object: one key per public entry point
- `exports: true` in tsdown.config.ts auto-generates package.json `exports` field
- Entry points: `index` (full), `taxonomy`, `questionnaires`, `types`
- tsdown generates ESM + CJS outputs with corresponding `.d.ts` files

---

## tsconfig.json Recommended Settings

```json
{
  "extends": "@tsconfig/node22/tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "isolatedDeclarations": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "test"]
}
```

> `isolatedDeclarations: true` is the key setting — it enables tsdown to use oxc-transform for .d.ts generation instead of `tsc`, resulting in ~145x faster declaration emit. Requires explicit return type annotations on exported functions.

---

## tsdown.config.ts Recommended Settings

```typescript
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    taxonomy: 'src/taxonomy/index.ts',
    questionnaires: 'src/questionnaires/index.ts',
    types: 'src/types/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  exports: true,
  clean: true,
  // No external needed — zero runtime npm deps by design.
  // devDependencies that are imported (TypeBox) get bundled.
})
```

---

## vitest.config.ts Recommended Settings

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      exclude: ['dist/**', 'test/fixtures/**', '**/*.d.ts'],
    },
  },
})
```

---

## Version Compatibility

| Package | Verified Compatibility | Notes |
|---------|----------------------|-------|
| tsdown@0.20.3 | Node.js >=20.19 | Verified on Node 22 |
| vitest@4.0.17 | Node.js >=20, Vite >=6.0 | Vite is a peer dep of vitest (in devDeps) |
| @sinclair/typebox@0.34.48 | TypeScript >=4.x | Compatible with TS 5.9. 0.34.x maintained alongside new 1.0 package. |
| TypeScript@5.9.3 | Node.js >=20.13 | Works with Node 22 |
| @tsconfig/node22 | TypeScript >=5.0 | Node 22 LTS settings |

---

## NPI Validation: Zero-Dep Implementation

The NPI Luhn check is a small, self-contained implementation — no library needed:

```typescript
// src/registry/npi.ts — pure TypeScript, zero deps
export function validateNPI(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  // NPI uses Luhn mod 10 with prefix 80840
  const digits = `80840${npi.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = parseInt(digits[digits.length - 1 - i], 10);
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(npi[9], 10);
}
```

Source: [NPI Luhn Check Digit Calculation](http://www.touchoftechnology.com/npi-luhn-check-digit-calculation/) — verified against published CMS algorithm.

---

## Sources

- [tsdown GitHub — rolldown/tsdown](https://github.com/rolldown/tsdown) — v0.20.3 verified current, Feb 5 2026. HIGH confidence.
- [tsdown Getting Started](https://tsdown.dev/guide/getting-started) — Node.js >=20.19 requirement, feature set. HIGH confidence.
- [tsdown Package Exports](https://tsdown.dev/options/package-exports) — exports auto-generation, multiple entry points. HIGH confidence.
- [tsdown Dependencies](https://tsdown.dev/options/dependencies) — devDep bundling behavior. HIGH confidence.
- [tsdown DTS Options](https://tsdown.dev/options/dts) — isolatedDeclarations + oxc-transform integration. HIGH confidence.
- [Vitest 4.0 blog post](https://vitest.dev/blog/vitest-4) — v4.0.17, Node >=20, Oct 22 2025 release. HIGH confidence.
- [TypeScript releases — GitHub](https://github.com/microsoft/typescript/releases) — 5.9.3 latest stable, 6.0 beta Feb 18 2026. HIGH confidence.
- [pnpm blog 2025](https://pnpm.io/blog/2025/12/29/pnpm-in-2025) — v10.30.1 current as of Feb 21 2026. HIGH confidence.
- [@sinclair/typebox npm / Cloudsmith](https://cloudsmith.com/navigator/npm/@sinclair/typebox) — 0.34.48 current in 0.34 series. HIGH confidence.
- [TypeBox GitHub](https://github.com/sinclairzx81/typebox) — 1.0 under `typebox` package (new name), 0.34.x maintained separately. HIGH confidence.
- [Node.js crypto docs](https://nodejs.org/api/crypto.html) — Ed25519 support via `generateKeyPairSync`, `sign`, `verify`. HIGH confidence.
- [Vitest coverage config](https://vitest.dev/config/coverage) — v8 provider, thresholds API. HIGH confidence.
- [oxlint v1.0 InfoQ](https://www.infoq.com/news/2025/08/oxlint-v1-released/) — stable June 2025, 520+ rules, 50-100x faster. MEDIUM confidence (InfoQ, not official docs).
- [NPI Luhn algorithm](http://www.touchoftechnology.com/npi-luhn-check-digit-calculation/) — NPI-specific Luhn with 80840 prefix. MEDIUM confidence (third-party, but well-known CMS published spec).
- [Alan Norbauer — Switching from tsup to tsdown](https://alan.norbauer.com/articles/tsdown-bundler/) — tsup successor confirmation. MEDIUM confidence.

---

*Stack research for: @careagent/axon — healthcare provider registry and trust infrastructure*
*Researched: 2026-02-21*
