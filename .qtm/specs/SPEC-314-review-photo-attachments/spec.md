---
specId: SPEC-314
title: Review Photo Attachments
type: feature
complexity: medium
status: draft
created: 2026-06-30T00:00:00Z
base: staging
---

# SPEC-314 — Review Photo Attachments

> **Stub (backlog).** Created from the SPEC-310 plan-packaging audit, which found this feature is advertised in the billing plans but is a phantom gate (`gateReviewPhotos` PHANTOM-GATE; the review create schema has no photo fields and the review form has no file input). This stub captures the objective; it must go through full discovery (/task-master:spec-review or /spec) before implementation.

## Overview

Tourist-plus and tourist-vip should be able to attach photos to their accommodation reviews (`CAN_ATTACH_REVIEW_PHOTOS` entitlement). The Cloudinary upload pattern already exists in the project (used for accommodation gallery), so the upload infrastructure is available. What is missing is: photo fields on the review schema/table, gate enforcement on review creation, a file input in the web review form, and photo rendering in review lists/cards.

## Why now

Part of the SPEC-310 roadmap to stop selling unimplemented features. `CAN_ATTACH_REVIEW_PHOTOS` is advertised as a paying-tourist feature, but the review data model has no photo storage, the API gate is a phantom, and the frontend form has no file input.

## Scope (to refine in discovery)

- Add photo storage to the review entity: either a JSONB `photos` column or a separate `review_photos` table; upload to Cloudinary following the existing gallery pattern.
- Enforce `CAN_ATTACH_REVIEW_PHOTOS` gate on the review create/update API endpoint.
- Add a file input (with preview) to the web review submission form, visible only to eligible tourists.
- Render attached photos in the review list and review detail view.

## Out of scope (initial)

- Anything beyond the single feature; pricing/limit calibration lives in SPEC-310.

## Open questions

- What is the maximum number of photos allowed per review (e.g., 3, 5, 10)?
- Is there a moderation step for review photos before they become publicly visible, or do they go live immediately on upload?

## Related

- Parent audit: SPEC-310 (plan packaging recalibration).
- SPEC-312 (tourist price alerts) and SPEC-313 (exclusive deals) — sibling tourist phantom gates.
