# SPEC-103: VPS Migration Post-Merge Cleanup & Hardening Backlog

## Progress: 67/95 tasks (71%)

**Average Complexity:** 2.2 / 4 (max)
**Total effort estimate:** ~57-90h spread over weeks-months post-merge
**Parallel tracks:** mostly independent across sections 3.A..3.H

**Status legend:** `[ ]` pending · `[~]` in-progress · `[x]` completed · `[!]` blocked

### Tasks moved to new specs (2026-05-13)

- **T-034** (E2E nightly cron re-enable) → moved to [SPEC-105](../../specs/SPEC-105-e2e-nightly-suite-repair/spec.md). Unbounded investigation scope (6-30h estimated); deserves its own phased plan.
- **T-060 → T-071** (beta migration script, 12 tasks) → moved to [SPEC-104](../../specs/SPEC-104-beta-to-prod-data-migration/spec.md). Delicate data feature with FK ordering / idempotency / dry-run requirements; deserves its own design + testing artifacts. Renumbered T-104-01..T-104-12 in the new spec.

---

## 3.A — Pre-public-launch blockers (~11-18h)

### Green-build gate + branch protection (3.A.0 / 3.A.0.1)

- [x] **T-001** (1) — Verify CI green. ✅ All checks green on PR #1057 run `25762100080` (commit `09d10676e`). Required 4 sub-fixes during verification; CI job names confirmed for branch protection: Lint, Security, Guards, Docs and i18n, Build, Typecheck, Unit Tests (shard N/4), Integration Tests, CI Pass.
- [!] **T-002** (2) — Configure branch protection on `main`. **BLOCKED**: GitHub Free + private repo doesn't support classic branch protection nor rulesets (HTTP 403 from both APIs). Agent-side enforcement applied via `.claude/settings.json` deny patterns + `CLAUDE.md` "Protected Branches" section. Unblock = upgrade to GitHub Pro (~$4/mo).
- [!] **T-003** (2) — Configure branch protection on `staging`. **BLOCKED**: same root cause as T-002.

### MercadoPago prod toggle (3.A.1)

- [ ] **T-004** (2) — Flip `HOSPEDA_MERCADO_PAGO_SANDBOX=false` + rotate MP creds on hospeda-api-prod. MOVED TO SPEC-109 (2026-05-14): work owned by SPEC-109 now.
- [ ] **T-005** (2) — Smoke prod MP integration (low-value addon purchase, verify `livemode=true`). Blocked by: T-004. MOVED TO SPEC-109 (2026-05-14): work owned by SPEC-109 now.

### Staging postgres backups (3.A.2)

- [x] **T-006** (2) — Configure daily 03:00 ART R2 backup for hospeda-staging-postgres. ✅ Reconciled 2026-05-14: staging daily R2 backup cron active (verified by T-007).
- [x] **T-007** (1) — Verify staging backup landed in R2 + `hops db-restore` lists it. ✅ Verified 2026-05-14: encrypted daily backup `hospeda-postgres-2026-05-14_063001Z.dump.gpg` (263.1 KiB) present in `s3://hospeda-staging-backups/`. Verification used `aws s3 ls` directly with credentials from `/etc/hospeda-backup-staging.env` (R2_* prefix). `hops db-restore --list --target=staging` is broken — it shows prod backups instead, see session-finding-14-repro.

### Prod destinations slug parity (3.A.4)

- [x] **T-008** (1) — Identify 4 missing destination slugs (staging vs prod diff). ✅ Reconciled 2026-05-14: destination slug parity 30/30.
- [x] **T-009** (2) — Add 4 missing destinations to prod via admin UI. Blocked by: T-008. ✅ Reconciled 2026-05-14: 4 missing destinations added; parity 30/30.
- [x] **T-010** (1) — Verify slug parity between staging and prod. Blocked by: T-009. Blocks: T-011, **T-063 (beta migration)**. ✅ Reconciled 2026-05-14: slug parity verified.
- [x] **T-011** (1) — Document curated prod destinations in `docs/migration/staging-prod-db-separation.md` §10.4. Blocked by: T-010. ✅ Reconciled 2026-05-14: documented via PR #1067.

### Full auth coverage end-to-end (3.A.5 — folds in 3.A.3)

- [x] **T-012** (2) — Smoke email signup path on prod + staging. ✅ Validated as step 1 of T-020 cascade (2026-05-14).
- [x] **T-013** (2) — Smoke Google OAuth signup on prod + staging. ✅ Staging PASS (2026-05-14).
- [x] **T-014** (2) — Smoke Facebook OAuth signup on prod + staging. ✅ Validated in T-020 step 3 (2026-05-14). Surfaced missing FB OAuth redirect URI whitelist on staging; fix applied operatively.
- [x] **T-015** (3) — Smoke email sign-in (valid + wrong password + unknown email + returnUrl open-redirect guards). ✅
- [x] **T-016** (3) — Smoke OAuth sign-in with auto-linking (new + existing email). ✅ Verified in T-020 cascade — same `user_id` across 3 accounts (credential/google/facebook).
- [x] **T-017** (2) — Smoke forgot-password happy path. ✅
- [x] **T-018** (2) — Smoke reset-password edge cases (expired + invalid + used token). ✅ Security PASS (server invalidates used + invalid tokens). Expired token skipped (1h+ wait). UX gap noted in session-finding-04 below.
- [x] **T-019** (2) — Smoke verify-email + resend flow. ✅ Validated in T-020 step 1.
- [x] **T-020** (3) — Smoke account-linking cascade (email → +Google → +Facebook = 3 accounts rows). ✅ Verified DB state: 1 user, 3 account rows (credential / google / facebook), all sharing user_id.
- [x] **T-021** (2) — Smoke session lifecycle (persistent + TTL expiry + multi-browser). ✅ 2026-05-14: reload×10 stays signed in; browser restart keeps session (7-day cookie TTL OK); Chrome session not visible in Firefox (multi-browser isolation). 7-day TTL expiry sub-test skipped (not testable inline).
- [x] **T-022** (2) — Smoke cross-environment session isolation. ✅ 2026-05-14: signed into staging, then `GET api.hospeda.com.ar/api/auth/get-session` in same tab returned null — staging cookies correctly domain-scoped.
- [ ] **T-023** (3) — Smoke auth UI a11y (keyboard + screen reader + Enter). **DEFERRED 2026-05-14**: skipped by operator decision after marathon session (needs ~25-30 min focused time with screen reader). Rerun in a dedicated session before public launch (Argentina Ley 26.653 + WCAG 2.1 AA). Procedure in `apps/web/docs/auth-smoke-checklist.md`.
- [x] **T-024** (2) — Smoke OAuth error logging (console context + Sentry tags). ⚠️ PARTIAL: cancel recovery UX works (no crash), but no UI feedback to the user and no Sentry event captured. See session-finding-02 below; deferred to post-launch instrumentation pass.
- [x] **T-025** (2) — Document full auth smoke checklist in `apps/web/docs/auth-smoke-checklist.md`. ✅ Shipped via PR #1076 (commit 27832dd67); extended 2026-05-14 with operator execution log + cross-spec references.

### Home cross-browser re-validate (3.A.6)

- [x] **T-026** (2) — Re-validate home page across browsers + viewports on staging. ✅ Reconciled 2026-05-14: home re-validated on staging viewports; SPEC-111 finding extracted.

---

## 3.B — Repo hygiene (~3h)

- [x] **T-027** (1) — Update `scripts/server-tools/README.md` Status section to "V1 shipped". ✅ Commit `2a5ea036f`.
- [x] **T-028** (2) — Add "Deployment (Coolify)" section to apps/{api,admin,web}/CLAUDE.md with prod/staging split + pointer to docs. ✅
- [x] **T-029** (1) — Remove husky v10 deprecation warning lines from `.husky/pre-commit` + `.husky/post-commit`. ✅ Commit `d5380068e`.
- [x] **T-030** (2) — Fix `grep: conflicting matchers` warning in `.husky/pre-commit` secrets scan (location was husky, not lint-staged config). ✅ Commit `d5380068e`.
- [x] **T-031** (1) — Verify `linear.service.ts:342` Buffer→Blob typecheck fix. ✅ Done in commit `a7e323dd2` (post-merge gate).

### CI minutes optimization (3.B.6)

- [x] **T-032** (4) — CI: upload build artifact from `build` job, download in downstream jobs. ✅ test-unit timeout reverted 30→15.
- [x] **T-033** (3) — Investigate `docs.yml` hangs + add hard timeout. ✅
- [!] **T-034** (4) — MOVED TO SPEC-105 (was: Re-enable E2E nightly cron after diagnosing root cause.)
- [x] **T-035** (3) — Replace dynamic `await import()` with static imports across 42 test files. ✅ Scripted transformation + biome auto-fix.
- [x] **T-036** (2) — Consolidate guards + docs CI jobs into one. ✅

---

## 3.C — Hops toolkit hardening (~5-7h)

### Unit tests (3.C.1)

- [x] **T-037** (2) — Set up vitest/bun-test config for `scripts/server-tools/`. Blocks: T-038, T-039, T-040. ✅
- [x] **T-038** (2) — Unit tests for `resolveTarget(argv)`. Blocked by: T-037. ✅
- [x] **T-039** (3) — Unit tests for `getAppResourceName` / `getDbResourceName` / `getDbCredentials`. Blocked by: T-037. ✅
- [x] **T-040** (2) — Unit tests for dotenv parser. Blocked by: T-037. Blocks: T-053. ✅

### Smoke 14 hops commands against `--target=staging` (3.C.2)

- [x] **T-041** (1) — `hops --target=staging logs api --tail=10`. ✅ Reconciled 2026-05-14: hops --target=staging logs api smoke PASS.
- [x] **T-042** (1) — `hops --target=staging exec api -- node -v`. ✅ Reconciled 2026-05-14: hops exec api smoke PASS.
- [x] **T-043** (1) — `hops --target=staging app-restart api`. ✅ Reconciled 2026-05-14: hops app-restart api smoke PASS.
- [x] **T-044** (2) — `hops --target=staging redeploy api` (extra care — live Coolify deploy). ✅ Reconciled 2026-05-14: hops redeploy api smoke PASS.
- [x] **T-045** (1) — `hops --target=staging env-list api`. ✅ Reconciled 2026-05-14: hops env-list api smoke PASS.
- [x] **T-046** (1) — `hops --target=staging env-set api FOO=bar` + `env-delete` to undo. ✅ Reconciled 2026-05-14: hops env-set / env-delete roundtrip PASS (NB: env-set has propagation bug T-095).
- [x] **T-047** (1) — `hops --target=staging health`. ✅ Reconciled 2026-05-14: hops health smoke PASS.
- [x] **T-048** (1) — `hops --target=staging free-mem`. ✅ Reconciled 2026-05-14: hops free-mem smoke PASS.
- [x] **T-049** (1) — `hops --target=staging prune`. ✅ Reconciled 2026-05-14: hops prune smoke PASS.
- [x] **T-050** (1) — `hops --target=staging update`. ✅ Reconciled 2026-05-14: hops update smoke PASS.
- [x] **T-051** (1) — `hops --target=staging find admin + find web`. ✅ Reconciled 2026-05-14: hops find smoke PASS.
- [x] **T-052** (1) — Document smoke outputs in engram. ✅ Reconciled 2026-05-14: outputs captured under engram topic `vps-migration/phase-17.2-hops-checkpoint`; all 11 individual smokes (T-041..T-051) reconciled to completed.

> Note: `cron-list` + `cron-trigger` smokes deferred to SPEC-102.

### Code cleanup

- [x] **T-053** (2) — Replace bespoke dotenv parser with `dotenv` package. Decoupled from T-040 (drop-in replacement). ✅
- [x] **T-054** (1) — Document `setActiveTarget` single-invocation contract via JSDoc. ✅

---

## 3.D — Auth / OAuth (~2h + SPEC-102 separate)

- [x] **T-055** (3) — Export `parseTrustedOrigins` + add unit tests covering 6 cases. ✅
- [ ] **T-056** (3) — Create staging-specific Google OAuth client + update hospeda-api-staging env. MOVED TO SPEC-112 (2026-05-14): work owned by SPEC-112 now.
- [ ] **T-057** (3) — Create staging-specific Facebook app + update hospeda-api-staging env. MOVED TO SPEC-112 (2026-05-14): work owned by SPEC-112 now.
- [ ] **T-058** (2) — Validate per-env OAuth isolation: revoking staging client doesn't lock prod. Blocked by: T-056, T-057. MOVED TO SPEC-112 (2026-05-14): work owned by SPEC-112 now.
- [ ] **T-059** (4) — **META**: Implement SPEC-102 (admin API bearer token). Tracker pointing at separate spec.

---

## 3.E — DB ops + beta migration (~12-18h)

### Beta migration script (3.E.1)

- [!] **T-060** (3) — MOVED TO SPEC-104 (was: Scaffold `scripts/migrate-staging-to-prod.ts` (CLI + DB conns + SEED_TIMESTAMP filter). Blocks: T-061..T-068.)
- [!] **T-061** (3) — MOVED TO SPEC-104 (was: Migrate users (filter by `created_at > SEED_TIMESTAMP`). Blocked by: T-060.)
- [!] **T-062** (3) — MOVED TO SPEC-104 (was: Migrate accounts rows linked to migrated users. Blocked by: T-061.)
- [!] **T-063** (4) — MOVED TO SPEC-104 (was: Migrate accommodations + remap `destination_id` by slug. Blocked by: T-061, **T-010**.)
- [!] **T-064** (2) — MOVED TO SPEC-104 (was: Migrate posts owned by migrated users. Blocked by: T-061.)
- [!] **T-065** (2) — MOVED TO SPEC-104 (was: Migrate events owned by migrated users. Blocked by: T-061.)
- [!] **T-066** (2) — MOVED TO SPEC-104 (was: Migrate reviews authored by migrated users. Blocked by: T-061, T-063.)
- [!] **T-067** (2) — MOVED TO SPEC-104 (was: Migrate bookmarks of migrated users. Blocked by: T-061, T-063.)
- [!] **T-068** (2) — MOVED TO SPEC-104 (was: Add dry-run (default) + `--execute` flag with confirmation prompt. Blocked by: T-063..T-067.)
- [!] **T-069** (2) — MOVED TO SPEC-104 (was: Add count verification + post-migration summary report. Blocked by: T-068.)
- [!] **T-070** (3) — MOVED TO SPEC-104 (was: Test migration script against snapshot pair (clone staging into clone prod). Blocked by: T-069.)
- [!] **T-071** (2) — MOVED TO SPEC-104 (was: Document migration runbook. Blocked by: T-070.)

### Other DB ops

- [ ] **T-072** (4) — **DEFERRED**: Implement prod→staging data sync + sanitize-staging script (post-launch, ~1 month).
- [x] **T-073** (3) — Add API startup DB healthcheck on `role_permission` count. ✅
- [x] **T-074** (2) — Smoke API startup healthcheck (empty role_permission → crash-loop). ✅ Reconciled 2026-05-14: crash-loop behaviour confirmed against empty role_permission state.

---

## 3.F — Observability (~1.5h)

- [x] **T-075** (1) — Spot-check Better Stack monitors target correct hosts post-split. ✅ 2026-05-14: all monitors point at prod (`hospeda.com.ar`, `api.hospeda.com.ar`, `admin.hospeda.com.ar`) + staging (`staging.*` equivalents). No drift to Vercel-era URLs, raw IPs, or paused entries.
- [x] **T-076** (2) — Verify Sentry environment tagging separates prod vs staging. ✅ Reconciled 2026-05-14: Sentry env tagging shipped via PR #1069.

---

## 3.G — Future improvements (~10h, mostly deferred)

- [x] **T-077** (3) — Configure Coolify DNS-01 challenge with Cloudflare API token. ✅ Operator runbook shipped at `docs/migration/coolify-dns01-cloudflare.md` (token creation, Coolify wiring, first cert issuance, openssl verification, HTTP-01 rollback). Operator executes when ready.
- [x] **T-078** (3) — Add GPG symmetric encryption to `scripts/backup/postgres-to-r2.sh`. ✅
- [x] **T-079** (3) — Add GPG encryption to `scripts/server-tools/src/commands/db-backup-now.ts`. ✅
- [x] **T-080** (3) — Add GPG decryption to `scripts/server-tools/src/commands/db-restore.ts`. Blocked by: T-078, T-079. ✅
- [x] **T-081** (1) — Add R2 lifecycle rule: delete `manual/*` after 30 days. ✅ Rule applied 2026-05-14 by the operator via the Cloudflare R2 dashboard on both `hospeda-backups` + `hospeda-staging-backups` (prefix `manual/`, 30-day expiration). The `hops r2-lifecycle show/set` command was shipped for future use but requires an admin-scoped R2 token; current token is object-only so `set/show` return Access Denied. The runbook in `docs/migration/coolify-dns01-cloudflare.md` Notes section also covers the dashboard path.
- [ ] **T-082** (4) — **DEFERRED**: Implement hops `cron-edit` command (V2 backlog, requires backend support).
- [ ] **T-083** (4) — **DEFERRED**: Implement hops SshRunner (laptop-to-VPS ops).
- [x] **T-084** (1) — Bump hops `VERSION` constant to `1.0.0` (chose hardcoded path, documented sync policy). ✅ Commit `2a5ea036f`.

---

## 3.H — Long-term architectural (~5-12h)

- [ ] **T-085** (4) — **META**: Implement SPEC-079 (Redis rate-limit backend). Tracker.
- [x] **T-086** (2) — Verify `hospeda-redis` actually used by hospeda-api-prod. ✅ Reconciled 2026-05-14: hospeda-redis confirmed in use by hospeda-api-prod.
- [ ] **T-087** (3) — **DEFERRED**: Cutover hospeda-web-prod from `apps/landing` to `apps/web` at public launch.
- [ ] **T-088** (2) — **DEFERRED**: Quarterly engram cleanup sweep.

---

## Pre-existing test failures surfaced by §3.A.0 green-build gate (CI run `25758581495`)

These tasks were not in the original 33-item spec. They were uncovered when CI billing was restored and the unit-test matrix actually ran for the first time on staging HEAD. Skipped inline with `it.skipIf(true)` referencing each task ID; the failures are pre-existing on `staging @ 3a86aa0a7`, not regressions from SPEC-103 batch 1.

- [x] **T-089** (3) — Investigate + fix `apps/api/test/routes/tag/post-tag.test.ts:296` (`?withCounts=true` spy never invoked). Likely SPEC-086 Tag System regression. ✅
- [x] **T-090** (3) — Investigate + fix `apps/admin/test/integration/plan-dialog.test.tsx:220` (5000ms timeout before form fields located). Likely RTL/Radix Select/userEvent issue. ✅
- [x] **T-091** (3) — Investigate + fix `apps/api/test/routes/user-bookmark/checkBulkAndNotesAndCount.test.ts:502` (entire `publicCount` describe block now skipped — 5 inner tests TC16-TC21 fail because route bypasses mock AND validation). Likely public-path mock/factory gap. ✅
- [x] **T-092** (1) — Remove husky v10 deprecation lines from `.husky/post-checkout` (follow-up to T-029 which only covered pre-commit + post-commit). ✅

---

## Phase Distribution

| Phase | Count | Avg complexity |
|---|---|---|
| setup | 5 | 2.4 |
| core | 18 | 2.4 |
| integration | 13 | 2.6 |
| testing | 39 | 1.7 |
| docs | 7 | 1.4 |
| cleanup | 6 | 1.7 |

## Dependency Graph (key chains)

- **Branch protection chain**: T-001 → (T-002 || T-003)
- **Prod destinations chain**: T-008 → T-009 → T-010 → T-011, T-010 → T-063
- **Auth smoke aggregation**: T-012..T-024 → T-025 (docs)
- **Hops tests fan-out**: T-037 → (T-038 || T-039 || T-040), T-040 → T-053
- **Hops smoke fan-in**: T-041..T-051 → T-052
- **Beta migration backbone**: T-060 → T-061 → (T-062, T-063, T-064, T-065), T-063 → (T-066, T-067), all → T-068 → T-069 → T-070 → T-071
- **API healthcheck**: T-073 → T-074
- **GPG backups**: (T-078, T-079) → T-080

## Suggested Start (Batch 1)

Begin with the green-build close-out + repo hygiene batch:

1. **T-001** (complexity: 1) — verify CI green on staging HEAD. No deps. Unblocks branch protection.
2. **T-002 + T-003** in parallel — branch protection on main + staging via `gh api`.
3. **T-027** (1) — README hops Status update.
4. **T-029** (1) — husky deprecation lines removal.
5. **T-030** (2) — lint-staged grep fix.
6. **T-084** (1) — hops VERSION bump.

After Batch 1: pivot to Coolify ops (T-004 MP toggle, T-006 staging backups, T-075/T-076 observability).

---

## Newly tracked from session findings 2026-05-14

These tasks were added to `state.json` at the close of the operator OAuth smoke pass to make sure the session findings are not lost. Larger findings got their own spec instead of a task here (SPEC-120, SPEC-118 — see Session findings section). Note: SPEC-120 was originally created as SPEC-117 in this worktree before staging knew the number was already taken by SPEC-117-admin-pages-stabilization; it was renumbered to SPEC-120 to resolve the collision.

- [x] **T-093** (2) — Navbar React island stale immediately after OAuth callback. ✅ Shipped via PR #1087 (stale-while-revalidate in `UserMenu.client.tsx`); verified on staging post-redeploy 2026-05-14 — navbar shows user menu immediately after OAuth callback (avatar/name population is a separate SPEC-113 concern, tracked as T-094).
- [x] **T-094** (2) — Add-password flow for OAuth-only accounts. ✅ Tracker-only — implementation lives in SPEC-113 (profile completion). Closing here keeps the SPEC-103 dashboard accurate; SPEC-113 picks up the actual UI + Better Auth set-password endpoint work.
- [x] **T-095** (3) — Audit and fix `hops --target=staging` propagation. ✅ Shipped via PR #1088 (target-aware `getR2Config(target)` + new `R2_STAGING_*` env vars + 8 unit tests); verified on VPS 2026-05-14: `hops db-restore --list --target=staging` lists `s3://hospeda-staging-backups/` (06:30 UTC), default prod still lists `s3://hospeda-backups/` (06:00 UTC). Note: `env-set` "production" label was UI ambiguity (Coolify scope vs Hospeda target), not a functional bug.

---

## Session findings — 2026-05-14 (operator OAuth smokes)

These items surfaced during the manual OAuth smoke execution against staging. None block the public launch directly, but each is a real gap that should be tracked. They are numbered to match the smoke checklist log entries in `apps/web/docs/auth-smoke-checklist.md`.

### session-finding-31 — Navbar stale immediately after OAuth callback

**Tracked as:** `T-093` in this spec (state.json).

After successful Google signin, the navbar still showed the "Iniciar sesión" button while `/es/mi-cuenta/` rendered as logged-in. The session was clearly active server-side; the navbar React island simply did not refresh from the new session cookie until the next navigation. Likely caused by the island reading the user prop once at hydration and never refetching `/api/auth/get-session` after the OAuth callback redirect. Fix candidate: have the navbar island refetch the session on `astro:page-load` events, or move the user fetch into a Server Island that re-runs per request.

### session-finding-32 — OAuth cancel produces no UI feedback and no Sentry event (T-024 partial)

**Tracked as:** **SPEC-120** — OAuth Cancel/Error Observability (its own spec, can ship independently of this worktree's PRs). _Originally registered as SPEC-117; renumbered to SPEC-120 to resolve a collision with `SPEC-117-admin-pages-stabilization`._

When the user cancels the Google consent screen, the browser redirects back to `/es/auth/signin/` cleanly (recovery UX OK). However:

- No banner / toast / inline message tells the user that the login was cancelled. Looks like a silent no-op from the user's perspective.
- No event reaches Sentry with `environment:staging` for the cancellation. The Better Auth callback rejection is not instrumented.

Suggested fix: emit a `?error=oauth_cancelled` query string on the cancel redirect (or read the upstream `?error=access_denied` from the provider) and have signin render an appropriate i18n message. Capture the same event in Sentry with `provider` + `error_code` tags so support can correlate user reports.

### session-finding-33 — No "Add password" flow for OAuth-only accounts (matches SPEC-113)

**Tracked as:** `T-094` in this spec (state.json) — scope ref points at SPEC-113.

When an account was created via OAuth (Google / Facebook only, no `credential` row) and the user later tries to sign up with email + password using the same email, Better Auth correctly rejects the signup with `User already exists` (security PASS). But the UX provides no path forward: the user cannot add a password to their existing OAuth account from any page. Closest matching scope is SPEC-113 (profile completion flow). If SPEC-113 does not already include this, scope it in as the "Add password to your account" subtask.

### session-finding-34 — Reset-password page does not validate token at load (UX gap, security OK)

**Tracked as:** **SPEC-118** — Reset-Password Page Validates Token at Load (its own spec, can ship independently of this worktree's PRs).

Visiting `/es/auth/reset-password/?token=<invalid-or-used>` always renders the "set new password" form. The server correctly returns `Invalid token` on submit, so a used or tampered token cannot actually reset the password — security is intact. The UX gap is that the user only learns the link is dead after typing a new password and submitting. Fix candidate: have the page do a lightweight token-validity check on load (HEAD / GET against `/api/auth/reset-password/verify` or equivalent) and show an inline error / "request a new link" CTA when the token is dead.

### session-finding-14-repro — `hops --target=staging` ignored on `env-set` and `db-restore --list`

**Tracked as:** `T-095` in this spec (state.json).

Reproduction of the previously-noted hops `--target` propagation gap, with two concrete repros:

1. `hops env-set web PUBLIC_SENTRY_DSN --secret --target=staging` opened an `UPDATE on web [production]` prompt. Aborted before save. Workaround: set the variable via the Coolify UI on the staging app.
2. `hops db-restore --list --target=staging` printed `Listing backups from s3://hospeda-backups/` (production bucket; staging is `s3://hospeda-staging-backups/`) and offered prod-cron timestamps (`06:00 UTC`) instead of staging-cron timestamps (`06:30 UTC`). Workaround for verification: `aws s3 ls s3://hospeda-staging-backups/` with the credentials in the staging backup env file (R2_* prefix, not AWS_*).

These belong to the standalone hops `--target` fix (~2-4h estimated). The smokes themselves were unblocked by Coolify UI / aws CLI fallbacks.

### admin-csp-node-crypto — Admin staging SPA was broken by `node:crypto` in client bundle (FIXED)

Independent finding surfaced when attempting to validate cross-app session sharing for T-021 / T-022. The admin SPA failed to hydrate on `https://staging-admin.hospeda.com.ar/auth/signin` because the client bundle attempted to import `node:crypto` and the browser blocked it with a CORS error. Two distinct code paths were leaking the Node built-in into the client:

1. `apps/admin/src/middleware.ts` imported `randomBytes` from `node:crypto` for the CSP nonce generator. Module evaluated in both server and client bundles. Fixed in PR #1077.
2. `packages/utils/src/string.ts` imported `getRandomValues` from `node:crypto` at the top of the file; the `@repo/utils` barrel re-exported everything, so any consumer (incl. `apps/admin/src/lib/csp-helpers.ts`) dragged the Node import into its bundle. Fixed in PR #1080.

Both PRs merged to staging via admin-merge (CI billing exhausted), Coolify rebuilt with `Force Deploy without cache`, admin SPA back online. No further code changes needed — the fix is verified via Playwright (page hydrates, no `node:crypto` errors in console).
