---
specId: SPEC-320
title: Featured Listing Automation
type: feature
complexity: medium
status: draft
created: 2026-06-30T00:00:00Z
base: staging
---

# SPEC-320 — Featured Listing Automation

> **Stub (backlog).** Created from the SPEC-310 plan-packaging audit, which found this feature is advertised in the billing plans but is PARTIAL (the DB `isFeatured` column, a home featured section, and an admin manual toggle all exist, but there is NO owner self-service and NO auto-activation on subscription or addon purchase — an admin must flip the flag by hand). This stub captures the objective; it must go through full discovery (/task-master:spec-review or /spec) before implementation.

## Overview

Owner-pro and owner-premium subscribers (and visibility-boost addon purchasers) should have their accommodations auto-featured when the relevant plan or addon activates (`FEATURED_LISTING` / `isFeatured` entitlement). Equally, the featured flag should auto-clear when the plan downgrades or the addon expires. An optional owner self-service toggle (within their entitlement limit) is also in scope. Today an admin must manually flip `isFeatured` in the admin panel for each accommodation, which does not scale.

## Why now

Part of the SPEC-310 roadmap to stop selling unimplemented features. `FEATURED_LISTING` is the most commercially significant phantom — it is a core selling point of pro/premium plans and the visibility-boost addon. The infrastructure (DB column, home section rendering, admin toggle) exists but lifecycle automation does not, creating ongoing admin toil and broken expectations on purchase.

## Scope (to refine in discovery)

- Hook into the subscription activation/change/cancel lifecycle events (existing cron or webhook handlers in `apps/api/src/cron/jobs/` and billing routes) to auto-set/clear `isFeatured` based on the entitlement.
- Hook into addon purchase/expiry events for the visibility-boost addon.
- Optionally expose an owner self-service toggle in the web owner editor (with guard: only if the entitlement is active).
- Ensure that downgrade or cancellation clears `isFeatured` reliably (expiry handling).

## Out of scope (initial)

- Anything beyond the single feature; pricing/limit calibration lives in SPEC-310.

## Open questions

- How many featured slots exist, and what happens when more owners qualify than slots allow — is there a rotation, a queue, or does everyone who qualifies get featured simultaneously?
- For the visibility-boost addon: is the featuring activation time-bounded (e.g., 30 days) and does the expiry cron already handle addon-expiry events, or does new cron logic need to be added?

## Related

- Parent audit: SPEC-310 (plan packaging recalibration).
- Billing lifecycle cron jobs in `apps/api/src/cron/jobs/` (addon-expiry, apply-scheduled-plan-changes) — likely the integration points.
- SPEC-318 (custom branding) and SPEC-319 (verification badge) — sibling owner-pro/premium features.
