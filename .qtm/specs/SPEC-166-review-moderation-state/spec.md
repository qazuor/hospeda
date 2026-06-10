---
specId: SPEC-166
title: Review Moderation State
status: completed
complexity: medium
owner: qazuor
created: 2026-05-27
updated: 2026-06-04
related:
  - SPEC-155 (admin-dashboards-v1 — origin; feeds ADMIN card F reviews-pending sub-slot)
  - SPEC-195 (content-auto-moderation — spun off from this spec; implements the real scoring engine + DB-backed editable word lists inside @repo/content-moderation)
---

# SPEC-166 — Review Moderation State

> **Status**: IN-PROGRESS — full spec authored 2026-06-04 from the phase-2 stub, owner-approved. Product decisions resolved in session (see §3). Next: generate tasks.

## 1. Origin

Extracted from SPEC-155 Phase-1 scout on 2026-05-27.

**Concrete finding**: SPEC-155 assumed a route (`GET /api/v1/admin/reviews/pending-count`) buildable without DB changes. The scout found that `accommodation_reviews` and `destination_reviews` only have a `lifecycleState` column (ACTIVE/ARCHIVED), NOT a `moderationState`. There is no pending-review moderation concept in the current schema. As a result, SPEC-155 ADMIN card F's reviews-pending sub-slot renders a deferred placeholder pointing to this spec.

## 2. Goal

Introduce a `moderationState` lifecycle (`PENDING | APPROVED | REJECTED`) on both review tables so that:

- Reviews can be gated before becoming publicly visible, with a **hybrid default** per entity type (see §3.1).
- Incoming review text is passed through a **content-moderation check** at creation time, which can force a review into `PENDING`.
- ADMIN/SUPER_ADMIN can approve or reject reviews from an admin moderation queue.
- A pending-review count endpoint feeds SPEC-155 ADMIN dashboard card F.
- The existing `lifecycleState` (ACTIVE/ARCHIVED) is preserved alongside the new `moderationState`, and the two remain **independent** (see §3.4).

A second, separable goal: stop duplicating content-filtering logic. The word-list check currently buried inside `MessageService` is extracted into a new shared package `@repo/content-moderation` with a **final-shape public API** (returns a score), even though its internals stay a stub in this spec (see §4).

## 3. Resolved product decisions

These were the stub's open questions. Resolved in session 2026-06-04.

### 3.1 Default moderationState for new reviews — HYBRID

| Entity | Default on create | Rationale |
|--------|-------------------|-----------|
| **Destination review** | `PENDING` | Anyone can write one, no transactional barrier → must be moderated before public. |
| **Accommodation review** | `APPROVED` | Today there's a weak barrier (reviewer must have opened a conversation with the host). Publish instantly, moderate reactively. Future reservation system → verified post-stay reviews stay APPROVED with no moderation (Airbnb model). |

Implemented via a single resolver `resolveInitialModerationState({ entityType, verificationLevel, moderationScore })` so the future "verified-by-reservation → APPROVED" branch slots in **without schema or call-site changes**.

**Industry basis**: platforms that verify the transaction (Airbnb, Booking) do NOT pre-moderate; platforms where anyone can write (Google, Yelp) publish instantly and moderate post-publication. Human pre-moderation per-review does not scale — so accommodation (semi-verified, future-verified) defaults to APPROVED, destination (unverified) to PENDING.

### 3.2 Content-moderation gate on creation

At review creation the text is checked via `@repo/content-moderation`. The package returns a **score** (0–1) plus category/term data; the review service maps that score to the initial state:

- `score >= REJECT_THRESHOLD` → `REJECTED` (auto). *(In this spec the stub engine is binary, so this branch only fires on a direct blocked-word hit if the owner sets the reject threshold ≤ the stub's match score. Default: do NOT auto-reject from the stub — see §4.3.)*
- `score >= PENDING_THRESHOLD` → `PENDING` (queued for human review), regardless of the per-entity default.
- below threshold → falls through to the per-entity default from §3.1.

With the stub engine (binary match→1.0 / clean→0.0) this collapses to: **blocked word present → PENDING; clean → entity default**. When the real engine lands (separate spec), the same thresholds begin producing graded REJECTED/PENDING decisions with **no change to SPEC-166 code**.

### 3.3 Permissions — already exist, nothing to create

The stub assumed a generic `REVIEW_MODERATE`. It does NOT exist. What exists (and is correct per the project's entity-specific convention):

- `ACCOMMODATION_REVIEW_MODERATE = 'accommodation.review.moderate'` — `permission.enum.ts:86`
- `DESTINATION_REVIEW_MODERATE = 'destination.review.moderate'` — `permission.enum.ts:164`

Action: verify both are granted to ADMIN and SUPER_ADMIN in the role seed; grant if missing. No new permission enum entries.

### 3.4 moderationState ⟂ lifecycleState — independent

The two are orthogonal:

- `moderationState` (PENDING/APPROVED/REJECTED) → governs **public visibility gate**.
- `lifecycleState` (ACTIVE/ARCHIVED) → existing soft archival, untouched.

A REJECTED review does NOT flip `lifecycleState`. Public visibility = `moderationState = 'APPROVED' AND lifecycleState = 'ACTIVE'`.

### 3.5 Retroactive moderation — migration default APPROVED

Existing rows were already publicly visible → migration backfills `moderationState = 'APPROVED'`. No bulk-approve admin tool needed.

### 3.6 Deferred to v2 (documented, OUT of scope here)

- **Reviewer notification on rejection** — proposed: in-app notification when a review is rejected. Deferred to avoid coupling SPEC-166 to `@repo/notifications`. Decision to confirm at v2.
- **Re-submission after rejection** — REJECTED is terminal in v1; the reviewer may create a new review. No edit-and-resubmit flow.
- **Appeal flow** — none in v1.

## 4. Architecture: `@repo/content-moderation` (new shared package)

### 4.1 Why a package

The word-list filter lives privately inside `MessageService` (`packages/service-core/src/services/conversation/message.service.ts:29-47, 262-311`) — `parseBlocklist` + `_validateMessageContent`, a case-insensitive substring scan that throws on match. It is not callable from anywhere else. Reviews need the same check; tomorrow posts/comments/bios will too. Per the project's Single-Source-of-Truth rule, this becomes one shared package.

### 4.2 Public API — FINAL shape (contract-first)

The API is authored in its final form now; only the internals are a stub.

```ts
// @repo/content-moderation
export type ModerationCategory =
  | 'spam' | 'sexual' | 'violence' | 'hate' | 'harassment' | 'other';

export type ModerationResult = {
  readonly score: number;                       // 0..1 overall severity
  readonly categories: Readonly<Record<ModerationCategory, number>>; // per-category 0..1
  readonly matchedTerms: readonly string[];     // terms/domains that triggered
};

export type ModerateTextInput = {
  readonly text: string;
  readonly context?: 'review' | 'message' | 'post' | string; // for future per-context lists
};

// async from day one — the future engine (e.g. OpenAI Moderation API) is async,
// so consumers await now and the contract never changes when internals land.
export function moderateText(input: ModerateTextInput): Promise<ModerationResult>;
```

Design notes:

- **Returns data, not a decision.** Each consumer maps `score`/`categories` to its own action (messaging blocks; reviews → PENDING/REJECTED). Owner-confirmed.
- **Async** even though the stub is synchronous internally — locks the contract against the future engine.
- RORO, named exports, JSDoc, Zod-validated input — per project standards.

### 4.3 Internals in THIS spec — stub

- Internally keeps the current substring-match logic, reading `HOSPEDA_MESSAGING_BLOCKED_WORDS` / `HOSPEDA_MESSAGING_BLOCKED_DOMAINS` from env (unchanged source).
- Maps to the result shape: any blocked term → `score = 1.0`, `categories.other = 1.0`, `matchedTerms = [...]`; clean → all zeros, empty terms.
- Default thresholds wired so the stub only ever produces PENDING (not auto-REJECTED) for reviews, matching §3.2.

### 4.4 Consumer migration

- **Messaging**: `MessageService._validateMessageContent` rewritten to `await moderateText({ text: body, context: 'message' })` and throw `MESSAGE_CONTENT_BLOCKED` when `matchedTerms.length > 0` (preserves current behavior exactly). Remove the now-dead `parseBlocklist` / module constants.
- **Reviews**: both review services call `moderateText` on create and feed the score into `resolveInitialModerationState`.

### 4.5 Env registration fix

`HOSPEDA_MESSAGING_BLOCKED_WORDS` / `_BLOCKED_DOMAINS` are registered in `env-registry.hospeda.ts` but absent from `ApiEnvBaseSchema` (`apps/api/src/utils/env.ts`) — read directly from `process.env`. Add them to the Zod schema as part of this spec.

## 5. Schema changes

- New PG enum `ReviewModerationStatePgEnum` = `PENDING | APPROVED | REJECTED`.
- `accommodation_reviews.moderationState` — not null, no hardcoded column default (set in service via resolver).
- `destination_reviews.moderationState` — same.
- Moderation audit fields on both: `moderatedById` (fk users, nullable), `moderatedAt` (timestamp, nullable), `moderationReason` (text, nullable). Note: `destination_reviews` currently lacks the `adminInfo` jsonb that `accommodation_reviews` has — use explicit columns on both for symmetry rather than reusing `adminInfo`.
- **Migration carril**: structural change → `pnpm db:generate` + `pnpm db:migrate` (versioned migrations per SPEC-178). NOT `db:push`. Backfill existing rows to `APPROVED` in the same migration.

## 6. Service-core changes

- `resolveInitialModerationState({ entityType, verificationLevel, moderationScore })` helper (shared by both review services). `verificationLevel` is a forward-looking input; in v1 accommodation = `'semi'`, destination = `'none'`.
- `accommodationReview.service` + `destinationReview.service`: on create, call `moderateText`, resolve initial state, persist.
- New service methods: `moderateReview({ id, decision, reason, actor })` (approve/reject, permission-checked, sets audit fields), `getPendingCount({ actor })`.
- Public read paths add `moderationState = 'APPROVED'` to the existing `lifecycleState = 'ACTIVE'` filter (accommodation `:172/:184`, destination `:184/:202`).
- HOST dashboard review listings (SPEC-155 card E) → APPROVED only.

## 7. API endpoints

- `GET /api/v1/admin/reviews/pending-count` → `{ data: { count, byType: { accommodationReviews, destinationReviews } } }`. Requires `ACCOMMODATION_REVIEW_MODERATE` OR `DESTINATION_REVIEW_MODERATE` (per-type counts gated by the matching permission).
- `POST /api/v1/admin/accommodation-reviews/:id/moderate` and `.../destination-reviews/:id/moderate` → body `{ decision: 'APPROVED'|'REJECTED', reason?: string }`. Permission-gated per entity.
- Admin review list routes: expose `moderationState` as a filter + display field.

## 8. Out of scope → SPEC nueva (content-auto-moderation)

A separate spec implements ONLY the internals of `@repo/content-moderation` — no consumer changes, since the contract is frozen here:

- Real scoring engine with categories (e.g. OpenAI Moderation API — free, returns per-category scores).
- **Word lists moved from env var to DB**: editable table + admin UI, so a newly detected word needs no redeploy.
- Graded REJECT/PENDING thresholds become meaningful (stub was binary).

## 9. Acceptance criteria

1. New PG enum + `moderationState` (+ audit columns) on both review tables via a versioned migration; existing rows backfilled to APPROVED.
2. `@repo/content-moderation` exists, exports `moderateText` with the §4.2 final shape (async, returns score/categories/matchedTerms).
3. Messaging uses `moderateText`; the old in-service word-list code is deleted; message-blocking behavior is unchanged (regression test).
4. Destination reviews default to PENDING; accommodation reviews default to APPROVED; a blocked-word hit forces PENDING on either.
5. Public + HOST review listings return only `APPROVED` + `ACTIVE` reviews.
6. `GET /admin/reviews/pending-count` returns the correct split and is permission-gated.
7. Admin can approve/reject a review; audit fields (`moderatedById/At/Reason`) are set; REJECTED hides from public; `lifecycleState` is untouched.
8. SPEC-155 ADMIN card F reviews-pending sub-slot can consume the live count.
9. `HOSPEDA_MESSAGING_BLOCKED_WORDS`/`_BLOCKED_DOMAINS` added to `ApiEnvBaseSchema`.

## 10. Test plan

- **content-moderation**: unit tests on `moderateText` stub (match→score 1.0 + terms; clean→zeros; domains; case-insensitivity).
- **messaging regression**: blocked word still throws `MESSAGE_CONTENT_BLOCKED`; clean passes.
- **review services**: default-state-by-entity; blocked-word→PENDING; public/host read filters; `moderateReview` approve/reject + audit + permission denial paths.
- **routes (integration)**: pending-count split + permission gating; moderate endpoints happy + 403.
- AAA, ≥90% coverage on new service logic.

## 11. Risks

- Migration backfill must run before public filters ship, or existing reviews vanish from public listings (they'd be non-APPROVED). Same migration handles both.
- Extracting `MessageService` logic must preserve exact blocking semantics — regression test is the gate.
- The "score" is fake in v1 (binary). Reject-threshold must be configured so the stub never auto-rejects, to avoid false REJECTs before the real engine exists.
