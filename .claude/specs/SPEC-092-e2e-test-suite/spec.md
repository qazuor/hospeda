# SPEC-092: End-to-End Test Suite for Pre-Beta Validation

> **Status**: completed (with operational carve-out → SPEC-121)
> **Priority**: P0 (blocker for beta launch)
> **Complexity**: High
> **Created**: 2026-04-26
> **Last revised**: 2026-05-14
> **Completed**: 2026-05-14
> **Type**: testing-infrastructure
> **Breaking change**: No (additive)
> **Closure note**: 94/99 tasks closed. All code work is done — 55 e2e test files in `apps/e2e/tests/` on origin/staging, CI workflows shipped. The 5 remaining items are operational (NOT code work) and have been carved out to **SPEC-121** (e2e-mp-secrets-and-nightly-reactivation): T-001/T-002 (MercadoPago sandbox account + GitHub Secrets), T-096/T-097 (nightly cron re-enable post-SPEC-103 + 7-night flake measurement + quarantine list), T-099 (close-out admin). See engram observation `spec/hospeda/SPEC-092/status` for full audit trail.

---

## Problem Statement

Hospeda has unit tests, integration tests, and per-app component tests, but no cross-app end-to-end coverage validating real user journeys. Before opening to beta testers (10-30 hosts paying real money, 100-300 guests), we need automated proof that:

1. The full host lifecycle works: signup, onboarding, publish, upgrade via MercadoPago, downgrade, addons.
2. The full accommodation lifecycle works across apps: a host publishing in admin must be discoverable in web within seconds, edits must propagate, deletions must clean up Cloudinary assets.
3. Cross-actor isolation holds: Host A cannot read or modify Host B's data, guests cannot reach admin endpoints, trial users cannot bypass paywalls via direct API calls.
4. Discovery flows work for anonymous and authenticated guests across i18n locales.
5. The system is resilient to partial failures: API down during checkout doesn't duplicate subscriptions, webhook retries are idempotent, Cloudinary timeouts don't leave orphan metadata.

---

## Philosophy: Real Tests, Real System

Every E2E test must run **the full real system**, as close as possible to a real user's experience:

- **Real DB** (Postgres dedicated, no mocks, no in-memory)
- **Real apps** (`pnpm build && pnpm preview`, not dev server)
- **Real HTTP** between admin ↔ api ↔ web
- **Real browser** (Chromium via Playwright)
- **Real emails** captured by Mailpit (not mocked)
- **Real Cloudinary** for `@cloudinary` tagged tests (folder `hospeda/e2e/{run-id}/`)
- **Real MercadoPago sandbox** for HOST-02 (the "real-real" test)

**Mocks ONLY where physically impossible to run real**:

| Cannot run real | Why | Substitute |
|---|---|---|
| MP webhook callback inbound in CI | No ngrok = no public URL | Test simulates webhook with signed POST to real API endpoint after checkout |
| QZPay edge cases (timeout, 500, partial failure) | Sandbox doesn't return these on demand | `vi.mock` + test-only flag in adapter (HOST-07 only) |

Everything else: **real**.

---

## Goals and Non-Goals

### Goals

- Validate 31 E2E user journeys + 6 resilience tests across 8 categories.
- Cover 7 integration tests reincorporated for security/transaction validation.
- 3 CI scripts for SEO/sitemap/raw-ilike validation.
- Document 26 owner-manual items in Spanish for non-technical pre-release QA.
- Run fast subset (P0) on every PR (~5 min, 4 workers).
- Run full suite (P0+P1+RES) nightly (~30 min, 2 workers).
- Provide reproducible local execution with cleanup between tests.

### Non-Goals (Out of Scope)

- Unit tests, component tests, or stand-alone integration tests not listed in §G.
- Visual regression testing (Percy / Chromatic).
- Load testing or performance benchmarking.
- Accessibility audits as a CI gate (manual only).
- Production smoke tests (deferred to observability spec).
- Booking flow tests (Hospeda is discovery + contact only).
- WebSocket / real-time tests (no real-time features in MVP).
- ngrok-based webhook testing in CI (validated manually in staging instead).
- REV-01 / REV-02 review tests (host_response + post-contact gating are post-beta features).

---

## Scope Summary

| Category | Items | Location |
|---|---|---|
| **A. E2E tests** | 37 | `apps/e2e/tests/` |
| **B. Integration tests** | 7 | `apps/api/test/integration/security/` + 1 in `packages/service-core/test/integration/` |
| **C. CI scripts** | 3 | `scripts/ci/` |
| **D. Documentation** | 4 docs | `docs/deployment/` |
| **E. Infra changes** | 5 | apps/e2e/, packages/media, apps/api |
| **F. Revalidation gaps fix** | 4 | packages/service-core/, packages/db/ |
| **G. CI workflows** | 2 | `.github/workflows/` |

**Total tests (E2E + integration)**: 44

---

## A. E2E Tests (`apps/e2e/`) — 37 tests

### Tag Vocabulary

| Tag | Meaning |
|---|---|
| `@p0` | Blocker for beta. Runs on every PR. |
| `@p1` | High priority. Nightly only. |
| `@host` `@guest` `@admin` | Actor focus |
| `@billing` `@onboarding` `@accommodation` | Feature focus |
| `@cross-app` | 2+ apps in same run |
| `@cache` | ISR / cache invalidation |
| `@cloudinary` | Real Cloudinary uploads |
| `@real-payment` | Real MP sandbox (HOST-02 only) |
| `@i18n` | Locale switching |
| `@security` | Authorization, isolation, paywall |
| `@messaging` | SPEC-085 conversation system |
| `@resilience` | Failure paths, idempotency, compensation |

### Catalog

#### HOST (7 tests)

| ID | Title | P | Real-stack matrix |
|---|---|---|---|
| HOST-01 | Web→admin onboarding handoff with atomic role promotion + first publish | P0 | DB ✅, Browser ✅, Apps ✅, Mailpit ✅ |
| HOST-02 | **Trial → upgrade to paid plan via MP sandbox real** | P0 | DB ✅, Browser ✅, Apps ✅, **MP sandbox ✅**, webhook simulado |
| HOST-03 | Trial expiration blocks writes, preserves reads | P0 | DB ✅ (force expired), Browser ✅, Apps ✅ |
| HOST-04 | Paid plan cancellation, grace period, expiration | P0 | DB ✅, Browser ✅, webhook simulado |
| HOST-05 | Addon purchase activates feature immediately | P0 | DB ✅, Browser ✅, webhook simulado |
| HOST-06 | Password reset flow | P1 | DB ✅, Browser ✅, **Mailpit real** |
| HOST-07 | Onboarding edge cases (idempotency, compensation, cron demote) | P0 | DB ✅, Browser ✅, **mock QZPay vía test-only flag** |

#### ACC (4 tests)

| ID | Title | P | Real-stack matrix |
|---|---|---|---|
| ACC-01 | Host publishes, guest discovers via search | P0 | DB ✅, 2 browser contexts, **Cloudinary real** |
| ACC-02 | Host edit propagates to web (real revalidation) | P0 | DB ✅, 2 browser contexts, RevalidationService spy |
| ACC-03 | Host unpublishes — accommodation disappears | P0 | DB ✅, 2 browser contexts |
| ACC-04 | Soft delete cleans up Cloudinary assets | P0 | DB ✅, **Cloudinary real (verifies delete)** |

#### GUEST (3 tests)

| ID | Title | P | Real-stack matrix |
|---|---|---|---|
| GUEST-01 | Search, filter, paginate, view detail | P0 | DB ✅ (seed), Browser ✅ |
| GUEST-02 | i18n locale switching across pages | P0 | Browser ✅ (es/en/pt) |
| GUEST-03 | Guest registration and favorites persistence | P0 | DB ✅, Browser ✅, **Mailpit real** |

#### SEC (3 tests)

| ID | Title | P | Real-stack matrix |
|---|---|---|---|
| SEC-01 | Host A cannot access Host B's resources | P0 | DB ✅, Browser ✅ + HTTP |
| SEC-02 | Common guest cannot reach admin surfaces | P0 | DB ✅, Browser ✅ |
| SEC-03 | Trial host cannot bypass paywall via direct API | P0 | DB ✅, HTTP only |

#### MSG (1 test)

| ID | Title | P | Real-stack matrix |
|---|---|---|---|
| MSG-01 | Guest contacts host, host replies, guest sees response | P1 | DB ✅, 2 browser contexts, **Mailpit real (notifications)** |

#### ADM (4 tests)

| ID | Title | P | Real-stack matrix |
|---|---|---|---|
| ADM-01 | Super-admin moderates reported content | P1 | DB ✅, Browser ✅ |
| ADM-02 | Super-admin views billing metrics dashboard | P1 | DB ✅ (seed), Browser ✅ |
| ADM-03 | Super-admin user management — suspend and reactivate | P1 | DB ✅, 2 browser contexts |
| ADM-04 | Super-admin manages plans and addons | P1 | DB ✅, Browser ✅ |

#### SPEC-096 cross-app (9 tests)

| ID | Title | P |
|---|---|---|
| E2E-1 | Anonymous browse → search → results → detail → contact form | P0 |
| E2E-2 | Signup → onboarding → publish → mi-cuenta/propiedades visible | P0 |
| E2E-3 | Authenticated favorite toggle round-trip | P0 |
| E2E-5 | Profile edit on web → admin reflects | P0 |
| E2E-6 | Profile edit on admin → web reflects | P0 |
| E2E-7 | Theme toggle isolation (web vs admin themeAdmin) | P1 |
| E2E-8 | Subscription cancel flow → status update → email sent | P0 |
| E2E-9 | 404 on broken link + zero broken links regression | P0 |
| E2E-10 | Filter sub-route → ISR cache hit on second visit | P1 |

> Note: E2E-4 (review submission) was removed because reviews are post-beta.

#### Resilience (6 tests, all P0)

| ID | Title |
|---|---|
| RES-01 | API caída durante checkout MP → retry sin duplicar subscription |
| RES-02 | DB connection pool exhausted → 503 (not 500) |
| RES-03 | Cloudinary timeout en upload → estado consistente (sin photo huérfana) |
| RES-04 | Webhook MP duplicado → idempotency, no duplica payment |
| RES-05 | Email Mailpit caído → flujo signup no rompe; user puede pedir reenvío |
| RES-06 | Concurrent edit en mismo accommodation → last-write-wins documentado |

---

## B. Integration Tests Reincorporated (7 tests)

| Item | File |
|---|---|
| SQL injection on filters | `apps/api/test/integration/security/sql-injection.test.ts` |
| CSP headers | `apps/api/test/integration/security/csp-headers.test.ts` |
| Rate limit enforcement | `apps/api/test/integration/security/rate-limit.test.ts` |
| Brute-force login (5 fails → 429) | `apps/api/test/integration/security/brute-force.test.ts` |
| CSRF on mutations | `apps/api/test/integration/security/csrf.test.ts` |
| Soft-deleted resource access (404 public) | `apps/api/test/integration/security/soft-delete-access.test.ts` |
| DB transaction rollback (multi-table atomicity) | `packages/service-core/test/integration/services/transaction-rollback.test.ts` |

All use Vitest + real Postgres (SPEC-061 / SPEC-080 patterns).

---

## C. CI Scripts (3)

| Script | Trigger | Purpose |
|---|---|---|
| `scripts/ci/check-raw-ilike.sh` | Pre-commit + CI | Reject `ilike(` outside `drizzle-helpers.ts` |
| `scripts/ci/seo-validator.ts` | Nightly | Crawl built pages, validate meta + JSON-LD |
| `scripts/ci/sitemap-validator.ts` | Nightly | Validate sitemap.xml + robots.txt |

---

## D. Documentation

| Doc | Location | Language | Action |
|---|---|---|---|
| MP test accounts setup | `docs/deployment/first-time-setup.md` § 1.7.b | Spanish | EXTEND |
| Cloudinary E2E folder + cleanup | `docs/deployment/first-time-setup.md` § 1.5.b | Spanish | EXTEND |
| ngrok manual staging webhook test | `docs/deployment/first-time-setup.md` § 1.7.c | Spanish | EXTEND |
| Owner-manual pre-release checklist (26 items) | `docs/deployment/checklist-pre-release-manual.es.md` | Spanish, non-technical | NEW |
| E2E test authoring contract | `apps/e2e/README.md` | English | NEW |

---

## E. Infrastructure Changes

| Change | File |
|---|---|
| Extend `CloudinaryProvider` with `folderRoot` option | `packages/media/src/server/cloudinary.provider.ts` + tests |
| `docker-compose.e2e.yml` (PG :5433, Redis, Mailpit) | `apps/e2e/docker-compose.e2e.yml` |
| Build-and-preview helper (spawn 3 apps) | `apps/e2e/support/build-and-preview.ts` |
| Cleanup helper (`session_replication_role='replica'`) | `apps/e2e/support/test-cleanup.ts` |
| Cron job: Cloudinary E2E folder cleanup (>7 days) | `apps/api/src/cron/jobs/cloudinary-e2e-cleanup.job.ts` |

---

## F. Revalidation Gaps Fix (pre-test work)

Discovered during audit (2026-04-30). These must land **before** ACC-02 and E2E-10 are written:

| Gap | Action |
|---|---|
| DestinationService missing revalidation hooks | Add `_afterUpdate`, `_afterCreate`, `_afterSoftDelete`, `_afterRestore`, `_afterHardDelete` calls to RevalidationService |
| Home page `/` not revalidated | Add `/` and `/{locale}/` to accommodation/event/post path mappings in `entity-path-mapper.ts` |
| Destination hierarchy reparenting | When destination is reparented, schedule revalidation for descendants + ancestors |
| Test helper `assertRevalidationTriggered` | New helper in `apps/e2e/fixtures/revalidation-spy.ts` for asserting paths revalidated |

---

## G. CI Workflows

### `e2e-pr.yml` (every PR to `main`)

- 4 parallel workers
- Runs: P0 E2E + integration tests + scripts CI quick (`check-raw-ilike.sh`)
- Target wall-clock: < 6 min
- Required check on `main`

### `e2e-nightly.yml` (cron `0 3 * * *`)

- 2 parallel workers (rate-limited externals)
- Runs: P0 + P1 + RES E2E + integration + all scripts + flake report
- Target wall-clock: < 35 min
- Failures notify via existing alert channel

---

## Architecture Decisions

### Package layout — dedicated `apps/e2e/`

```
apps/e2e/
├── playwright.config.ts
├── docker-compose.e2e.yml
├── package.json
├── tests/
│   ├── host/             # 7 tests
│   ├── accommodation/    # 4 tests
│   ├── guest/            # 3 tests
│   ├── security/         # 3 tests
│   ├── messaging/        # 1 test
│   ├── admin/            # 4 tests
│   ├── spec-096/         # 9 tests
│   └── resilience/       # 6 tests
├── fixtures/
│   ├── api-helpers.ts
│   ├── db-helpers.ts
│   ├── mailpit-client.ts
│   ├── mp-webhook-helper.ts
│   ├── cloudinary-client.ts
│   ├── qzpay-test-control.ts
│   └── revalidation-spy.ts
├── seeds/e2e-seed.ts
├── support/
│   ├── build-and-preview.ts
│   └── test-cleanup.ts
└── README.md
```

### Target — build, not dev

`pnpm build && pnpm preview` for every app. Reasons: HMR causes flaky waits, ISR/cache only works with built output, bundles match production.

### Database — dedicated Postgres reset per suite

`docker-compose.e2e.yml` runs PG on :5433 (no collision with dev :5432). Reset (drop + push schema + seed) once per suite. Each test creates and cleans its own per-test data.

### MercadoPago — sandbox real + simulated webhook

PR + nightly: real MP sandbox checkout (Playwright drives the MP sandbox UI), webhook simulated by test (signed POST to real webhook endpoint after checkout completes). The "MP sandbox sends real webhook to our API" path is validated **manually in staging** before each release (documented in `checklist-pre-release-manual.es.md`).

### Cloudinary — folder isolation

`hospeda/e2e/{run-id}/` per test run. Cron `cloudinary-e2e-cleanup.job.ts` removes folders > 7 days as safety net for runs that died before cleanup.

### Revalidation — NoOp adapter + spy

E2E tests use `NoOpRevalidationAdapter` (already in `packages/service-core/src/revalidation/adapters/noop-revalidation.adapter.ts`) to avoid hitting Vercel during tests. Tests spy on `RevalidationService.revalidatePaths` to assert which paths were scheduled. Helper `assertRevalidationTriggered(paths)` simplifies the pattern.

### Reporting

Playwright HTML reporter published as workflow artifact every run. Trace, screenshot, video captured on first retry (not first failure). `pnpm e2e:report` opens local report.

---

## Test Authoring Contract

Every E2E test must:

1. **Be independent**: create its own data, clean up, never rely on side-effects of another test.
2. **Use fixtures**: data setup goes through `fixtures/api-helpers.ts`, never raw setup.
3. **Have explicit timeouts**: every `waitFor` has a max budget; no infinite waits.
4. **Tag correctly**: at least `@p0` or `@p1`, plus actor and feature tags.
5. **Document preconditions**: required seed state in test docblock.
6. **Run locally**: `pnpm e2e:test path/to/test.spec.ts` works in isolation.
7. **Not skip silently**: `test.fixme(condition, reason)` with explicit reason + TODO link, never bare `test.skip()`.

---

## Implementation Phases

Tasks atomized via `task-master:task-from-spec`. Complexity ceiling: **3** for every task.

### Phase 0 — External setup (manual, by owner)

- O.1 Create MP sandbox account + application + seller test account at developers.mercadopago.com.ar
- O.2 Save MP creds in GitHub Secrets

### Phase 1 — Documentation (Spanish)

- D.1 Extend `first-time-setup.md` § 1.7.b (MP test accounts)
- D.2 Extend `first-time-setup.md` § 1.5.b (Cloudinary E2E folder)
- D.3 Extend `first-time-setup.md` § 1.7.c (ngrok manual staging webhook test)
- D.4 Create `checklist-pre-release-manual.es.md` (26 items, non-technical Spanish)
- D.5 Create `apps/e2e/README.md` (test authoring contract, English)

### Phase 2 — Revalidation gaps fix (pre-requisite for ACC-02 / E2E-10)

- F.1 Add revalidation hooks to DestinationService
- F.2 Add `/` home page to accommodation/event/post path mappings
- F.3 Implement destination hierarchy revalidation (reparenting)
- F.4 Create `assertRevalidationTriggered` test helper

### Phase 3 — Infrastructure (no tests yet)

- I.1 Scaffold `apps/e2e/` (package.json, tsconfig, playwright.config.ts)
- I.2 Extend `CloudinaryProvider` with `folderRoot` option + unit tests
- I.3 Author `docker-compose.e2e.yml` (PG :5433, Redis, Mailpit)
- I.4 Build-and-preview helper
- I.5 Cleanup helper (`session_replication_role` bypass)
- I.6 Fixture: `api-helpers.ts`
- I.7 Fixture: `db-helpers.ts`
- I.8 Fixture: `mailpit-client.ts`
- I.9 Fixture: `mp-webhook-helper.ts`
- I.10 Fixture: `cloudinary-client.ts`
- I.11 Fixture: `qzpay-test-control.ts` + adapter test-only flag
- I.12 Seed `e2e-seed.ts` (25+ accommodations, plans, super-admin, destinations)
- I.13 Cron `cloudinary-e2e-cleanup.job.ts`
- I.14 CI workflow skeleton (`e2e-pr.yml` + `e2e-nightly.yml`)

### Phase 4 — P0 E2E (16 tests)

- T-HOST-01..07
- T-SEC-01..03
- T-ACC-01..04
- T-GUEST-01..03

### Phase 5 — P1 + SPEC-096 (15 tests)

- T-HOST-06
- T-MSG-01
- T-ADM-01..04
- T-E2E-1, 2, 3, 5, 6, 7, 8, 9, 10

### Phase 6 — Resilience (6 tests)

- T-RES-01..06

### Phase 7 — Integration tests reincorporated (7 tests)

- IT-1..7

### Phase 8 — CI scripts (3 scripts)

- S.1 `check-raw-ilike.sh`
- S.2 `seo-validator.ts`
- S.3 `sitemap-validator.ts`

### Phase 9 — Burn-in stabilization

- 7 nightly runs consecutivos
- Quarantine de tests > 2% flake rate
- Documentar contrato definitivo

---

## Acceptance Criteria

- [ ] `apps/e2e/` package scaffolded with Playwright, Docker Compose, fixtures, seed.
- [ ] PR workflow runs P0 with mocks, < 6 min, required check on `main`.
- [ ] Nightly workflow runs P0+P1+RES with MP sandbox + Cloudinary, < 35 min, alerts on failure.
- [ ] All 37 E2E tests authored and passing in 7 consecutive nightly runs (flake rate < 2%).
- [ ] All 7 integration tests passing in CI.
- [ ] All 3 CI scripts wired and passing.
- [ ] All 4 docs published in Spanish.
- [ ] Revalidation gaps F.1–F.4 fixed and verified.
- [ ] Cleanup verified: no leftover users, accommodations, Cloudinary assets, MP customers after a full suite run.
- [ ] No test uses `.only()` or bare `.skip()` (CI enforces).

---

## Dependencies

- **SPEC-085** (Guest-Owner Messaging): MSG-01 depends on it. Already implemented and archived.
- **SPEC-078** (Cloudinary Image Management): ACC-01, ACC-04, HOST-05 rely on Cloudinary cleanup hooks. Already implemented.
- **SPEC-061** (DB Integration Testing): infrastructure reused for integration tests in §B. Already shipped.
- **SPEC-080** (Service Integration Tests): pattern reused for `transaction-rollback.test.ts`. Already shipped.

External:

- GitHub Actions
- MercadoPago sandbox account (Phase 0)
- Cloudinary current account (no new account needed)

---

## Risks

| Risk | Mitigation |
|---|---|
| MP sandbox flakiness | Retries x2 with backoff; isolate `@real-payment` failures |
| Cloudinary quota | Folder isolation + cron cleanup; monthly usage alert |
| ISR cache timing variation | Spy on RevalidationService instead of measuring real cache |
| Test rot as features evolve | Test authoring contract + Phase 9 burn-in metric |
| Build time for 3 apps in CI | Cache `node_modules` + `.turbo`, parallelize builds |
| Revalidation gaps in production | Phase 2 fixes them before any test relies on them |

---

## References

- SPEC-085 (Messaging) — completed
- SPEC-078 (Cloudinary) — completed
- SPEC-061 (DB Integration Testing) — completed
- SPEC-080 (Service Integration Tests) — completed
- ADR-007 (Vercel Deployment)
- `docs/deployment/first-time-setup.md` — Phase 1 external service accounts
- `packages/service-core/src/revalidation/` — RevalidationService
- `packages/billing/src/adapters/mercadopago.ts` — QZPay adapter
- `packages/media/src/server/cloudinary.provider.ts` — Cloudinary integration
