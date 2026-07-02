---
specId: SPEC-317
title: Owner Review Responses
type: feature
complexity: medium
status: draft
created: 2026-06-30T00:00:00Z
base: staging
---

# SPEC-317 — Owner Review Responses

> **Stub (backlog).** Created from the SPEC-310 plan-packaging audit, which found this feature is advertised in the billing plans but is a phantom gate (`gateReviewResponse` PHANTOM-GATE; no respond-to-review endpoint exists; only review CREATE is implemented; there is no host UI for responding). This stub captures the objective; it must go through full discovery (/task-master:spec-review or /spec) before implementation.

## Overview

Owner-basico and above (`RESPOND_REVIEWS` entitlement) should be able to post a public reply to tourist reviews left on their accommodations. The response appears beneath the original review on the accommodation detail page, giving hosts a voice in managing their reputation. This is a standard hospitality platform feature with no implementation today beyond the review creation endpoint.

## Why now

Part of the SPEC-310 roadmap to stop selling unimplemented features. `RESPOND_REVIEWS` is advertised for owner-basico+ but the gate is phantom — there is no response endpoint, no DB storage for responses, and no owner or tourist UI. Hosts currently have no way to reply to reviews.

## Scope (to refine in discovery)

- Add a `response` field (text, respondedAt, responderId) to the `reviews` table (or a separate `review_responses` relation).
- Implement `POST /api/v1/protected/accommodations/:id/reviews/:reviewId/response` gated behind `RESPOND_REVIEWS` and verifying the caller owns the accommodation.
- Add a "Reply" interface to the host-facing accommodation management UI in the web owner editor.
- Render the owner response visually below the review in the public accommodation detail page.

## Out of scope (initial)

- Anything beyond the single feature; pricing/limit calibration lives in SPEC-310.

## Open questions

- Is one response per review allowed (with an edit option), or can the host reply multiple times (threaded)? If editable, should the reviewer be notified of edits?
- Should the tourist who wrote the review receive a notification when the owner responds? If yes, which channel (email, in-app)?

## Related

- Parent audit: SPEC-310 (plan packaging recalibration).
- SPEC-311 (WhatsApp contact) — sibling owner-basico+ feature in the same tier block.
- SPEC-318 (owner custom branding) and SPEC-319 (verification badge) — owner-premium phantom features.
