# Milestones

## v1.0 Initial Release (Shipped: 2026-02-22)

**Delivered:** Complete network foundation layer for the CareAgent ecosystem — registry, broker, taxonomy, questionnaires, mock server, and documentation.

**Phases completed:** 7 phases (1, 2, 3, 4, 5, 5.1, 6), 18 plans
**Stats:** 93 commits, 175 files, 6,229 LOC TypeScript, 231 tests passing, 0 runtime deps
**Timeline:** 4 days (2026-02-19 → 2026-02-22), ~1 hour execution time
**Audit:** 41/41 requirements satisfied, 12/12 integrations wired, 4/4 E2E flows complete

**Key accomplishments:**
- Clinical action taxonomy: 61 actions under 7 atomic categories mapped to 49 provider types via versioned JSON
- Conditional questionnaire system: Full Physician questionnaire with surgical/academic branching and 48 provider stubs
- NPI-keyed provider registry: File-backed storage with Luhn validation, credential management, and multi-field search
- Ed25519 connection broker: Stateless handshake pipeline with replay protection and hash-chained audit trail
- Consumer integration surface: Multi-entry subpath exports, mock HTTP server with 8 routes, compatibility matrix
- Documentation suite: Architecture guide, 5 protocol specs, taxonomy/questionnaire authoring guides, governance model, CONTRIBUTING.md

**Tech debt carried forward:**
- README.md physician question count says "12" (actual: 13)
- docs/questionnaire-authoring.md physician question count says "12" (actual: 13)
- README.md `new AxonRegistry()` example missing required `filePath` argument

**Archive:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`, `.planning/milestones/v1.0-MILESTONE-AUDIT.md`

---

## Standalone Server Deployment (Shipped: 2026-02-22, out-of-band)

**Delivered:** Production HTTP server for VPS deployment, enabling Neuron instances to register providers, send heartbeats, and broker connections over the network.

**Implemented outside GSD workflow** — recorded here for continuity.

**What was built:**
- `src/server/index.ts` — Production HTTP server with all routes matching neuron AxonClient contract (register, heartbeat, provider CRUD, search, taxonomy, questionnaires, connect)
- `src/server/tokens.ts` — `PersistentTokenStore` with atomic JSON persistence and bearer token authentication
- `src/server/standalone.ts` — Entry point with env var config (`AXON_PORT`, `AXON_HOST`, `AXON_DATA_DIR`), graceful shutdown
- `Dockerfile` — Multi-stage build (Node 22 Alpine, non-root user, healthcheck)
- `docker-compose.yml` — Axon + Caddy services with persistent volumes
- `Caddyfile` — TLS reverse proxy with security headers
- `.github/workflows/ci.yml` — Build + test on push/PR
- `.github/workflows/publish.yml` — Publish to GitHub Packages on v* tags
- `test/server.test.ts` — 22 new tests (CORS, auth, all routes, persistence, shutdown)

**Stats:** Version bumped 0.1.0 → 1.0.0, 253 tests passing (231 + 22 new), commit `21d88ba`

**Config changes:** tsdown entry points, package.json (bin, start, exports, publishConfig), .npmrc, .gitignore

---

