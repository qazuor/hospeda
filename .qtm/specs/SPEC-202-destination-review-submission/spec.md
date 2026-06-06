---
spec-id: SPEC-202
title: Destination Review Submission Flow (web) + API contract/security fix
type: feature
complexity: high
status: approved
created: 2026-06-06T08:45:00Z
---

# SPEC-202 — Destination Review Submission Flow (web) + API Contract/Security Fix

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal**: Let authenticated web users submit a review for a destination from the destination detail page, and fix two API-level defects found during diagnosis (impersonation gap, missing uniqueness guarantee).

**Motivation**: The destination reviews backend is fully built (DB table, `DestinationReviewService`, protected create endpoint gated by the `WRITE_REVIEWS` entitlement) and the web app *displays* reviews — but there is no UI anywhere to create one. Users cannot leave destination reviews at all. Additionally, the create endpoint accepts a client-supplied `userId` that is never validated against the authenticated actor (impersonation vulnerability), and nothing prevents one user from submitting unlimited reviews for the same destination.

**Success criteria**:

1. An authenticated user can submit a destination review (18 rating dimensions + optional title + optional content) from the destination detail page sidebar.
2. A logged-out user sees a sign-in CTA card in the same sidebar slot.
3. The submitted review is created with `moderationState = PENDING` and the user is told it awaits moderation.
4. The API derives `userId` exclusively from the authenticated actor; a `userId` in the request body is rejected (400, strict schema).
5. A second review by the same user for the same destination is rejected with HTTP 409 (`ALREADY_EXISTS`), enforced at both service and DB level.

### 2. User Stories & Acceptance Criteria

#### US-1 — Submit a destination review (authenticated)

> As a logged-in tourist, I want to rate a destination and leave a comment, so other travelers can benefit from my experience.

- **AC-1.1** Given an authenticated user with the `WRITE_REVIEWS` entitlement on a destination detail page, When the sidebar renders, Then a review card with a "Dejar reseña" CTA is visible (after the existing sidebar CTAs).
- **AC-1.2** Given the review dialog is open, When fewer than all 18 dimensions are rated (each ≥ 1), Then the submit button is disabled and a hint explains all ratings are required.
- **AC-1.3** Given all 18 dimensions are rated, When the user submits (title ≤ 50 chars optional, content 10–500 chars optional), Then a POST is sent to `/api/v1/protected/destinations/{destinationId}/reviews` with `credentials: 'include'` and a body containing ONLY `rating`, `title?`, `content?`.
- **AC-1.4** Given a successful creation (2xx), When the success state renders, Then it explicitly says the review is pending moderation and will be visible after approval, and the page reloads after ~1.4s.
- **AC-1.5** Given the created review, Then it has `moderationState = PENDING` and does NOT appear in the public review list until approved via admin moderation.

#### US-2 — Sign-in CTA (logged out)

> As a visitor who is not signed in, I want to know I can leave a review after signing in.

- **AC-2.1** Given a logged-out visitor on a destination detail page, When the sidebar renders, Then a static (zero-JS) card invites them to sign in to leave a review, linking to the sign-in page with a redirect back to the current destination path.

#### US-3 — One review per user per destination

> As the platform, I want at most one review per user per destination, so ratings cannot be spammed or inflated.

- **AC-3.1** Given a user who already has a non-deleted review for a destination, When they submit another, Then the API responds HTTP 409 with `error.code = ALREADY_EXISTS` and the form shows "Ya enviaste una reseña para este destino."
- **AC-3.2** Given concurrent duplicate submissions racing past the service pre-check, Then the DB unique index `(user_id, destination_id)` rejects the second insert.
- **AC-3.3** Given existing duplicate rows in `destination_reviews` at migration time, When the migration runs, Then duplicates are removed keeping the most recent row per `(user_id, destination_id)` before the unique index is created.

#### US-4 — Anti-impersonation (security fix)

> As the platform, I want review authorship to come exclusively from the session, so no user can write reviews as someone else.

- **AC-4.1** Given any authenticated request to the create endpoint, When the body includes a `userId` field, Then validation fails with HTTP 400 (strict schema rejects unknown keys).
- **AC-4.2** Given a valid creation request, Then the persisted review's `userId` equals the authenticated actor's id, regardless of anything in the request.
- **AC-4.3** The `requireEntitlement(WRITE_REVIEWS)` gate remains in place (403 `ENTITLEMENT_REQUIRED` without it; staff bypass per INV-6 unchanged).

#### US-5 — Localized rating dimensions

> As a non-Spanish user, I want the 18 rating dimension labels in my language.

- **AC-5.1** The 18 keys `destination.rating.dimensions.*` exist in `es`, `en`, and `pt` locale files and are used by both the new form and the existing `DestinationRatingBreakdown.astro` (which already calls `t(key, fallback)` — no code change needed there).

### 3. UX Considerations

- **Form**: dialog opened from the sidebar card, mirroring `ReviewSidebarCard.client.tsx` (accommodation). 18 star rows (`role="radiogroup"` / `role="radio"` APG pattern), title input (max 50), content textarea (max 500), inline error with `role="alert"`, success via `<output>`.
- **Pending-moderation message**: destination reviews start `PENDING` (unlike accommodation's auto-approve) — the success copy must say the review awaits approval, to avoid "where is my review?" confusion.
- **Error states**: 409 → specific "already reviewed" copy; 403 entitlement → translated `ENTITLEMENT_REQUIRED`; network failure → `apiError.NETWORK_ERROR`; validation → generic message.
- **Hydration**: island mounted `client:visible` (sidebar position → loads lazily).
- **Accessibility**: ESC closes dialog; submit disabled state announced via `aria-live="polite"` hint; star buttons keyboard-operable.

### 4. Out of Scope

- Trip-context fields in the form (`visitDate`, `tripType`, `travelSeason`, `isBusinessTravel`, `isRecommended`, `wouldVisitAgain`) — defaults apply.
- Editing/deleting own destination reviews from the web.
- Review helpful-vote UI.
- Fixing the pre-existing Zod/DB drift on `DestinationReviewSchema` (~15 schema fields without DB columns) — documented, untouched.
- Accommodation review flow changes (the 409-specific copy gap there is documented, not fixed here).
- Conversation/stay prerequisite for destination reviews (none exists by design).

## Part 2 — Technical Analysis

### 1. Architecture

Mirror of the accommodation review flow, layer by layer:

```
Web island (DestinationReviewSidebarCard.client.tsx)
  → destinationReviewsApi.create()  [endpoints-protected.ts]
  → POST /api/v1/protected/destinations/{destinationId}/reviews
      body: DestinationReviewCreateBodySchema (rating + title? + content?)
      middleware: auth → actor → billing → trial → requireEntitlement(WRITE_REVIEWS)
  → handler injects { destinationId: path param, userId: actor.id }
  → DestinationReviewService.create()
      _canCreate: PermissionEnum.DESTINATION_REVIEW_CREATE
      _beforeCreate: duplicate pre-check (findOne userId+destinationId+deletedAt:null → ALREADY_EXISTS)
                     + existing content moderation (→ moderationState PENDING)
      _afterCreate: recompute averageRating, destination stats, cache revalidation (existing)
  → DB: destination_reviews + NEW unique index (user_id, destination_id)
```

### 2. Data Model Changes

- `packages/db/src/schemas/destination/destination_review.dbschema.ts`: add `uniqueIndex('destination_reviews_user_destination_uniq').on(table.userId, table.destinationId)`. Plain (non-partial) index, matching `accommodation_reviews_user_accommodation_uniq` semantics (soft-deleted rows still block re-review — accepted for parity).
- New drizzle migration (via `pnpm --filter @repo/db db:generate`), **hand-edited** to prepend a dedup statement before the index:

```sql
DELETE FROM "destination_reviews" dr
WHERE dr.id NOT IN (
    SELECT DISTINCT ON (user_id, destination_id) id
    FROM "destination_reviews"
    ORDER BY user_id, destination_id, created_at DESC
);
--> statement-breakpoint
CREATE UNIQUE INDEX "destination_reviews_user_destination_uniq"
    ON "destination_reviews" USING btree ("user_id","destination_id");
```

- Apply via `pnpm db:migrate` only (`db:push` forbidden for staging/prod). Staging first, verify, then prod.

### 3. API Design

`POST /api/v1/protected/destinations/{destinationId}/reviews`

- **Request body** (new `DestinationReviewCreateBodySchema = DestinationReviewCreateInputSchema.omit({ destinationId, userId })`, strict inherited):

```json
{
  "rating": { "landscape": 5, "attractions": 4, "...": 0-5, "weatherSatisfaction": 5 },
  "title": "Hermoso lugar",
  "content": "Pasamos un finde excelente, mucha naturaleza."
}
```

- **Responses**: 200/201 created (review with `moderationState: PENDING`); 400 `VALIDATION_ERROR` (bad rating, unknown keys incl. `userId`); 401 unauthenticated; 403 `ENTITLEMENT_REQUIRED` or `FORBIDDEN` (permission); 409 `ALREADY_EXISTS` (duplicate); 503 billing service failure.
- Error mapping is existing behavior via `handleRouteError` (`ALREADY_EXISTS → 409`).

### 4. Dependencies

None new. Everything reuses: `@repo/schemas`, `@repo/service-core`, `@repo/db`, `@repo/i18n`, existing `apiClient.postProtected`, existing route factory + entitlement middleware.

### 5. Risks & Mitigations

| Risk | Prob. | Impact | Mitigation |
|---|---|---|---|
| Migration dedup deletes legit older duplicates in prod | Low (no form ever existed; reviews are seed/admin-created) | Medium | Run on staging first; verify row counts before prod |
| Existing integration smoke test breaks (`create.test.ts` posts to `/public/` with `userId` in body) | Certain | Low | Update the test as part of this spec (it encodes the wrong contract) |
| `DestinationReviewSidebarCard` exceeds 500-line cap (18 rows) | Medium | Low | Inline `StarRatingRow` helper; dimension list as const |
| Race between service pre-check and insert | Low | Low | DB unique index is the backstop (409 via constraint) |
| i18n keys colliding with existing `destination.json` structure | Low | Low | `destination.rating.outOf` already exists; add `dimensions` sibling |

### 6. Performance Considerations

- Pre-check adds one indexed `findOne` per creation (uses new unique index) — negligible.
- Island hydrates `client:visible`; no impact on destination page LCP.
- Public review list cache (300s) + existing revalidation hooks unchanged.

## Implementation Approach (phases)

1. **Setup** — DB unique index + migration (with dedup), `DestinationReviewCreateBodySchema`, i18n keys (18 dimensions × 3 locales in `destination.json`; form/sidebar keys in `review.json`).
2. **Core** — service duplicate guard in `_beforeCreate`; route switched to body schema + `userId: actor.id` injection.
3. **Web** — `destinationReviewsApi.create()`; `DestinationReviewSidebarCard.client.tsx` + module.css; `DestinationReviewSignInCta.astro`; mount both in `destinos/[...path].astro` sidebar.
4. **Testing** — schema strictness tests; service duplicate-guard tests; route anti-impersonation regression + 409 + entitlement gate; fix legacy integration smoke; web component tests (render, gating, success/pending copy, 409, network error, ESC).
5. **Docs/cleanup** — verify `docs/billing/endpoint-gate-matrix.md` row for this route (snapshot guard parses it).

### Testing Strategy (no tests = not done)

| Layer | File | Cases |
|---|---|---|
| Schemas | `packages/schemas/test/entities/destinationReview/destinationReview.crud.schema.test.ts` | body accepts rating-only; rejects `userId`; rejects `destinationId`; rating bounds 0–5; title ≤ 50; content 10–500 |
| Service | `packages/service-core/test/services/destinationReview/create.test.ts` (extend) | `_beforeCreate` throws `ALREADY_EXISTS` when findOne hits; proceeds when null; soft-deleted row excluded from pre-check filter |
| API | new `apps/api/test/routes/destination-reviews/create.security.test.ts` + extend `promotion-and-review-entitlement-gates.test.ts` | persisted userId = actor id; body `userId` → 400; duplicate → 409; entitlement gate → 403; staff bypass |
| API (legacy) | `apps/api/test/integration/destination-reviews/create.test.ts` | update to `/protected/` tier + new body shape |
| Web | `apps/web/test/components/destination/DestinationReviewSidebarCard.test.tsx` | render card; open dialog; submit disabled until 18 rated; success shows pending notice; 409 shows alreadyReviewed; network error; ESC closes |

## Internal Review Notes

- **Pass 1 (completeness)**: body schema derivation, exact i18n key list, title/content limits (50/500 — destination-specific, NOT accommodation's 200/2000) made explicit after verifying `DestinationReviewSchema`.
- **Pass 2 (coherence)**: duplicate guard placed in `_beforeCreate` (not the route) mirroring `AccommodationReviewService`; plain unique index (not partial) for parity with accommodation; static Astro CTA for logged-out users (no needless island).
- **Pass 3 (external APIs)**: N/A — no external services.
- **Pass 4 (testability)**: every AC maps to a test row in the matrix above; AC-3.3 (migration dedup) verified manually on staging (migration SQL is not unit-testable in this setup — documented limitation).
- Open questions: none — product decisions (18 dims, uniqueness, sidebar placement, minimal fields) locked with the user on 2026-06-06.
