# SPEC-020 Gaps Remediation Tasks

Total: 17 | Completed: 17 | Progress: 17/17 ✅ DONE

## P1-infra-ci (Fase 1 — Infraestructura y CI/CD)

- [x] G-001: Fix env var prefixes in web/logger.ts and astro.config.mjs (complexity: 2)
- [x] G-002: Enable Sentry source maps upload in Web app (complexity: 2)
- [x] G-003: Add VITE_SENTRY_DSN to apps/admin/.env.example (complexity: 1)
- [x] G-004: Add post-deploy health check step to cd-production.yml (complexity: 2)
- [x] G-005: Add pnpm deploy:* scripts to root package.json (complexity: 2)
- [x] G-006: Complete turbo.json globalEnv with missing vars (complexity: 1)
- [x] G-007: Convert .then() to async/await in API error handlers (complexity: 2)

## P2-test-repair (Fase 2 — Reparación del Test Suite)

- [x] G-008: Add lint rule to prevent .only() and hard-coded .skip() in CI (complexity: 2)
- [x] G-009: Fix real-user-scenarios.test.ts — correct routes and assertions (complexity: 4)

## P3-coverage-thresholds (Fase 3 — Coverage Thresholds)

- [x] G-010: Add coverage thresholds to all vitest.config.ts files in the monorepo (complexity: 3)

## P4-package-tests (Fase 4 — Tests para Packages sin Cobertura)

- [x] G-011: Add tests to packages/ai-image-generation (complexity: 4)
- [x] G-012: Add tests to packages/seed (complexity: 3)
- [x] G-013: Add tests to packages/tailwind-config and packages/typescript-config (complexity: 2)

## P5-type-safety (Fase 5 — Type Safety: as any cleanup)

- [x] G-014: Fix as any in API middlewares and utilities (complexity: 3)

## P6-new-specs (Fase 6 — Nuevas SPECs para trabajo de mayor envergadura)

- [x] G-015: Create SPEC-039: Type Safety Audit — as unknown as X double cast (complexity: 2)
- [x] G-016: Create SPEC-040: Critical Package Coverage — auth-ui, billing, logger, email (complexity: 2)
- [x] G-017: Create SPEC-041: Admin Integration Tests (complexity: 2)

---

## Out of Scope

- **GAP-020-010**: Descartado — route-factory.ts 519 líneas (19 sobre límite no justifica el esfuerzo)
- **GAP-020-013**: Descartado — remote image patterns se agregan cuando se necesite CDN
- **GAP-020-022**: Delegado a SPEC-025 — staging branch ya cubierto en SPEC-025-staging-environment-setup

## New SPECs Generated

- **SPEC-039**: Type Safety Audit — as unknown as X double cast (.claude/specs/SPEC-039-type-safety-double-cast/)
- **SPEC-040**: Critical Package Coverage (.claude/specs/SPEC-040-critical-package-coverage/)
- **SPEC-041**: Admin Integration Tests (.claude/specs/SPEC-041-admin-integration-tests/)
