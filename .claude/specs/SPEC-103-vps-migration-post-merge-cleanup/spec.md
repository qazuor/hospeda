---
spec-id: SPEC-103
title: VPS Migration Post-Merge Cleanup & Hardening Backlog
type: chore
complexity: medium
status: completed
created: 2026-05-12T03:30:00Z
completed: 2026-05-14T00:00:00Z
effort_estimate_hours: 25-40
tags: [vps, ops, hops, auth, oauth, tests, docs, post-merge, backlog]
closureNote: |
  67/95 tasks closed. The remaining 28 break down as:
  - 6 extracted to dedicated specs (SPEC-079, SPEC-102, SPEC-104, SPEC-105, SPEC-109, SPEC-112)
  - 2 blocked on platform: T-002, T-003 (GitHub branch protection on Free plan; agent-side enforcement in CLAUDE.md + settings.json)
  - 6 deferred long-term: T-023 (Auth UI a11y smoke), T-072 (prod→staging sync script), T-082 (hops cron-edit V2), T-083 (hops SshRunner), T-087 (web-prod landing→app cutover), T-088 (quarterly engram cleanup)
  - 14 tracker meta-tasks that close automatically when owning specs flip to completed
  T-023 is the only originally-in-scope item with no formal owner — rides along with the next admin/web UI polish sprint. Audit trail in engram observation spec/hospeda/SPEC-103/status.
---

# SPEC-103: VPS Migration Post-Merge Cleanup & Hardening Backlog

## Part 1 -- Functional Specification

---

### 1. Overview & Goals

**Goal:** Centralise every loose end, deferred item, audit finding, and improvement-in-mind that accumulated over the 3-month VPS migration sprint and the pre-launch wrap-up sprint of 2026-05-11 / 2026-05-12. Each item is sized, prioritised, and ready to be picked up in priority order without re-deriving context.

**Why now:** The branch `chore/vps-migration` (105+ commits ahead of `main` at the time of writing) is about to be merged. Several follow-ups were knowingly deferred during the sprint to keep the merge scope tight. Without a single source of truth, the backlog gets fragmented across engrams, doc TODOs, and chat history — items will be forgotten or duplicated.

**Success metric:** When the operator picks up any item below, they can act without reading the spec history. Each item names the file paths, the change shape, and the validation step.

**Audience:** Solo developer (qazuor) — sized for one operator picking items in 1-2h chunks.

---

### 2. Out of Scope

Items already covered by other specs are referenced, not duplicated:
- SPEC-102 (`admin-api-bearer-token`): bearer-token auth for `/api/v1/admin/*`. Cron-list/cron-trigger smokes belong there.
- SPEC-079 (`rate-limit-redis`): replacing the in-memory rate limit store with Redis sorted-set.
- SPEC-104+ (future): when an item below grows beyond ~8h or needs cross-team coordination, fork it into its own spec.

---

### 3. Backlog by Priority

Items are tagged with severity (CRITICAL / HIGH / MEDIUM / LOW), area (security, ops, ux, docs, perf, test), effort estimate, and a clear acceptance criterion.

---

## 3.A — Pre-public-launch (block public launch until done)

### 3.A.0 — [CRITICAL · ops · 2-4 h] Green-build gate before creating the `staging` branch

**Where:** root of the monorepo on `main` immediately after the merge.

**Current:** The merge of `chore/vps-migration` → `main` carries forward at least one known typecheck error (`apps/api/src/services/feedback/linear.service.ts:342` — preexisting `Buffer` vs `BodyInit` mismatch) plus possibly other red lint / test signals that accumulated over the 3-month branch life. Creating the `staging` branch from a red `main` would copy the failures into staging, polluting CI for both branches.

**Hard rule:** Do NOT create the `staging` branch until `main` passes:

```bash
pnpm lint        # turbo run lint    — biome across the entire monorepo
pnpm typecheck   # turbo run typecheck — tsc per workspace
pnpm test        # turbo run test    — vitest across all packages + apps
```

with **zero failures**. CI passing on the merge commit is the same gate, but a local run before pushing main saves a CI roundtrip.

**Steps:**
1. Merge the branch.
2. Run the three commands above on `main`. Capture any errors.
3. For each failure, either:
   - Fix it inline in `main` (small typecheck nits, missing imports, deterministic test failures).
   - File it as a new sub-item in section 3.B and apply a **temporary** suppression (`// @ts-expect-error`, `it.skip`, `biome-ignore`) with a comment pointing back to this spec item.
4. Re-run all three commands. Confirm green.
5. Push `main`.
6. ONLY THEN create `staging` branch from `main`.

**Why CRITICAL:**
- A red `main` blocks every future PR's CI (every PR's pipeline starts from main + the PR diff).
- Cherry-picking fixes between `main` and `staging` becomes harder if both diverge on red signals.
- Public-launch confidence requires "the build is green, period" as a baseline.

**Known starter list (from audit 2026-05-12):**
- `apps/api/src/services/feedback/linear.service.ts:342` — `Buffer` not assignable to `BodyInit`. Either convert to `Uint8Array`/`Blob`/`ReadableStream` before `fetch(body)`, or relax the call signature.
- (Run `pnpm lint`, `pnpm typecheck`, `pnpm test` to discover the rest — capture here as a checklist when you hit them.)

**Acceptance:** the three commands return exit 0 on `main` HEAD. CI on the merge commit is green. Staging branch is created from that green commit.

---

### 3.A.0.1 — [CRITICAL · ops · 30 min] Branch protection rules on `main` and `staging`

**Where:** GitHub repo Settings → Branches → Branch protection rules.

**Current:** No protection. Anyone with push access (= the operator today) can push directly to either branch, force-push, delete, or merge a PR with red CI.

**When:** IMMEDIATELY after creating the `staging` branch from a green `main` (3.A.0). Before any other team member is invited to the repo, before any non-trivial PR lands.

**Rules to apply (identical for both `main` and `staging`)**:

1. **Require a pull request before merging**
   - Require approvals: 1 (or 0 if solo developer with self-review discipline; bump to 1 when a second contributor joins).
   - Dismiss stale pull request approvals when new commits are pushed: ON.

2. **Require status checks to pass before merging**
   - Require branches to be up to date before merging: ON.
   - Required status checks (pick the actual job names from `.github/workflows/ci.yml`):
     - lint
     - typecheck
     - test
     - any other CI gate jobs (security scan, etc.)

3. **Require conversation resolution before merging**: ON.

4. **Require linear history**: depends on merge style choice (3.A.0 settled on `--no-ff`, so leave this OFF; if the team later switches to squash/rebase-only, turn it ON).

5. **Restrict who can push to matching branches**: ON. Limit to the owner. Branches still receive PR-merged commits.

6. **Allow force pushes**: OFF. Force-pushing a protected branch destroys history and breaks any collaborator's local copy.

7. **Allow deletions**: OFF.

8. **Lock branch**: leave OFF (lock would prevent ALL pushes including PR merges; only useful for archived branches).

**Implementation:**

Either via GitHub UI (Settings → Branches → Add rule) or via `gh` CLI:

```bash
gh api -X PUT "repos/qazuor/hospeda/branches/main/protection" \
  --input - <<'EOF'
{
  "required_status_checks": { "strict": true, "contexts": ["lint", "typecheck", "test"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "dismiss_stale_reviews": true, "required_approving_review_count": 0 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
EOF

# Same for staging — replace "main" with "staging" in the URL.
```

Adjust the `contexts` array to match the actual CI job names. Run `gh api repos/qazuor/hospeda/actions/runs --jq '.workflow_runs[0].jobs_url'` to inspect the latest run and lift the names from there.

**Acceptance:**
- A `git push origin main` (direct, no PR) is rejected by GitHub with "protected branch" message.
- A PR with failing CI cannot be merged via the UI button (it is greyed out).
- A force-push attempt is rejected.

**Why CRITICAL:** without protection, the green-build gate from 3.A.0 is just a gentlemen's agreement. A future PR that breaks `main` and gets merged anyway poisons every subsequent PR's baseline. Protection makes the gate enforceable instead of aspirational.

---

### 3.A.1 — [CRITICAL · ops · 30 min] Toggle MercadoPago to production mode in `hospeda-api-prod`

**Where:** Coolify → `hospeda-api-prod` → Environment Variables → `HOSPEDA_MERCADO_PAGO_SANDBOX`.

**Current:** `true` (sandbox credentials wired). Captured in audit 2026-05-12 — confirmed by `docker exec ... echo $HOSPEDA_MERCADO_PAGO_SANDBOX → true`.

**Change:** Flip to `false` and rotate `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` + `HOSPEDA_MERCADO_PAGO_PUBLIC_KEY` + `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` to production credentials from the MP merchant dashboard.

**Why CRITICAL:** going public with `SANDBOX=true` means real users see "test mode" prompts and any transaction is a fake — revenue lost and trust broken. Conversely, leaving `SANDBOX=false` early (now) without production credentials would crash MP integrations.

**Acceptance:** `curl https://api.hospeda.com.ar/api/v1/billing/health` (or equivalent) reports MP as `production` mode and a smoke test purchase against a low-value addon completes through MP and lands a real `billing_payments` row with `livemode=true`.

**Note:** Staging stays on `SANDBOX=true` with test-user credentials. Do NOT touch staging.

---

### 3.A.2 — [HIGH · ops · 15 min] Configure scheduled backups for `hospeda-staging-postgres`

**Where:** Coolify → `hospeda-staging-postgres` → Backups (or equivalent).

**Current:** Only `hospeda-postgres` (prod) has the daily 03:00 ART backup configured. The new staging postgres has zero scheduled backups since creation 2026-05-11.

**Change:** Mirror the prod schedule (daily, R2 destination, keep 14 days). Path under R2 should distinguish: e.g. `s3://hospeda-backups/staging-daily/...` to avoid collision with the prod cron output at the bucket root.

**Why:** beta testers will populate staging with real accounts + listings + reviews from beta start onward. A storage failure or accidental `db-restore` on staging without a recent backup loses that data.

**Acceptance:** 24h after configuring, a backup file is visible under the staging path in R2. `hops --target=staging db-restore` lists those files alongside any manual ones.

---

### 3.A.3 — [HIGH · auth · 1-2h] Validate OAuth signup end-to-end on both prod and staging

**Where:** browser, manual.

**Current:** OAuth fixes from audit shipped 2026-05-12 (commits `d55bff40b` open-redirect, `136e093ea` OAuth UX + error logging). User reports OAuth was "not 100% working" pre-fix; needs end-to-end re-validation post-fix.

**Steps:**
1. Open `https://staging-admin.hospeda.com.ar/auth/signup` → click Google → complete consent → land on `/mi-cuenta` (NOT `/auth/verify-email-sent`). User row appears in staging DB with `email_verified=true` and `created_at > 2026-05-11 21:00`.
2. Same with Facebook on staging.
3. Open `https://staging-admin.hospeda.com.ar/auth/signin` → click Google with same email → completes session, account auto-linked.
4. Repeat all three on `https://admin.hospeda.com.ar/...` (prod). Confirm prod DB receives the user, NOT staging.
5. Use DevTools Console to confirm OAuth errors (if any) are now logged with provider context (audit fix #5).

**Acceptance:** all 4 flows complete without `redirect_uri_mismatch` or `INVALID_CALLBACKURL`. Console clean of unexpected errors. Cross-env isolation holds (signups land in their own DB).

**Blocker for:** Public launch — OAuth has to work for real users.

---

### 3.A.4 — [HIGH · ops · 30 min] Curate prod `destinations` table with real-content rows matching staging-seed slugs

**Where:** prod DB. See `docs/migration/staging-prod-db-separation.md` Section 10.4.

**Current:** Prod has 23 destinations from the required seed (built into `packages/seed/src/data/destination/required/`). Staging has 27 destinations (required + 4 from example seed).

**Change:** Prod needs the same 27 slugs but with real, polished content (descriptions, hero images, owner=system user, status=PUBLISHED). When the beta → prod migration script runs, beta-tester `accommodations` (whose `destination_id` points at staging seed UUIDs) get remapped to prod by slug match. Without slug parity in prod, that remap silently drops accommodations.

**Two approaches:**
- (a) Manual via admin UI: faster for 4 missing slugs, no script needed. Acceptable for v1.
- (b) Add a `packages/seed/src/data/destination/prod-curated/` set + a CLI flag `--prod-destinations` that loads ONLY those for prod seeding. Better long-term.

**Pick (a) for now**, document the slugs added in the doc Section 10.4.

**Acceptance:** `psql prod -c "SELECT slug FROM destinations" UNION psql staging -c "SELECT slug FROM destinations"` returns identical sets. No slug exists in staging that doesn't exist in prod.

---

### 3.A.5 — [CRITICAL · auth · 4-6h] Comprehensive review of every auth flow end-to-end

**Where:** all auth surfaces — sign-up (email + Google + Facebook), sign-in (email + Google + Facebook), forgot password, reset password, verify email, change email, account deletion, session expiry, sign-out, account-linking edge cases.

**Why CRITICAL:** the pre-launch sprint touched auth code in cascade (5 commits to fix OAuth callbackURL/account-linking/origin handling) under time pressure. The audit (Fase H) added 2 more fixes (open-redirect + signup OAuth target). Each fix was validated narrowly; nobody walked through the full auth surface end-to-end. Public launch with a broken "forgot password" or "verify email" flow is a trust killer that wastes signups.

**Steps (each on prod AND staging, both browsers Chrome + Firefox + mobile emulation):**

1. **Sign-up email path**:
   - Submit form → user created in DB with `email_verified=false`
   - Email arrives in inbox (Brevo)
   - Click verify link → land on signed-in dashboard
   - Confirm session is active

2. **Sign-up OAuth path** (Google + Facebook separately):
   - Click provider button → consent screen → callback
   - User created with `email_verified=true`
   - Land on `/mi-cuenta` (NOT `/auth/verify-email-sent` — fix from commit `136e093ea`)
   - Confirm session is active
   - Confirm `accounts` table has the OAuth provider row

3. **Sign-in email path**:
   - Submit valid credentials → land on dashboard
   - Submit wrong password → error displayed without leaking which field is wrong
   - Submit unknown email → same error message (no email enumeration)
   - Submit valid credentials with `?returnUrl=/some/protected/page` → land on that page (NOT open-redirect — fix from commit `d55bff40b`)
   - Submit with `?returnUrl=https://evil.com` → land on `/mi-cuenta` (rejected as unsafe)

4. **Sign-in OAuth path** (Google + Facebook):
   - Click provider with NEW email → completes (treated as signup)
   - Click provider with EXISTING email matching another provider → account auto-linking happens (fix from commit `a6d430206`)
   - Sign in twice with the same provider → second session replaces first

5. **Forgot password**:
   - Enter email → confirmation message (no leak whether email exists)
   - Email arrives with reset link
   - Click link → reset form
   - Submit new password (>= 8 chars) → success → can log in with new password

6. **Reset password edge cases**:
   - Expired link (use after 1h) → error message + link to request new
   - Invalid token → error
   - Used token (click reset link twice) → second click errors

7. **Verify email**:
   - Resend from `/auth/verify-email-sent` → new email arrives
   - Verify with stale link from older email → still works (or errors gracefully if invalidated)

8. **Account linking** (the hairy one):
   - Sign up with email + password
   - Sign out
   - Sign in with Google using the SAME email → auto-link succeeds, both providers usable
   - Sign in with Facebook using the SAME email → auto-link, all 3 usable
   - Verify `accounts` table has 3 rows for that user

9. **Session lifecycle**:
   - Sign in → close tab → reopen `/mi-cuenta` → still authenticated
   - Sign in → wait beyond session TTL → next request triggers re-auth
   - Sign out → `/mi-cuenta` redirects to sign-in
   - Sign in on browser A, sign in on browser B with same account → both sessions valid (or one invalidated, depending on Better Auth FIFO eviction config)

10. **Cross-environment isolation** (regression check):
    - Sign in on prod admin → session cookie is set
    - Open staging admin in same browser → NOT auto-signed in (independent BETTER_AUTH_SECRET)
    - Sign up on staging with any email → user appears ONLY in staging DB

11. **Auth UI accessibility**:
    - Tab through forms with keyboard only — focus visible, labels associated, errors announced via `aria-live`
    - Screen reader (VoiceOver / NVDA) reads form fields and errors correctly
    - Submit Enter key works in every form

12. **Error logging** (audit fix #5 from commit `136e093ea`):
    - Trigger any OAuth failure (e.g. cancel consent in Google) → console shows `OAuth google sign-in failed` with the error object
    - Confirm Sentry catches the error with provider context tag

**Acceptance:** every step above completes successfully on every (env × browser × viewport) combination. Any failure becomes its own follow-up commit with a regression test. Document the full smoke checklist in `apps/web/docs/auth-smoke-checklist.md` so it can be re-run before every public-touching deploy.

**Note:** this overlaps with 3.A.3 (which only covers OAuth signup). Treat 3.A.3 as the minimum subset and this item as the full coverage. If time is tight, do 3.A.3 only and defer the rest to post-launch — but document the gap explicitly.

---

### 3.A.6 — [HIGH · ux · 1h] Re-validate the home page across browsers + viewports

**Where:** `https://staging.hospeda.com.ar` (web).

**Current:** During the DB split smoke 2026-05-12, the home initially appeared empty (sections "Alojamientos destacados", "Eventos próximos", "Últimos artículos", etc. all blank). Root cause was the bundle baked `PUBLIC_API_URL` against prod (which had no example data). Post force-rebuild, user reported "in Firefox lo veo OK". Was NOT validated on Chrome/Safari/Edge nor on mobile viewports.

**Steps:**
1. Hard refresh (Ctrl+Shift+R) `https://staging.hospeda.com.ar/es/` on Chrome desktop, Firefox desktop, Safari (if available), and Chrome mobile emulation.
2. Confirm each "featured" section shows accommodations / events / posts (not skeleton/empty).
3. If a section is empty: capture network tab response of the underlying API call to confirm the endpoint returns data and just the rendering is wrong.

**Acceptance:** Home shows populated sections in all 4 browsers. If any section is empty everywhere, it's a separate bug to investigate (probable: `is_featured` filter on backend that the seed doesn't set — fix is to add `is_featured=true` to a subset of accommodations in the example seed).

---

## 3.B — Repository hygiene (close before tagging public launch)

### 3.B.1 — [MEDIUM · ops · 5 min] Update `scripts/server-tools/README.md` "Status" section

**Where:** `scripts/server-tools/README.md` lines 8-14.

**Current:** "V1 is in active build. The first commits ship the core scaffolding (runner + docker wrapper + container lookup) plus the two simplest commands... The rest of the catalogue lands in follow-up commits."

**Change:** Update to "V1 shipped. 19 commands across 4 tandas, target-aware (prod/staging) since 2026-05-12. See § Catalogue below for the full list."

**Why:** Next contributor reads "active build" and assumes the toolkit is incomplete.

---

### 3.B.2 — [MEDIUM · ops · 30 min] Update CLAUDE.md app-specific files with new resourceNames

**Where:** `apps/api/CLAUDE.md`, `apps/admin/CLAUDE.md`, `apps/web/CLAUDE.md`, plus root `CLAUDE.md` if it references `api`/`web`/`admin` containers by their pre-rename names.

**Current:** Several CLAUDE.md files reference Coolify resourceNames using the pre-split names (`api`, `web`, `admin`). Post-split they are `hospeda-api-prod` etc. + `hospeda-{api,web,admin}-staging`.

**Change:** Search-and-replace the references; add a 1-paragraph note about the prod/staging split and where to read about it (`docs/migration/staging-prod-db-separation.md`).

---

### 3.B.3 — [LOW · ops · 5 min] Husky deprecation warnings

**Where:** `.husky/pre-commit`, `.husky/post-commit`.

**Current:** Every commit prints "husky - DEPRECATED — Please remove the following two lines... They WILL FAIL in v10.0.0".

**Change:** Remove the deprecated header lines from both files. Verify hooks still run.

---

### 3.B.4 — [LOW · ops · 10 min] `lint-staged` "grep: conflicting matchers" warning

**Where:** `lint-staged` config (probably `package.json` or `.lintstagedrc.*`) + the secrets-scanning script invoked there.

**Current:** Every commit prints "🔐 Scanning for secrets in staged files... grep: conflicting matchers specified". Doesn't break anything (still says "✅ No secrets detected") but indicates a malformed grep invocation.

**Change:** Find the grep command, fix the conflicting flags (probably mixing `-E` and `-F`, or duplicate `-e` options).

---

### 3.B.5 — [MEDIUM · code · 1-2h] Fix preexisting api typecheck error in `linear.service.ts:342`

**Where:** `apps/api/src/services/feedback/linear.service.ts:342`.

**Current:**
```
error TS2769: No overload matches this call.
  Type 'Buffer<ArrayBufferLike>' is not assignable to type 'BodyInit | null | undefined'.
```

`fetch()` is being called with a `Buffer` body but its expected types changed (likely under newer `@types/node`). Preexists this branch — confirmed by stash + recheck during audit.

**Change:** Either convert the Buffer to a `Uint8Array`, `Blob`, or `ReadableStream` before passing as body, or switch to `node-fetch`-style typings.

**Why:** any future PR that runs `pnpm --filter ./apps/api typecheck` will hit this and either ignore it (bad habit) or get blocked.

---

### 3.B.6 — [MEDIUM · ops · 4-6h] CI minutes optimization (deferred from 2026-05-12 sprint)

**Where:** `.github/workflows/ci.yml`, `.github/workflows/docs.yml`, `.github/workflows/e2e-nightly.yml`, plus 40+ test files that still use `await import()`.

**Current state (after 2026-05-12 quick wins):** Already applied — `staging` added to CI triggers, E2E Nightly cron disabled until the suite is fixed, unit-test coverage skipped on PRs and staging pushes (coverage only on `main` because that is where the threshold gate runs). Estimated ongoing savings: ~600 min/month vs the pre-fix baseline.

**Still pending — bigger items, all explicitly deferred to keep the green-build gate sprint focused:**

1. **Build artifact between jobs**. Every `needs: build` job (`typecheck`, `test-unit` × 4 shards, `test-integration`) currently re-runs `pnpm build` to "warm the turbo cache". GitHub Actions does not share fs between jobs, so this is 6 full builds per run (~5 min each). Estimated savings: ~20 min CPU per run → ~600 min/month at 30 runs/month.

   Approach: have the `build` job upload `.turbo/`, `apps/*/dist/`, `apps/web/.astro/`, `apps/admin/.output/`, `apps/admin/.tanstack/`, `apps/admin/src/routeTree.gen.ts`, and `packages/*/dist/` as a single `build-outputs` artifact with `retention-days: 1`. Each downstream job calls `actions/download-artifact@v4` before its task and drops its own `pnpm build` step. Verify on a feature branch first because turbo's content hashing is sensitive to filesystem timestamps and could produce false cache misses.

2. **Investigate `docs.yml` hangs**. The "Documentation CI" workflow has been logging individual runs that span **1–6 hours** before timing out or being cancelled (audit on 2026-05-12 found at least 5 such runs in the previous week). The runs cost more Actions minutes than every other workflow combined while delivering no signal. Read the workflow, identify the step that hangs (likely a `tsx scripts/check-links.ts` or `tsx scripts/validate-examples.ts` invocation that fetches every external link with no timeout), add a hard timeout, and fail fast on the first stuck request.

3. **Re-enable E2E Nightly with the underlying suite fixed**. The cron is currently commented out in `.github/workflows/e2e-nightly.yml`. Investigate why every nightly run since the VPS migration sprint failed (likely Brevo/MercadoPago credential drift, missing seed data, or a connection-string assumption baked into the test runner), fix the root cause, and re-enable the cron. Until then we lose nightly regression coverage of the P0+P1+RES paths.

4. **Static imports across the rest of the test suite**. The 2026-05-12 TestimonialsCarousel fix established the pattern (replace per-test `await import('../../src/...')` with a top-level static `import`; vitest's `vi.mock` hoisting still wires the mocks correctly). Apply it to the other ~40 files that still use the dynamic-import pattern (13 in `apps/web/test`, 6 in `apps/admin/test`, ~25 across `packages/*/test`). Each one is a low-risk mechanical edit and shaves a few hundred ms off CI under coverage instrumentation. Estimated savings: ~90 min/month.

5. **Consolidate `guards` + `docs` jobs**. Both jobs are ~1 min of script work each. Running them in a single ~2 min job instead of two ~1 min jobs saves the per-job setup overhead (checkout + pnpm install). Minor (~30 min/month) but cheap to do.

**Why MEDIUM:** none of this is launch-blocking; the quick wins already brought CI back inside the free-tier budget. Schedule when the operator has 4–6 h of focused time and wants to compound the savings.

**Acceptance:**
- One CI run on a feature branch with each change shows the expected minute savings.
- `coverage-check` still passes on main pushes after build-artifact landing.
- The E2E nightly cron is restored OR documented as a permanent on-demand workflow.

**Effort:** ~4–6 h total (1.5 h build artifact, 1–2 h docs.yml triage, 1–2 h E2E nightly triage, 30 min static imports sweep, 30 min consolidate guards+docs).

---

## 3.C — Hops toolkit hardening

### 3.C.1 — [MEDIUM · test · 3-4h] Add unit tests for hops `src/lib/`

**Where:** `scripts/server-tools/src/lib/{target,container-lookup,env}.ts` + new `scripts/server-tools/test/` dir.

**Current:** ~2000 LOC of TypeScript with zero tests. Audit flagged this as MEDIUM since hops runs against production Docker — a wrong container resolution `exec`s into the wrong app.

**Change:** Add `bun test` or `vitest` config + unit tests for:
- `resolveTarget(argv)`: flag parsing, env-var fallback, default, invalid input.
- `getAppResourceName(target, kind)`: all permutations.
- `getDbResourceName(target, kind)`: missing env var → throw with helpful message.
- `getDbCredentials(target)`: legacy `PG_USER`/`PG_DB` for prod only, target-prefixed override, defaults.
- Dotenv parser (`env.ts`): basic parsing, comments skipped, quoted values, missing file, multi-line values rejected/handled, inline comment behaviour documented.

**Acceptance:** `bun test` passes from `scripts/server-tools/`. Test coverage report shows `src/lib/` at >= 80%.

---

### 3.C.2 — [MEDIUM · ops · 1h] Smoke remaining hops commands against `--target=staging`

**Where:** VPS, via SSH.

**Current:** Only `find`, `db-counts`, `psql`, `db-backup-now`, `db-restore` were validated with target=staging during the audit. The other 14 commands inherit `findContainer()` so they SHOULD work, but were never executed.

**Change:** Run each on staging and confirm sane output:
```bash
hops --target=staging logs api --tail=10
hops --target=staging exec api -- node -v
hops --target=staging app-restart api
hops --target=staging redeploy api      # extra care — actually triggers a Coolify deploy
hops --target=staging env-list api
hops --target=staging env-set api FOO=bar      # then env-delete to undo
hops --target=staging health
hops --target=staging free-mem
hops --target=staging cron-list           # blocked by SPEC-102 (auth)
hops --target=staging cron-trigger ...    # blocked by SPEC-102
hops --target=staging prune
hops --target=staging update              # safe — git pull only
hops --target=staging find admin
hops --target=staging find web
```

Document outputs in engram. Any command that needs target-specific tweaks gets a follow-up commit.

---

### 3.C.3 — [LOW · code · 1h] Replace bespoke dotenv parser with `dotenv` package

**Where:** `scripts/server-tools/src/lib/env.ts`.

**Current:** Hand-rolled parser. Doesn't handle: inline comments (`FOO=bar # comment` → value includes "# comment"), multi-line values (bash `\`-continuation), escaped quotes inside values.

**Change:** Add `dotenv` to `scripts/server-tools/package.json` (the `apps/api` already depends on it; can hoist or add own). Replace the loop with `dotenv.parse(raw)`. Verify `bun build --compile` still works (dotenv has no platform-specific bits, should be fine).

**Why:** Operators occasionally paste env values copied from documentation that include trailing comments. Currently those comments end up baked into the value silently.

---

### 3.C.4 — [LOW · code · 30 min] Document the single-invocation contract of `setActiveTarget`

**Where:** `scripts/server-tools/src/lib/container-lookup.ts:33` (the `let activeTarget` module-level variable).

**Current:** Audit flagged this as a design smell — module-level mutable state means a future multi-command-per-process invocation would inherit the prior target.

**Change:** Either (a) add a JSDoc paragraph explicitly stating "this module assumes one command per process and does NOT reset between commands", or (b) refactor to thread `target` through `findContainer(kind, target)` and the commands. (a) is faster; (b) is correct long-term.

---

## 3.D — Auth / OAuth

### 3.D.1 — [MEDIUM · auth · 2-3h] Add unit test for `parseTrustedOrigins` in `apps/api/src/lib/auth.ts`

**Where:** `apps/api/src/lib/auth.ts:629` + new test.

**Current:** Function is unexported and only implicitly tested through integration tests that exercise `getAuth()`. Audit found the URL-validation gap that was fixed in commit `7099d6b24`. A direct unit test would have caught it earlier and protects against regression.

**Change:** Export the function (or a thin wrapper) and add a test covering: well-formed entries, empty string, missing scheme, non-http(s) scheme, duplicates, trailing comma. Assert the function logs warnings for malformed entries.

---

### 3.D.2 — [MEDIUM · auth · 6-10h] Separate OAuth apps per environment (Google + Facebook)

**Where:** Google Cloud Console + Facebook Developers Console + `apps/api` env vars.

**Current:** Both prod and staging share the same OAuth client_id/secret (single Google OAuth client + single Facebook app), with both prod and staging URIs added as Authorized origins / redirect URIs.

**Why separate:** Full isolation. Revoking staging client doesn't affect prod. Dashboards / metrics separate per env. Can ship staging-specific consent screens. Long-term hygiene win.

**Change:** Create new OAuth clients in both consoles labelled "Hospeda Staging". Update `hospeda-api-staging` env vars with the new credentials. Leave prod unchanged.

**Acceptance:** Revoking the staging Google client doesn't lock anyone out of prod. Both flows still complete end-to-end after the swap.

**Defer:** Until current shared setup proves limiting (e.g. staging abuse forces a revocation that would also kill prod).

---

### 3.D.3 — [HIGH · ops · spec already exists] Implement SPEC-102 (admin API bearer token)

**Where:** see `.claude/specs/SPEC-102-admin-api-bearer-token/spec.md`.

**Current:** Drafted, not implemented. Hops `cron-list` and `cron-trigger` smoke is deferred to this spec (validated via Section 8 of SPEC-102).

**Estimated effort:** 12-20h per the spec.

**Why HIGH for post-merge:** the cookie-pasted-from-browser auth path is friction-heavy and doesn't compose with future automation (CI healthchecks, Slack-status crons, etc.). Implementing SPEC-102 unblocks all of those.

---

## 3.E — DB ops + beta migration

### 3.E.1 — [HIGH · code · 4-6h] Implement the beta → prod migration script

**Where:** `scripts/migrate-staging-to-prod.ts` (new). See `docs/migration/staging-prod-db-separation.md` Section 10 for the full design.

**Current:** Doc exists, script doesn't. Cutover blocker once beta closes.

**Change:** Implement per the doc:
- Read SEED_TIMESTAMP from `.env` or CLI flag.
- Connect to staging DB + prod DB (CLI accepts both URLs).
- Filter beta-tester users (`created_at > SEED_TIMESTAMP`).
- Migrate users + their `accounts` rows + their accommodations + posts + events + reviews + bookmarks.
- Remap `destination_id` by slug (depends on 3.A.4).
- Dry-run mode (default) + `--execute` to actually write.
- Print summary + verify counts post-migration.
- Test against a clone of staging into a clone of prod BEFORE running for real.

**Acceptance:** Documented runbook + script tested against a snapshot pair. Counts before / after match expectation.

---

### 3.E.2 — [LOW · code · 6-10h] Implement prod → staging data sync workflow

**Where:** `scripts/db/sync-prod-to-staging.ts` + `scripts/db/sanitize-staging.ts`. See doc Section 10.9.

**Current:** Documented as future work.

**Change:** Implement when the first need arises — typically when shipping a billing change or a schema migration that needs realistic-data testing.

**Why LOW priority now:** premature without enough prod data to make the seed feel insufficient. Revisit ~1 month after public launch.

---

### 3.E.3 — [MEDIUM · code · 2h] API startup healthcheck that touches `role_permission`

**Where:** `apps/api/src/index.ts` startup phase.

**Current:** From engram lesson `vps-migration/db-schema-and-seeds-complete`: api booted "healthy" against an empty DB during Fase 12.1 because `/health` doesn't touch DB. Billing customer middleware failed silently. The TODO was captured but never implemented.

**Change:** Add a startup-time SELECT on `role_permission` (or `users` count > 0). If 0 rows → log critical + `process.exit(1)`. The container restart loop then surfaces the misconfiguration immediately.

**Acceptance:** If you `psql ... -c "DELETE FROM role_permission"` and restart the api container, it crash-loops with a clear "DB looks empty" log line.

---

## 3.F — Observability + monitoring

### 3.F.1 — [LOW · ops · 30 min] Verify Better Stack monitors target the right hosts post-split

**Where:** `https://betterstack.com` → Hospeda monitors.

**Current:** Engram confirms monitors exist for `staging-web`, `staging-admin`, `staging-api` + landing + heartbeat. They monitor by hostname, so the DB split shouldn't break them.

**Change:** Spot-check each monitor's URL is correct. Confirm each got an OK ping in the last 24h.

---

### 3.F.2 — [MEDIUM · ops · 1h] Verify Sentry environment tagging works

**Where:** Sentry dashboard.

**Current:** `HOSPEDA_SENTRY_ENVIRONMENT=production` in prod containers, `=staging` in staging. Filtering by env in Sentry should separate the two cleanly.

**Change:** Trigger a synthetic error in each env (e.g. `throw new Error('sentry-tagging-test')` in a temp endpoint). Confirm Sentry dashboard shows the error tagged with the correct env. Remove the temp endpoint.

---

## 3.G — Future improvements (low urgency, document for later)

### 3.G.1 — [LOW · ops · 1-2h] DNS-01 challenge with Cloudflare API token in Coolify

**Where:** Coolify SSL settings.

**Current:** Adding a new subdomain requires manually toggling Cloudflare proxy from 🟠 to 🔘 (DNS only) for ~5 min while Let's Encrypt completes the HTTP-01 challenge, then back to 🟠. Chronic friction during the pre-launch sprint.

**Change:** Configure Coolify with a Cloudflare API token scoped to DNS:edit for the hospeda.com.ar zone. Coolify performs DNS-01 challenge via API, no proxy toggle needed.

**Defer:** Until the next subdomain addition feels painful. Current 8 subdomains were configured with the manual flow.

---

### 3.G.2 — [LOW · ops · 2-3h] Backup encryption (GPG) — both daily cron + `db-backup-now`

**Where:** `scripts/backup/postgres-to-r2.sh` + `scripts/server-tools/src/commands/db-backup-now.ts` + `scripts/server-tools/src/commands/db-restore.ts`. See engram `vps-migration/backup-hardening-deferred`.

**Current:** Backups land in R2 unencrypted (R2 itself is encrypted at rest, but anyone with the R2 keys can read raw dumps).

**Change:** Add GPG symmetric encryption (AES256) with `BACKUP_PASSPHRASE` env var. Cover BOTH the daily cron AND the on-demand `db-backup-now`. `db-restore` decrypts before piping to `pg_restore`.

**Acceptance:** A backup file in R2 is a `.dump.gpg` and `gpg --decrypt | pg_restore --list` shows expected schema.

---

### 3.G.3 — [LOW · ops · 30 min] R2 bucket lifecycle: auto-delete `manual/*` after N days

**Where:** Cloudflare R2 dashboard → bucket lifecycle rules.

**Current:** Manual backups (`manual/hospeda-postgres-*.dump`, `manual/pre-restore-*.dump`) accumulate forever. Daily backups at root rotate via cron.

**Change:** Add a lifecycle rule: delete `manual/*` after 30 days. Pre-restore snapshots are short-term safety nets, manual backups are typically used the same day.

---

### 3.G.4 — [LOW · ops · 1h] Cron `cron-edit` command in hops

**Where:** `scripts/server-tools/src/commands/cron-edit.ts` (new).

**Current:** No way to override a cron schedule at runtime. Changing requires editing `apps/api/src/cron/jobs/<name>.ts` + redeploy. Engram tracks this as V2 backlog of the toolkit.

**Change:** Implement once a cron schedule actually needs runtime tuning. Requires backend support: a `cron_schedule_overrides` table consumed at job registration time. Spec separately when needed.

---

### 3.G.5 — [LOW · code · 4h] SshRunner — hops from laptop without SSH-in

**Where:** `scripts/server-tools/src/lib/runner.ts` already has the `Runner` interface.

**Current:** V1 ships LocalRunner only; operator must SSH to the VPS to run hops. V2 adds SshRunner that proxies docker commands over SSH from a laptop.

**Change:** Implement SshRunner. Host config in `.env.local`. CLI flag `--remote` to switch.

**Defer:** Current single-operator workflow is fine. Add when a second operator joins or when ops-from-laptop becomes a real need.

---

### 3.G.6 — [LOW · ops · 10 min] Bump hops VERSION constant + automate it

**Where:** `scripts/server-tools/src/index.ts:37`.

**Current:** `const VERSION = '0.1.0'` hardcoded since the toolkit was created. Never bumped despite 19 commands shipping over 4 tandas. `hops --version` reports stale info.

**Change:** Either (a) read from `package.json` at runtime via `import pkg from '../../package.json' with { type: 'json' }`, or (b) document a manual bump policy and set to `1.0.0` to mark V1 as shipped.

---

## 3.H — Long-term architectural improvements

### 3.H.1 — [MEDIUM · arch · spec already exists] SPEC-079 — Replace in-memory rate limit with Redis

**Where:** `apps/api/src/middlewares/rate-limit.ts:820`. See `.claude/specs/SPEC-079-*/`.

**Current:** TODO marker in code. In-memory backend works for single-instance VPS but breaks horizontal scaling.

**Defer until:** Coolify gets configured for >1 replica or the team adds a second VPS.

---

### 3.H.2 — [LOW · arch · 1-2h] Review whether `hospeda-redis` is actually used by `hospeda-api-prod`

**Where:** `hospeda-api-prod` env vars + Redis container `cyrp1g01hphqtv5w6pecbhte`.

**Current:** Discovered during hops targeting setup that the prod redis container is image hash `c8f24ba97e5c` (no tag), exists since 4 days, but `docker ps --filter "ancestor=redis:7"` did NOT match it. Suggests the image tag was deleted from the local registry. The env var `HOSPEDA_REDIS_URL` in api-prod points at it, but worth confirming the api actually opens connections (smoke via `hops --target=prod exec api -- redis-cli ...` if Redis client tools are in the image).

**Change:** Verify connection. If the connection works, no action. If api silently degrades to no-redis (rate limit falls back to memory), document that and decide whether to fix or accept.

---

### 3.H.3 — [LOW · arch · post-launch] When `apps/landing` is replaced by full `apps/web` at public launch

**Where:** `hospeda-web-prod` Coolify app + `apps/landing/` codebase.

**Current:** `hospeda-web-prod` (formerly `hospeda-landing-prod`) builds `apps/landing/` as static Astro coming-soon. At public launch this app will be reconfigured to build `apps/web/` (full Astro Node app).

**Change at cutover (NOT now):**
- Coolify: change Dockerfile path on `hospeda-web-prod` from `apps/landing/Dockerfile` to `apps/web/Dockerfile`.
- Coolify: change Port from landing's port (probably 4321 or 8080) to web's 4321.
- Coolify: add the full env var matrix (similar to `hospeda-web-staging`).
- Decide: keep `apps/landing/` codebase in repo (reusable for future "down for maintenance" pages?) or delete it. Recommended: keep, as a reference template.

**Acceptance:** `https://hospeda.com.ar/` serves the real web app instead of the coming-soon page; the same routing logic that works on staging.* now works on the apex.

---

### 3.H.4 — [LOW · arch · 4-8h] Engram cleanup — stale topic keys

**Where:** Engram persistent memory.

**Current:** Some older engrams reference pre-rename names (e.g. `hospeda-api` instead of `hospeda-api-prod`). Search results from `mem_search` may surface obsolete commands or paths.

**Change:** Periodic sweep. Items to update or delete:
- Topics referencing pre-split single DB.
- Topics with hardcoded UUIDs that have rotated.
- Topics about Vercel-era workflows (already mostly retired).

**Defer:** Quarterly sweep, not blocking anything immediate.

---

## Part 2 -- Technical Design

### 4. Implementation Order Recommendation

The backlog is large but most items are independent. Suggested order to maximise value-per-hour:

1. **Section 3.A entirely** — pre-public-launch blockers, ~3-4h total.
2. **3.B.5 (linear.service.ts typecheck fix)** — unblocks `pnpm typecheck` for any future PR.
3. **3.C.2 (smoke remaining hops commands)** — confirms targeting works end-to-end.
4. **3.D.3 (SPEC-102 implementation)** — high value, unblocks automation.
5. **3.C.1 (hops tests)** — protects against future regressions.
6. **3.E.1 (beta migration script)** — when beta is ~2 weeks from cutover.
7. Everything else as time allows.

### 5. Out-of-Scope but Worth Mentioning

Things considered for this spec but kept out:

- **Newsletter MVP improvements**: the newsletter route is sound (audit confirmed). Add features (open-rate tracking, segmentation) only when there's a marketing need.
- **CSP tightening**: current CSP is restrictive enough. Tightening further (e.g. removing `'strict-dynamic'`) requires nonce propagation work that's not urgent.
- **Search index materialisation tuning**: `search_index` mat view refresh cadence is fine for current data volume. Revisit at 10x current row counts.
- **i18n locale routing edge cases**: working as designed.

### 6. Risks

- Items in 3.A are public-launch blockers. Failing to track them = launching with sandbox MP / no staging backups / OAuth broken.
- Items in 3.C / 3.E need the operator to be familiar with hops + DB internals. Documenting the runbook in the doc references provided here makes them less risky.
- 3.G items are low-urgency; risk is they accumulate forever. Tag them with deadlines on a quarterly review cadence.

### 7. Effort Summary

| Section | Items | Total effort |
|---|---|---|
| 3.A pre-launch | 8 | ~11-18 h |
| 3.B repo hygiene | 5 | ~3 h |
| 3.C hops hardening | 4 | ~5-7 h |
| 3.D auth | 3 | ~2 h + SPEC-102 (12-20h) |
| 3.E DB / beta | 3 | ~12-18 h |
| 3.F observability | 2 | ~1.5 h |
| 3.G future | 6 | ~10 h |
| 3.H long-term | 4 | ~5-12 h |

**Critical path to public launch (3.A only):** ~11-18 h.
**Total backlog:** ~58-90 h spread over weeks-months post-merge.

**Hard sequencing inside 3.A:**
1. `3.A.0` (green-build gate) MUST pass on `main` before creating the `staging` branch.
2. `3.A.0.1` (branch protection on main + staging) IMMEDIATELY after staging branch creation.
3. The other 3.A items can run in any order after that, in parallel with each other where the operator has bandwidth.

---

## Part 3 -- Acceptance Criteria

This spec is "done" when:

- [ ] All section 3.A items are checked off and tested.
- [ ] All section 3.B items are checked off (no chronic warnings on commit).
- [ ] Hops has tests (3.C.1) and remaining commands smoked (3.C.2).
- [ ] SPEC-102 (3.D.3) is shipped or explicitly deferred with a deadline.
- [ ] Beta migration script (3.E.1) is implemented + tested before any beta cutover.
- [ ] 3.E.3 (api startup DB healthcheck) is shipped — protects every future deploy.
- [ ] 3.F items are validated (Sentry tagging works, monitors green).
- [ ] 3.G / 3.H items are reviewed quarterly and either picked up, descoped, or moved to their own specs.

When checking items off, update this spec's `status` from `draft` → `in-progress` → `completed` and update the corresponding engram topic.
