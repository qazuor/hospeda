# Progress: SPEC-202 — Destination Review Submission Flow

## 2026-06-06 — Implementation complete (17/18)

- Spec formalized, worktree created from origin/staging (406a11b1d).
- T-001..T-017 implemented and committed in 6 work-unit commits:
  - `5672827be` feat(db): unique index + dedup migration (0006_real_callisto.sql)
  - `be2dbef01` feat(schemas): DestinationReviewCreateBodySchema (strict, rejects userId/destinationId)
  - `e7dc63c28` feat(service-core): duplicate pre-check in _beforeCreate (ALREADY_EXISTS → 409)
  - `0ed7ce1cb` fix(api): userId derived from actor (impersonation gap closed) + security tests
  - `a8f161d1a` feat(i18n): 18 dimension keys + form/sidebar keys (es/en/pt)
  - `594666d10` feat(web): DestinationReviewSidebarCard island + SignInCta + page mount + tests
- Quality gate: typecheck 38/38 green; full test suite 46/46 green (service-core 4096 tests). `pnpm lint` fails in hospeda-api on STAGING BASELINE too (31 pre-existing warnings in billing tests) — SPEC-202 files lint clean.
- Adversarial review findings resolved:
  - Reviewer blocker "Zod v4 .omit() loses .strict()" REFUTED empirically (destination body schema rejects injected userId; test added). Collateral: accommodation body schema is NOT strict (pre-existing, not exploitable, saved as engram follow-up).
  - Major (soft-delete vs plain index mismatch → 500): user decided "blocked after soft-delete"; service guard aligned with the plain index (deletedAt filter removed → clean 409).
  - Minors fixed: submit disabled now includes !contentValid (+ inline hint via existing review.form.errors.contentMinLength); empty-string title/content schema tests added.

## 2026-06-06 — T-018 Chrome smoke complete (18/18) — GO

Real-browser smoke in Chrome (DevTools MCP, real input events) against worktree servers (web :4423, api :3104) and worktree DB. User rule honored: validated as a real user, not just programmatically.

**Two bugs found and fixed during smoke (both in web layer, commit pending):**

1. **Dialog never opened — root cause: `client:visible` + sticky sidebar taller than viewport.** The review card is the LAST item in `.detail-page__sidebar` (sticky, ~1384px vs ~900px viewport), so its IntersectionObserver only fired at full page scroll; until then the SSR button was dead (no listener, no error). Fixed by switching the island to `client:idle` in `[...path].astro` (+ comment to prevent regression). Verified: island hydrates at scrollY=0 immediately; real click opens dialog. Note: the React component itself was always correct — JSDOM tests (15/15) cannot cover hydration directives.
2. **Double slash in sign-in CTA URL** (`/es/auth/signin//?returnUrl=`): `buildUrl()` already appends a trailing slash; `DestinationReviewSignInCta.astro` added another. Fixed; verified in isolated logged-out context: `/es/auth/signin/?returnUrl=%2Fes%2Fdestinos%2F...%2Fconcordia%2F` (no `//`).

**Smoke checklist — all verified:**

- ✅ Logged out: "Tu opinión" card + "Iniciá sesión para opinar" with clean returnUrl (isolated context).
- ✅ Logged in (<tourist-free@local.test>): card shows "Dejar reseña"; real click opens `<dialog>` (screenshot `/tmp/spec202-smoke-2-dialog-open.png`).
- ✅ 18 dimension rows with i18n labels; submit disabled until all rated; filled 18×5 stars + title + comment via real clicks (screenshot `/tmp/spec202-smoke-3-form-filled.png`).
- ✅ Submit → review created; success path ran (component reloads page after 1400ms; pendingNotice copy itself covered by component test).
- ✅ DB: `moderation_state=PENDING`, `user_id` = <tourist-free@local.test> (actor-derived userId security fix confirmed), full 18-dim rating JSON persisted.
- ✅ Approved via `POST /api/v1/admin/destinations/reviews/{id}/moderate` as superadmin → `APPROVED`, `moderatedById`/`moderatedAt` set. (<editor@local.test> got 403 — lacks DESTINATION_REVIEW_MODERATE; expected.)
- ✅ Public visibility: page shows "3 reseñas" (was 2) and the new review title in the reviews modal (screenshot `/tmp/spec202-smoke-4-review-public.png`).
- ✅ Duplicate attempt → 409 with exact copy "Ya enviaste una reseña para este destino." shown inline in the dialog (screenshot `/tmp/spec202-smoke-5-409-already-reviewed.png`).

Post-fix gates: web typecheck green, card component tests 15/15 green. Biome does not process `.astro` files (expected).

**Follow-up noted (NOT SPEC-202):** at max page scroll the sticky `.wave-header__bar` (z-index ~49) covers the bottom of the sticky sidebar, intercepting clicks on whatever card sits there (site-wide DetailLayout/WaveHeader quirk, affects alojamientos too). Saved to engram.

## Pending

- Open PR → staging (after committing smoke fixes + tracking).
