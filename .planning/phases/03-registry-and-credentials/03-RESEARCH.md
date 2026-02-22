# Phase 3: Registry and Credentials - Research

**Researched:** 2026-02-22
**Domain:** NPI validation (Luhn algorithm), TypeBox schema design for registry data models, in-memory registry with file-backed JSON persistence (atomic writes), multi-field search
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REGI-01 | TypeBox schemas for RegistryEntry, NeuronEndpoint, CredentialRecord, OrganizationAffiliation | TypeBox schemas following established Phase 1/2 patterns: `Type.Object()` for structures, `Type.Union([Type.Literal()])` for status enums, `Type.Optional()` for entity-type-conditional fields. TypeCompiler.Compile() for validation at registration time. PRD section 2.1.3 provides the exact data model shapes. |
| REGI-02 | NPI validation (Luhn check algorithm with 80840 prefix, 10-digit format validation) | Pure function: validate 10-digit string, apply Luhn algorithm with constant 24 (representing the 80840 prefix sum). No external dependencies needed -- the algorithm is 15 lines of code. Verified against official CMS specification and multiple authoritative sources. |
| REGI-03 | In-memory registry with file-backed JSON persistence for development (atomic write-to-temp-then-rename pattern) | `Map<string, RegistryEntry>` for in-memory store. Persist via `fs.writeFileSync()` to a temp file in the same directory, then `fs.renameSync()` to the target path. `renameSync` is atomic on POSIX systems. Load from JSON file at construction if it exists. Node.js built-in `node:fs` -- no npm dependencies. |
| REGI-04 | `AxonRegistry` supports provider/Neuron registration, credential management, and search | Instance class (not static) because registry state is mutable and file-path-specific. Methods: `registerProvider()`, `registerNeuron()`, `updateEndpoint()`, `addCredential()`, `updateCredentialStatus()`, `findByNPI()`, `search()`. Each mutation triggers atomic persist. |
| REGI-05 | Search supports queries by NPI, name, specialty, provider type, organization, and credential status | In-memory linear scan over `Map.values()` with combinable filter predicates. For v1 development scale (hundreds of entries, not millions), linear scan is appropriate. Case-insensitive substring matching for text fields (name, specialty, organization). Exact match for NPI and credential status. |
</phase_requirements>

---

## Summary

Phase 3 builds the NPI-keyed provider and organization registry with credential management, file-backed persistence, and multi-field search. This is a fundamentally different module from Phases 1 and 2: those phases dealt with static, read-only data (taxonomy and questionnaires loaded from JSON files); Phase 3 introduces mutable state, persistence, and write operations. The `AxonRegistry` class is an instance (not a static class like `AxonTaxonomy` and `AxonQuestionnaires`) because it manages mutable state tied to a specific file path.

The technical work divides into four tracks: (1) TypeBox schemas defining the registry data model (RegistryEntry, NeuronEndpoint, CredentialRecord, OrganizationAffiliation), (2) NPI validation using the Luhn algorithm with the 80840 prefix constant, (3) a persistence layer implementing atomic write-to-temp-then-rename, and (4) the `AxonRegistry` class providing registration, credential management, and search APIs. All of this uses only Node.js built-in modules (`node:fs`, `node:path`, `node:crypto` for UUID generation) and TypeBox (already in devDependencies) -- zero new npm packages.

The credential model is the most nuanced design element. Every credential record must prominently surface `verification_source: 'self_attested'` for v1, while the data model must support progressive verification levels (`self_attested`, `nppes_matched`, `state_board_verified`). The schema achieves this by making `verification_source` a required field with a TypeBox union of string literals, defaulting to `'self_attested'` at registration time (enforced by the API, not the schema).

**Primary recommendation:** Instance-based `AxonRegistry` class with constructor accepting a file path for persistence. TypeBox schemas for all data types. NPI validation as a pure standalone function. Atomic file persistence on every mutation. Linear-scan search with combinable predicates. All state in a single `Map<string, RegistryEntry>` keyed by NPI.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @sinclair/typebox | ^0.34.48 | TypeBox schemas for registry data model; TypeCompiler for registration validation | Already in project devDependencies; established pattern from Phase 1/2 |
| TypeScript | ^5.9.3 | Static typing with maximum strictness | Already configured |
| vitest | ^4.0.18 | Test runner with 80% coverage thresholds | Already configured |
| node:fs | built-in | File I/O for JSON persistence (writeFileSync, renameSync, readFileSync, existsSync, mkdirSync) | Node.js 22 built-in; zero deps |
| node:path | built-in | Path resolution for persistence file and temp file | Node.js built-in |
| node:crypto | built-in | `crypto.randomUUID()` for generating unique temp file names | Node.js 22 built-in; zero deps |

### Supporting

No new dependencies required. Phase 3 uses the same stack as Phases 1 and 2. The registry module depends on the taxonomy module (for provider type validation during registration) but introduces no new npm packages.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual atomic write (writeFileSync + renameSync) | `write-file-atomic` npm package | Adds a runtime dependency; violates zero-deps constraint; the manual pattern is 5 lines of code |
| In-memory Map with JSON file | SQLite via `better-sqlite3` | Adds native dependency; violates zero-deps constraint; overkill for v1 development-scale data |
| Linear scan search | Full-text search library (e.g., `fuse.js`) | Adds dependency; linear scan is sufficient for v1 scale; search is simple substring matching |
| Instance class | Static class (like AxonTaxonomy) | Static class cannot manage mutable state tied to a file path; registry needs instance-level configuration |
| `crypto.randomUUID()` for temp file naming | Timestamp-based naming | UUID avoids collisions in concurrent scenarios; `crypto.randomUUID()` is built into Node.js 22 |

**Installation:**
```bash
# No new packages needed -- Phase 1/2 stack covers everything
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── registry/
│   ├── index.ts           # Re-exports AxonRegistry, schemas, NPI validator
│   ├── registry.ts        # AxonRegistry instance class
│   ├── schemas.ts          # TypeBox schemas for RegistryEntry, NeuronEndpoint, CredentialRecord, etc.
│   ├── npi.ts             # NPI validation (Luhn algorithm with 80840 prefix)
│   └── persistence.ts     # Atomic JSON file read/write operations
├── taxonomy/              # (existing from Phase 1)
├── questionnaires/        # (existing from Phase 2)
├── types/
│   └── index.ts           # Add Registry types (Static<typeof Schema>)
└── index.ts               # Add registry re-exports

test/
├── registry.test.ts       # AxonRegistry API tests (registration, credentials, search, persistence)
├── npi.test.ts            # NPI validation tests (valid NPIs, invalid formats, Luhn failures)
├── registry-persistence.test.ts  # Persistence-specific tests (atomic writes, load on restart)
├── taxonomy.test.ts       # (existing)
├── taxonomy-data.test.ts  # (existing)
├── questionnaires.test.ts # (existing)
└── questionnaire-data.test.ts # (existing)
```

### Pattern 1: TypeBox Registry Schemas

**What:** TypeBox schemas defining the registry data model. The PRD section 2.1.3 provides the exact interfaces. These are translated to TypeBox with appropriate union literals for status enums.

**When to use:** All registry data validation -- at registration time, at persistence load time, and for search result typing.

```typescript
// src/registry/schemas.ts
import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

// --- Credential Status ---
export const CredentialStatusSchema = Type.Union([
  Type.Literal('active'),
  Type.Literal('pending'),
  Type.Literal('expired'),
  Type.Literal('suspended'),
  Type.Literal('revoked'),
])

// --- Verification Source ---
// v1: only 'self_attested' is used at registration
// Data model supports progressive verification for v2
export const VerificationSourceSchema = Type.Union([
  Type.Literal('self_attested'),
  Type.Literal('nppes_matched'),
  Type.Literal('state_board_verified'),
])

// --- Credential Type ---
export const CredentialTypeSchema = Type.Union([
  Type.Literal('license'),
  Type.Literal('certification'),
  Type.Literal('privilege'),
])

// --- Credential Record ---
export const CredentialRecordSchema = Type.Object({
  type: CredentialTypeSchema,
  issuer: Type.String(),              // e.g., "Texas Medical Board"
  identifier: Type.String(),          // e.g., "MD-TX-A12345"
  status: CredentialStatusSchema,
  issued_at: Type.Optional(Type.String()),   // ISO 8601
  expires_at: Type.Optional(Type.String()),  // ISO 8601
  verification_source: VerificationSourceSchema,  // REQUIRED, not optional
})

// --- Neuron Endpoint ---
export const NeuronHealthStatusSchema = Type.Union([
  Type.Literal('reachable'),
  Type.Literal('unreachable'),
  Type.Literal('unknown'),
])

export const NeuronEndpointSchema = Type.Object({
  url: Type.String(),
  protocol_version: Type.String(),
  health_status: NeuronHealthStatusSchema,
  last_heartbeat: Type.Optional(Type.String()),  // ISO 8601
})

// --- Organization Affiliation ---
export const OrganizationAffiliationSchema = Type.Object({
  organization_npi: Type.String(),
  organization_name: Type.String(),
  department: Type.Optional(Type.String()),
  privileges: Type.Optional(Type.Array(Type.String())),
  neuron_endpoint: Type.Optional(Type.String()),
})

// --- Entity Type ---
export const EntityTypeSchema = Type.Union([
  Type.Literal('individual'),
  Type.Literal('organization'),
])

// --- Registry Entry ---
export const RegistryEntrySchema = Type.Object({
  npi: Type.String(),
  entity_type: EntityTypeSchema,
  name: Type.String(),
  credential_status: CredentialStatusSchema,

  // Individual provider fields (optional -- absent for organizations)
  provider_types: Type.Optional(Type.Array(Type.String())),
  degrees: Type.Optional(Type.Array(Type.String())),
  specialty: Type.Optional(Type.String()),
  subspecialty: Type.Optional(Type.String()),

  // Organization fields (optional -- absent for individuals)
  organization_name: Type.Optional(Type.String()),
  neuron_endpoint: Type.Optional(NeuronEndpointSchema),

  // Credentials (required, may be empty array initially)
  credentials: Type.Array(CredentialRecordSchema),

  // Organizational affiliations (for individual providers)
  affiliations: Type.Optional(Type.Array(OrganizationAffiliationSchema)),

  // Metadata
  registered_at: Type.String(),        // ISO 8601
  last_updated: Type.String(),         // ISO 8601
  registry_version: Type.String(),     // Schema version
})

// --- Search Query ---
export const RegistrySearchQuerySchema = Type.Object({
  npi: Type.Optional(Type.String()),
  name: Type.Optional(Type.String()),
  specialty: Type.Optional(Type.String()),
  provider_type: Type.Optional(Type.String()),
  organization: Type.Optional(Type.String()),
  credential_status: Type.Optional(CredentialStatusSchema),
  limit: Type.Optional(Type.Number()),   // default 20, max 100
  offset: Type.Optional(Type.Number()),
})

// Compiled validators
export const RegistryEntryValidator = TypeCompiler.Compile(RegistryEntrySchema)
export const CredentialRecordValidator = TypeCompiler.Compile(CredentialRecordSchema)
export const NeuronEndpointValidator = TypeCompiler.Compile(NeuronEndpointSchema)
export const RegistrySearchQueryValidator = TypeCompiler.Compile(RegistrySearchQuerySchema)
```

**Key schema design decisions:**

1. **`verification_source` is REQUIRED on CredentialRecord, not optional.** The success criteria explicitly state "every credential record surfaces `verification_source: 'self_attested'` prominently." Making it required forces callers to always provide it. The API defaults to `'self_attested'` at registration time.

2. **`entity_type` discriminates individual vs. organization.** The registry supports both. Individual providers have `provider_types`, `degrees`, `specialty`, `subspecialty`, and `affiliations`. Organizations have `organization_name` and `neuron_endpoint`. Both share `npi`, `name`, `credential_status`, `credentials`, and metadata fields.

3. **`credentials` is a required array (not optional).** An entry always has a credentials array, even if empty. This avoids `undefined` checks throughout the codebase.

4. **`registry_version` tracks the schema version.** This enables future schema migrations. Set to `"1.0.0"` for v1.

### Pattern 2: NPI Validation (Luhn Algorithm with 80840 Prefix)

**What:** Pure function that validates a 10-digit NPI number using the Luhn check digit algorithm. The 80840 prefix is accounted for by adding a constant 24 to the Luhn sum.

**When to use:** Before accepting any NPI for registration or search.

**Algorithm (verified against CMS specification and multiple authoritative sources):**

1. Verify the input is exactly 10 digits (all numeric)
2. Take the first 9 digits of the NPI
3. Starting from the rightmost of those 9 digits, double every other digit
4. If a doubled digit exceeds 9, subtract 9 (equivalent to summing the individual digits)
5. Sum all digits (doubled and undoubled)
6. Add constant 24 (this accounts for the 80840 prefix)
7. The check digit is `(10 - (sum % 10)) % 10`
8. Compare the calculated check digit to the actual 10th digit

```typescript
// src/registry/npi.ts

/**
 * Validate an NPI number using the Luhn check digit algorithm.
 *
 * NPI (National Provider Identifier) is a 10-digit number where the
 * last digit is a check digit calculated using the Luhn algorithm
 * with an implicit 80840 prefix (represented by adding constant 24).
 *
 * @param npi - The NPI string to validate
 * @returns true if the NPI is a valid 10-digit number passing the Luhn check
 *
 * @see https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/NationalProvIdentStand
 * @see https://www.eclaims.com/articles/how-to-calculate-the-npi-check-digit/
 */
export function validateNPI(npi: string): boolean {
  // Step 1: Format validation -- exactly 10 digits
  if (!/^\d{10}$/.test(npi)) {
    return false
  }

  // Step 2: Luhn check with 80840 prefix (constant 24)
  let sum = 24 // accounts for the 80840 prefix
  const digits = npi.split('').map(Number)
  const checkDigit = digits[9]!

  // Process first 9 digits, starting from rightmost (index 8),
  // doubling every other digit starting from the rightmost
  for (let i = 8; i >= 0; i--) {
    let digit = digits[i]!
    // Double every other digit starting from the rightmost (index 8)
    if ((8 - i) % 2 === 0) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }
    sum += digit
  }

  // Step 3: Calculate expected check digit
  const expectedCheckDigit = (10 - (sum % 10)) % 10

  return checkDigit === expectedCheckDigit
}
```

**Important implementation note:** The "double every other digit starting from the rightmost" means for a 10-digit NPI with digits indexed 0-9, where digit 9 is the check digit, we process digits 0-8 and double digits at positions 8, 6, 4, 2, 0 (the ones at even distance from position 8). This matches the standard Luhn algorithm applied to the 15-digit number 80840XXXXXXXXX where the check digit is the last digit.

**Known valid NPI for testing:** `1234567893` (the standard CMS example, where digits 1-9 are `123456789` and check digit is `3`).

### Pattern 3: Atomic JSON Persistence

**What:** Write registry state to a JSON file using the atomic write-to-temp-then-rename pattern. `fs.renameSync()` is atomic on POSIX systems (macOS, Linux), ensuring no partial writes.

**When to use:** Every time registry state is mutated (registration, credential update, endpoint update).

```typescript
// src/registry/persistence.ts
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { RegistryEntryValidator } from './schemas.js'
import type { RegistryEntry } from '../types/index.js'

/**
 * Atomically write registry data to a JSON file.
 *
 * Uses write-to-temp-then-rename pattern:
 * 1. Write JSON to a temp file in the same directory
 * 2. Rename temp file to target path (atomic on POSIX)
 *
 * The temp file is in the same directory to ensure it's on the same
 * filesystem, which is required for atomic rename.
 */
export function persistRegistry(
  filePath: string,
  entries: Map<string, RegistryEntry>,
): void {
  const dir = dirname(filePath)

  // Ensure directory exists
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  // Serialize to JSON
  const data = JSON.stringify(
    { version: '1.0.0', entries: Object.fromEntries(entries) },
    null,
    2,
  )

  // Write to temp file in the same directory (same filesystem)
  const tempPath = join(dir, `.registry-${randomUUID()}.tmp`)
  writeFileSync(tempPath, data, 'utf-8')

  // Atomic rename
  renameSync(tempPath, filePath)
}

/**
 * Load registry data from a JSON file.
 *
 * Returns an empty Map if the file does not exist.
 * Validates each entry against the RegistryEntry schema.
 *
 * @throws Error if the file exists but contains invalid data
 */
export function loadRegistry(
  filePath: string,
): Map<string, RegistryEntry> {
  if (!existsSync(filePath)) {
    return new Map()
  }

  const raw = readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw) as { version: string; entries: Record<string, unknown> }
  const entries = new Map<string, RegistryEntry>()

  for (const [npi, entry] of Object.entries(data.entries)) {
    if (!RegistryEntryValidator.Check(entry)) {
      const errors = [...RegistryEntryValidator.Errors(entry)]
      const details = errors.map(e => `  ${e.path}: ${e.message}`).join('\n')
      throw new Error(`Registry entry "${npi}" failed validation:\n${details}`)
    }
    entries.set(npi, entry)
  }

  return entries
}
```

**Key design decisions:**

1. **Temp file in the same directory.** `renameSync` is only atomic when the source and target are on the same filesystem. By placing the temp file in the same directory as the target, this is guaranteed.

2. **Random UUID in temp file name.** Avoids collisions if multiple processes (unlikely in v1) attempt concurrent writes.

3. **Validation on load.** Every entry is validated when loading from disk. This catches data corruption or manual edits.

4. **Pretty-printed JSON.** `JSON.stringify(data, null, 2)` makes the persisted file human-readable for debugging.

5. **Wrapper object with version field.** The JSON file contains `{ "version": "1.0.0", "entries": { ... } }`, enabling future format migrations.

### Pattern 4: AxonRegistry Instance Class

**What:** An instance class (unlike the static AxonTaxonomy and AxonQuestionnaires) because the registry has mutable state and a configurable file path.

**When to use:** The public API surface for all registry operations.

```typescript
// src/registry/registry.ts
import { validateNPI } from './npi.js'
import { persistRegistry, loadRegistry } from './persistence.js'
import { RegistryEntryValidator, CredentialRecordValidator } from './schemas.js'
import type { RegistryEntry, CredentialRecord, NeuronEndpoint, RegistrySearchQuery } from '../types/index.js'

export class AxonRegistry {
  private entries: Map<string, RegistryEntry>
  private readonly filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
    this.entries = loadRegistry(filePath)
  }

  /** Register a provider (individual entity) */
  registerProvider(registration: {
    npi: string
    name: string
    provider_types: string[]
    degrees?: string[]
    specialty?: string
    subspecialty?: string
    credentials?: CredentialRecord[]
    affiliations?: Array<{ /* ... */ }>
  }): RegistryEntry {
    if (!validateNPI(registration.npi)) {
      throw new Error(`Invalid NPI: "${registration.npi}"`)
    }
    if (this.entries.has(registration.npi)) {
      throw new Error(`NPI "${registration.npi}" is already registered`)
    }

    const now = new Date().toISOString()
    const entry: RegistryEntry = {
      npi: registration.npi,
      entity_type: 'individual',
      name: registration.name,
      credential_status: 'pending',
      provider_types: registration.provider_types,
      degrees: registration.degrees,
      specialty: registration.specialty,
      subspecialty: registration.subspecialty,
      credentials: (registration.credentials ?? []).map(c => ({
        ...c,
        verification_source: 'self_attested' as const,
      })),
      affiliations: registration.affiliations,
      registered_at: now,
      last_updated: now,
      registry_version: '1.0.0',
    }

    this.entries.set(entry.npi, entry)
    this.persist()
    return entry
  }

  /** Register a Neuron (organization entity) */
  registerNeuron(registration: {
    npi: string
    name: string
    organization_name: string
    endpoint: NeuronEndpoint
    credentials?: CredentialRecord[]
  }): RegistryEntry {
    // Similar pattern: validate NPI, create entry, persist
    // ...
  }

  /** Find by NPI (O(1) lookup) */
  findByNPI(npi: string): RegistryEntry | undefined {
    return this.entries.get(npi)
  }

  /** Search with combinable filters */
  search(query: RegistrySearchQuery): RegistryEntry[] {
    // Linear scan with filter predicates
    // ...
  }

  /** Add a credential to an existing entry */
  addCredential(npi: string, credential: Omit<CredentialRecord, 'verification_source'>): void {
    // Force verification_source to 'self_attested' for v1
    // ...
  }

  /** Update credential status */
  updateCredentialStatus(
    npi: string,
    credentialIdentifier: string,
    status: CredentialRecord['status'],
  ): void {
    // Find entry, find credential by identifier, update status, persist
    // ...
  }

  /** Update Neuron endpoint */
  updateEndpoint(npi: string, endpoint: NeuronEndpoint): void {
    // Find entry, update endpoint, persist
    // ...
  }

  /** Persist current state to file */
  private persist(): void {
    persistRegistry(this.filePath, this.entries)
  }
}
```

**Key design decisions:**

1. **Instance class, not static.** The registry has mutable state (entries) and a configurable file path. Multiple registries could exist (e.g., test registry vs. main registry). Static class would not support this.

2. **Constructor loads existing state.** Calling `new AxonRegistry('path/to/registry.json')` loads any previously persisted state. This satisfies success criterion 5: "Restarting the process loads the previously persisted registry state."

3. **Every mutation calls `persist()`.** Registration, credential updates, endpoint updates -- all trigger an atomic write. This ensures crash safety (at most one mutation is lost).

4. **NPI validation on registration.** `registerProvider()` and `registerNeuron()` both validate the NPI before accepting the registration.

5. **`verification_source` forced to `'self_attested'`.** For v1, all credentials are self-attested. The API enforces this regardless of what the caller provides. The schema supports other values for v2.

6. **Duplicate NPI rejection.** A second registration with the same NPI throws an error. NPIs are unique identifiers.

### Pattern 5: Multi-Field Search with Combinable Predicates

**What:** Search that supports filtering by NPI, name, specialty, provider type, organization, and credential status, with all parameters being optional and combinable (AND logic).

**When to use:** `AxonRegistry.search()` implementation.

```typescript
search(query: RegistrySearchQuery): RegistryEntry[] {
  const limit = Math.min(query.limit ?? 20, 100)
  const offset = query.offset ?? 0

  let results: RegistryEntry[] = []

  for (const entry of this.entries.values()) {
    // All specified filters must match (AND logic)
    if (query.npi !== undefined && entry.npi !== query.npi) continue
    if (query.name !== undefined &&
      !entry.name.toLowerCase().includes(query.name.toLowerCase())) continue
    if (query.specialty !== undefined &&
      entry.specialty?.toLowerCase() !== query.specialty.toLowerCase()) continue
    if (query.provider_type !== undefined &&
      !entry.provider_types?.includes(query.provider_type)) continue
    if (query.organization !== undefined) {
      const matchesOrg = entry.organization_name?.toLowerCase().includes(query.organization.toLowerCase())
      const matchesAffiliation = entry.affiliations?.some(
        a => a.organization_name.toLowerCase().includes(query.organization!.toLowerCase())
      )
      if (!matchesOrg && !matchesAffiliation) continue
    }
    if (query.credential_status !== undefined &&
      entry.credential_status !== query.credential_status) continue

    results.push(entry)
  }

  // Apply pagination
  return results.slice(offset, offset + limit)
}
```

**Search behavior:**
- **NPI:** Exact match (NPI is a precise identifier)
- **Name:** Case-insensitive substring match (supports partial name searches)
- **Specialty:** Case-insensitive exact match
- **Provider type:** Exact match against the `provider_types` array
- **Organization:** Case-insensitive substring match against both `organization_name` (for org entries) and `affiliations[].organization_name` (for individual providers affiliated with orgs)
- **Credential status:** Exact match against the top-level `credential_status`
- **Combining:** All specified fields use AND logic (an entry must match all provided criteria)
- **Pagination:** `limit` (default 20, max 100) and `offset` (default 0)

### Anti-Patterns to Avoid

- **Static class for AxonRegistry.** Unlike taxonomy and questionnaires, the registry has mutable state and a configurable file path. A static class would make testing difficult (global state leaks between tests) and prevent multiple registry instances.

- **Persisting on read operations.** Only mutations should trigger persistence. `findByNPI()` and `search()` are pure reads and should not write to disk.

- **Skipping NPI validation on search.** The `search()` method does not need to validate the NPI format in the query -- it's just a filter criterion. NPI validation is only required at registration time.

- **Storing `verification_source` as optional.** Making it optional defeats the success criterion that "every credential record surfaces `verification_source: 'self_attested'` prominently." Required fields surface prominently.

- **Using `os.tmpdir()` for temp files.** The temp file must be in the same directory as the target file to guarantee atomic rename on the same filesystem. Using `/tmp` would fail if the registry file is on a different filesystem.

- **Async persistence in v1.** The registry is file-backed for development. Synchronous writes simplify error handling and avoid race conditions. Async can be introduced in v2 with a proper database backend.

- **In-memory-only mode without persistence.** Even for tests, the persistence layer should work. Tests should use temp directories (via `node:os` `tmpdir()` or vitest's `vi.mocked`) to avoid polluting the project directory.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NPI check digit validation | External NPI validation library | Pure function with Luhn algorithm (15 lines) | The algorithm is trivial; adding a dependency violates zero-deps constraint |
| Schema validation for registry entries | Manual field-by-field type checking | TypeBox TypeCompiler.Compile() | Established project pattern; handles nested objects, arrays, unions correctly |
| TypeScript types from registry schemas | Separate interface declarations | `Static<typeof RegistryEntrySchema>` | Single source of truth; types stay in sync with validators automatically |
| UUID generation for temp files | Custom random string generator | `node:crypto` `randomUUID()` | Built into Node.js 22; cryptographically random; zero deps |
| JSON serialization | Custom serializer | `JSON.stringify()` / `JSON.parse()` | Built-in; handles all registry data types (strings, arrays, objects) |
| Search indexing for v1 | Full-text search engine (Lunr, Fuse.js) | Linear scan with filter predicates | At v1 development scale, linear scan is fast enough; no dependency needed |

**Key insight:** Phase 3 is entirely achievable with Node.js built-ins and the existing TypeBox devDependency. The only new code of any complexity is the 15-line NPI Luhn algorithm and the 20-line atomic persistence helper. The registry class itself is straightforward CRUD over a Map.

---

## Common Pitfalls

### Pitfall 1: NPI Luhn Algorithm Off-By-One in Doubling Position

**What goes wrong:** The Luhn algorithm doubles the wrong digits, causing valid NPIs to fail and invalid NPIs to pass. The "double every other digit starting from the rightmost" rule is ambiguous about which digit to start doubling.

**Why it happens:** Standard Luhn descriptions for credit cards start doubling from the second-to-last digit. NPI validation prefixes 80840 to the 10-digit NPI, which shifts the doubling pattern. Different implementations disagree on which positions to double.

**How to avoid:** Use the constant-24 shortcut for 10-digit NPIs. Validate against the known CMS example: NPI `1234567893` is valid (check digit 3). Also test with `1234567890` (invalid). Write a test suite with at least 5 valid and 5 invalid NPIs.

**Warning signs:** The CMS example NPI `1234567893` fails validation, or obviously invalid NPIs pass.

### Pitfall 2: Temp File Left Behind After Crash

**What goes wrong:** If the process crashes between `writeFileSync` and `renameSync`, a `.registry-{uuid}.tmp` file is left in the directory. On next startup, the orphaned temp file wastes space and may confuse users.

**Why it happens:** The two-step atomic write pattern has a window between write and rename.

**How to avoid:** This is an acceptable trade-off for v1 (the temp file is harmless; the actual registry data is intact). If desired, add a cleanup step in the constructor that deletes any `.registry-*.tmp` files in the registry directory on startup. But do NOT attempt to recover from these files -- the last successfully renamed file is the authoritative state.

**Warning signs:** Growing number of `.tmp` files in the registry directory during development.

### Pitfall 3: `exactOptionalPropertyTypes` Breaking Optional Field Construction

**What goes wrong:** Code that sets optional fields to `undefined` fails to compile. With `exactOptionalPropertyTypes: true` (configured in this project's tsconfig), `field?: T` means the property may be absent, not that it may be `undefined`.

**Why it happens:** Natural to write `{ specialty: provider.specialty ?? undefined }` to conditionally include fields.

**How to avoid:** Use conditional spread or simply omit the property. For example:
```typescript
const entry: RegistryEntry = {
  npi: registration.npi,
  entity_type: 'individual',
  name: registration.name,
  // ... required fields ...
  ...(registration.specialty !== undefined ? { specialty: registration.specialty } : {}),
}
```
Or construct a base object and conditionally assign:
```typescript
const entry = { /* required fields */ } as RegistryEntry
if (registration.specialty !== undefined) {
  entry.specialty = registration.specialty
}
```

**Warning signs:** TypeScript error "Type 'undefined' is not assignable to type 'string'" on optional properties.

### Pitfall 4: Search Performance at Scale

**What goes wrong:** Linear scan becomes slow as registry grows beyond thousands of entries.

**Why it happens:** Every search iterates all entries. With combinable filters, there are no early-exit optimizations for most queries.

**How to avoid:** For v1, this is acceptable -- the registry is for development and will have at most hundreds of entries. Document the O(n) complexity. If future phases need performance, add secondary indexes (Map from specialty to NPI set, etc.) or move to SQLite (v2). Do NOT prematurely optimize.

**Warning signs:** Search operations taking >100ms in profiling.

### Pitfall 5: Credential Status vs. Entry-Level credential_status Drift

**What goes wrong:** The top-level `credential_status` on a RegistryEntry drifts out of sync with the statuses of individual `credentials[]` records. For example, all credentials expire but `credential_status` still shows `'active'`.

**Why it happens:** Two separate fields representing related concepts. The top-level field is a summary; the individual credential records have their own statuses.

**How to avoid:** Define a clear derivation rule: the top-level `credential_status` is derived from the individual credentials. Options:
1. **Worst-status rule:** The entry's status is the worst status among all credentials (if any is `revoked`, entry is `revoked`; if any is `suspended`, entry is `suspended`; etc.)
2. **Manual override:** The top-level status is independently managed by the registering Neuron.

**Recommendation for v1:** Use option 2 (manual). The top-level `credential_status` is set at registration time to `'pending'` and updated explicitly via an API call. This is simpler and matches the PRD's API (`updateCredentials` is a separate operation). Document that the top-level status is the "overall provider status" and individual credential statuses are "per-credential detail."

**Warning signs:** Tests that check `credential_status` after adding/removing credentials and find stale values.

### Pitfall 6: JSON Serialization of Map

**What goes wrong:** `JSON.stringify(map)` produces `{}` because Map is not directly serializable. The persistence layer must convert the Map to a plain object.

**Why it happens:** JSON.stringify does not handle Map instances.

**How to avoid:** Use `Object.fromEntries(entries)` before serializing and `new Map(Object.entries(data.entries))` when deserializing. This is already handled in Pattern 3's persistence code.

**Warning signs:** Empty or missing entries after save/load cycle.

### Pitfall 7: Test Isolation with File-Backed State

**What goes wrong:** Tests that use the same registry file path interfere with each other. One test's state leaks into another.

**Why it happens:** File-backed persistence writes to a real file. If tests share a path, they share state.

**How to avoid:** Each test (or test suite) should use a unique temp directory. Vitest provides no built-in temp dir, but Node.js `os.tmpdir()` + `fs.mkdtempSync()` work. Use `afterEach` or `afterAll` to clean up temp directories.

```typescript
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'axon-registry-test-'))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

it('persists and reloads', () => {
  const filePath = join(tempDir, 'registry.json')
  const registry = new AxonRegistry(filePath)
  // ... test ...
})
```

**Warning signs:** Tests passing individually but failing when run together; `ENOENT` or stale data errors.

---

## Code Examples

Verified patterns from official sources and established project conventions:

### NPI Validation -- Complete Implementation

```typescript
// src/registry/npi.ts
// Source: CMS NPI check digit specification
// Verified against: https://www.eclaims.com/articles/how-to-calculate-the-npi-check-digit/
// and https://www.stedi.com/docs/healthcare/national-provider-identifier

/**
 * Validate an NPI number using the Luhn check digit algorithm
 * with the 80840 prefix (represented by constant 24).
 *
 * @param npi - The NPI string to validate
 * @returns true if the NPI is valid (10-digit, passes Luhn check)
 */
export function validateNPI(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) {
    return false
  }

  let sum = 24
  const digits = npi.split('').map(Number)
  const checkDigit = digits[9]!

  for (let i = 8; i >= 0; i--) {
    let digit = digits[i]!
    if ((8 - i) % 2 === 0) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }
    sum += digit
  }

  const expected = (10 - (sum % 10)) % 10
  return checkDigit === expected
}
```

### NPI Validation Test Suite

```typescript
// test/npi.test.ts
import { describe, it, expect } from 'vitest'
import { validateNPI } from '../src/registry/npi.js'

describe('validateNPI', () => {
  // Known valid NPIs (CMS example and generated)
  it.each([
    '1234567893',   // CMS standard example
    '1245319599',   // Common test NPI
    '1114025222',   // Another known valid NPI
  ])('returns true for valid NPI "%s"', (npi) => {
    expect(validateNPI(npi)).toBe(true)
  })

  // Invalid format
  it.each([
    '',              // empty
    '12345',         // too short
    '12345678901',   // too long
    '123456789a',    // non-numeric
    'abcdefghij',    // all letters
    '123 456 789',   // spaces
  ])('returns false for invalid format "%s"', (npi) => {
    expect(validateNPI(npi)).toBe(false)
  })

  // Valid format but failing Luhn check
  it.each([
    '1234567890',   // wrong check digit
    '1234567891',   // wrong check digit
    '1234567892',   // wrong check digit
    '1111111111',   // all ones, wrong check digit
    '0000000000',   // all zeros
  ])('returns false for NPI failing Luhn check "%s"', (npi) => {
    expect(validateNPI(npi)).toBe(false)
  })
})
```

### Atomic Persistence Test Pattern

```typescript
// test/registry-persistence.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AxonRegistry } from '../src/registry/registry.js'

describe('AxonRegistry persistence', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'axon-registry-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('creates registry file on first registration', () => {
    const filePath = join(tempDir, 'registry.json')
    const registry = new AxonRegistry(filePath)

    registry.registerProvider({
      npi: '1234567893',
      name: 'Dr. Jane Smith',
      provider_types: ['physician'],
    })

    expect(existsSync(filePath)).toBe(true)
  })

  it('reloads state after restart', () => {
    const filePath = join(tempDir, 'registry.json')

    // First instance: register a provider
    const registry1 = new AxonRegistry(filePath)
    registry1.registerProvider({
      npi: '1234567893',
      name: 'Dr. Jane Smith',
      provider_types: ['physician'],
    })

    // Second instance: load from same file
    const registry2 = new AxonRegistry(filePath)
    const entry = registry2.findByNPI('1234567893')

    expect(entry).toBeDefined()
    expect(entry!.name).toBe('Dr. Jane Smith')
  })

  it('persisted JSON is valid and readable', () => {
    const filePath = join(tempDir, 'registry.json')
    const registry = new AxonRegistry(filePath)

    registry.registerProvider({
      npi: '1234567893',
      name: 'Dr. Jane Smith',
      provider_types: ['physician'],
    })

    const raw = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed.version).toBe('1.0.0')
    expect(parsed.entries['1234567893']).toBeDefined()
  })
})
```

### Registry Types Export Pattern

```typescript
// Addition to src/types/index.ts
import type { Static } from '@sinclair/typebox'
import type {
  RegistryEntrySchema,
  NeuronEndpointSchema,
  CredentialRecordSchema,
  OrganizationAffiliationSchema,
  CredentialStatusSchema,
  VerificationSourceSchema,
  EntityTypeSchema,
  RegistrySearchQuerySchema,
} from '../registry/schemas.js'

export type RegistryEntry = Static<typeof RegistryEntrySchema>
export type NeuronEndpoint = Static<typeof NeuronEndpointSchema>
export type CredentialRecord = Static<typeof CredentialRecordSchema>
export type OrganizationAffiliation = Static<typeof OrganizationAffiliationSchema>
export type CredentialStatus = Static<typeof CredentialStatusSchema>
export type VerificationSource = Static<typeof VerificationSourceSchema>
export type EntityType = Static<typeof EntityTypeSchema>
export type RegistrySearchQuery = Static<typeof RegistrySearchQuerySchema>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| External NPI validation libraries | Pure function with Luhn algorithm | Always (it's 15 lines) | Zero dependency; full control; trivial to test |
| `write-file-atomic` npm package | Manual writeFileSync + renameSync | Project constraint (zero deps) | 5 lines of code vs. a dependency; same guarantees on POSIX |
| Database-backed registries | In-memory Map + JSON file | v1 design decision | Simpler for development; no DB setup; human-readable persistence |
| Static singleton class | Instance class with file path | Phase 3 design (mutable state) | Supports testing with isolated state; multiple registries possible |
| Async file operations | Synchronous file operations | v1 simplicity decision | No race conditions; simpler error handling; acceptable for dev-scale data |

**Deprecated/outdated:**
- `fs.existsSync()` was briefly deprecated in Node.js but has been un-deprecated since Node.js 10+. It is safe to use in Node.js 22.
- `crypto.randomUUID()` was added in Node.js 14.17 and is stable in Node.js 22. No polyfill needed.

---

## Open Questions

1. **Credential status derivation rule**
   - What we know: Both the RegistryEntry and individual CredentialRecords have a `status` field. The PRD shows them as independent.
   - What's unclear: Whether the top-level `credential_status` should be automatically derived from individual credential statuses, or independently managed.
   - Recommendation: Independently managed for v1. The top-level status is set to `'pending'` at registration and updated via explicit API call. This is simpler and matches the PRD API surface. Document the non-derivation behavior. The planner may choose either approach.

2. **Concurrency during testing**
   - What we know: v1 is single-process with synchronous file I/O. No concurrency issues in production.
   - What's unclear: Whether vitest runs tests in parallel by default (it does within a file with `it.concurrent`, but not across files unless configured).
   - Recommendation: Use separate temp directories per test suite to avoid any file-level contention. Vitest's default is sequential within a test file, so this should be sufficient.

3. **Registry file location convention**
   - What we know: The registry file path is constructor-injected. No default path is mandated.
   - What's unclear: What path Neuron (the primary consumer) will use in practice.
   - Recommendation: The constructor takes a file path; the default can be `./data/registry.json` or a path under `~/.axon/`. This is a consumer-side decision for Phase 5 integration. For Phase 3, tests use temp directories.

4. **Provider type validation at registration**
   - What we know: The `provider_types` field on a registration should reference valid provider type IDs from the taxonomy.
   - What's unclear: Whether `registerProvider()` should cross-validate provider types against `AxonTaxonomy.getProviderTypes()`.
   - Recommendation: Yes, validate. This mirrors the cross-validation pattern from Phase 2 (questionnaires validate action IDs against taxonomy). It catches typos early.

---

## Sources

### Primary (HIGH confidence)
- CMS NPI check digit specification via https://www.eclaims.com/articles/how-to-calculate-the-npi-check-digit/ -- Step-by-step Luhn algorithm with 80840 prefix and constant 24
- CMS NPI validation via https://www.stedi.com/docs/healthcare/national-provider-identifier -- Confirmed algorithm with worked example (123456789 -> check digit 3)
- Node.js fs module documentation (https://nodejs.org/api/fs.html) -- writeFileSync, renameSync, existsSync, mkdirSync APIs
- Existing codebase: `src/taxonomy/schemas.ts`, `src/taxonomy/loader.ts`, `src/taxonomy/taxonomy.ts` -- established TypeBox schema, loader, and class patterns
- PRD.md section 2.1.3 -- exact data model interfaces for RegistryEntry, NeuronEndpoint, CredentialRecord, OrganizationAffiliation
- Phase 1 research (`.planning/phases/01-package-foundation-and-clinical-action-taxonomy/01-RESEARCH.md`) -- TypeBox patterns, project conventions
- Phase 2 research (`.planning/phases/02-questionnaire-repository/02-RESEARCH.md`) -- Cross-validation pattern, loader pattern

### Secondary (MEDIUM confidence)
- Wikipedia: National Provider Identifier (https://en.wikipedia.org/wiki/National_Provider_Identifier) -- NPI structure, 80840 prefix meaning, Luhn algorithm context
- npm write-file-atomic (https://www.npmjs.com/package/write-file-atomic) -- Confirmed atomic write pattern (write temp + rename); our manual implementation follows the same approach without the dependency
- w3resource Luhn algorithm exercise (https://www.w3resource.com/javascript-exercises/fundamental/javascript-fundamental-exercise-80.php) -- JavaScript implementation reference

### Tertiary (LOW confidence)
- None -- all claims verified against primary or secondary sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new packages; reuses Phase 1/2 stack entirely; only Node.js built-ins added
- Architecture patterns: HIGH -- instance class is the natural fit for mutable state; persistence pattern is well-established (writeFileSync + renameSync)
- NPI validation: HIGH -- algorithm verified against CMS specification and multiple authoritative sources; worked example confirmed
- Registry data model: HIGH -- directly from PRD section 2.1.3; TypeBox translation is mechanical
- Search implementation: HIGH -- linear scan with filter predicates is straightforward; no algorithmic complexity
- Pitfalls: HIGH -- most derive from known TypeScript strict mode behaviors (already encountered in Phase 1/2) and standard file I/O patterns

**Research date:** 2026-02-22
**Valid until:** 2026-04-22 (no external dependencies to go stale; validity tied to Node.js 22 built-in API stability and TypeBox 0.34.x stability)
