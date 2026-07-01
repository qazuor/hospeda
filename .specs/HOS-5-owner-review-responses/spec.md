---
title: Owner Review Responses
linear: HOS-5
statusSource: linear
created: 2026-06-26
type: feature
areas:
  - web
  - api
---

# Owner Review Responses

> Migrated from `.qtm/specs/SPEC-290-owner-review-responses/spec.md` on 2026-07-01 as part of the Linear tracking migration. Canonical tracking is now HOS-5.

## 1. Summary

The entitlement `RESPOND_REVIEWS` is granted to owner/complex plans, but the feature **does not exist**: `gateReviewResponse()` in
`apps/api/src/middlewares/accommodation-entitlements.ts` is a
`// PHANTOM-GATE (SPEC-145)` — there is no `POST /accommodations/:id/reviews/:reviewId/response`
route, and `accommodation_reviews` has **no `owner_reply` / `response` / `responded_at`
column**.

This spec builds owner replies to accommodation reviews.

## 2. Context

- **Verified 2026-06-26:** phantom gate; only `POST /reviews` (create) exists; no
  reply endpoint, no DB column, no UI.

## 3. Goals

- **G-1** Add the owner-reply column(s) to `accommodation_reviews` (+ schema).
- **G-2** A gated route for the listing owner to respond to a review; mount
  `RESPOND_REVIEWS`.
- **G-3** Render owner replies under the review (web public + owner dashboard).

## 4. Non-Goals

- No moderation workflow changes beyond what a reply needs.
- One reply per review in v1 (no threaded back-and-forth) unless OQ-1 expands it.

## 5. Open Questions

- **OQ-1** One reply per review vs editable/threaded.
- **OQ-2** Moderation: are owner replies moderated like reviews?
- **OQ-3** Should the tourist who wrote the review be notified when the owner
  responds, and on which channel (email, in-app)?

## 6. Relationship to SPEC-282

The "Responder reseñas" row stays *Próximamente* until this ships.

## 7. Related

- **SPEC-317** — duplicate stub of this spec, generated independently by the
  SPEC-310 roadmap audit (created 2026-06-30, same `RESPOND_REVIEWS`/
  `gateReviewResponse` phantom gate). Consolidated into this spec on
  2026-07-01 (folded in OQ-3, the reviewer-notification question); marked
  `obsolete` in the tracking indices.
- **SPEC-311** (WhatsApp contact) — sibling owner-basico+ feature in the same
  tier block.
