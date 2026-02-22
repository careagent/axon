# Roadmap: @careagent/axon

## Milestones

- ✅ **v1.0 Initial Release** — Phases 1-6 (shipped 2026-02-22)
- ✅ **v1.0 Standalone Server Deployment** — Out-of-band (shipped 2026-02-22)

## Phases

<details>
<summary>✅ v1.0 Initial Release (Phases 1-6) — SHIPPED 2026-02-22</summary>

- [x] Phase 1: Package Foundation and Clinical Action Taxonomy (3/3 plans) — completed 2026-02-21
- [x] Phase 2: Questionnaire Repository (3/3 plans) — completed 2026-02-21
- [x] Phase 3: Registry and Credentials (2/2 plans) — completed 2026-02-22
- [x] Phase 4: Protocol Specification and Connection Broker (3/3 plans) — completed 2026-02-22
- [x] Phase 5: Client Facade, Package Exports, and Integration (3/3 plans) — completed 2026-02-22
- [x] Phase 5.1: Mock Server HTTP Route Completeness (1/1 plan) — completed 2026-02-22
- [x] Phase 6: Documentation and Release (3/3 plans) — completed 2026-02-22

**Total:** 7 phases, 18 plans, 41/41 requirements satisfied

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ Standalone Server Deployment — SHIPPED 2026-02-22 (out-of-band)</summary>

Implemented outside GSD workflow. Deployed Axon as a public HTTP service on VPS.

- [x] Production server (`src/server/`) — HTTP server, persistent token store, standalone entry point
- [x] Build config — tsdown entry points, package.json bin/start/exports, .npmrc, .gitignore
- [x] Docker deployment — multi-stage Dockerfile, docker-compose.yml with Caddy TLS proxy, Caddyfile
- [x] GitHub Actions — CI workflow (build+test on push/PR), publish workflow (v* tag → GitHub Packages)
- [x] Server tests — 22 new tests (health, CORS, auth, all routes, persistence, graceful shutdown)
- [x] Version bump — 0.1.0 → 1.0.0

**Commit:** `21d88ba` on main
**Tests:** 253 total (231 existing + 22 new), all passing

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Package Foundation and Clinical Action Taxonomy | v1.0 | 3/3 | Complete | 2026-02-21 |
| 2. Questionnaire Repository | v1.0 | 3/3 | Complete | 2026-02-21 |
| 3. Registry and Credentials | v1.0 | 2/2 | Complete | 2026-02-22 |
| 4. Protocol Specification and Connection Broker | v1.0 | 3/3 | Complete | 2026-02-22 |
| 5. Client Facade, Package Exports, and Integration | v1.0 | 3/3 | Complete | 2026-02-22 |
| 5.1. Mock Server HTTP Route Completeness | v1.0 | 1/1 | Complete | 2026-02-22 |
| 6. Documentation and Release | v1.0 | 3/3 | Complete | 2026-02-22 |
| Standalone Server Deployment | out-of-band | — | Complete | 2026-02-22 |
