---
specId: SPEC-312
title: Tourist Price Alerts
type: feature
complexity: medium
status: draft
created: 2026-06-30T00:00:00Z
base: staging
---

# SPEC-312 — Tourist Price Alerts

> **Stub (backlog).** Created from the SPEC-310 plan-packaging audit, which found this feature is advertised in the billing plans but is a phantom gate (`gateAlerts` PHANTOM-GATE; no `/alerts` route, no alert storage, no price-monitoring cron, no UI). This stub captures the objective; it must go through full discovery (/task-master:spec-review or /spec) before implementation.

## Overview

A paying tourist (plus or vip) sets a price-drop alert on a specific accommodation. When the accommodation's price drops below the alert threshold, the tourist receives a notification (email and/or in-app). Tourist-plus is limited to `MAX_ACTIVE_ALERTS = 5` simultaneous active alerts; tourist-vip gets unlimited alerts (`PRICE_ALERTS` entitlement). This is a full greenfield feature — there is no alerts table, no monitoring cron, no alert-CRUD API, and no frontend today.

## Why now

Part of the SPEC-310 roadmap to stop selling unimplemented features. Price alerts are listed as a plan differentiator for paying tourists, but the entire stack (DB, API, cron, UI) is missing. `MAX_ACTIVE_ALERTS` limits exist in the entitlement config but the enforcement code is never reached.

## Scope (to refine in discovery)

- Create a `price_alerts` table (tourist, accommodation, threshold price, status: active/triggered/cancelled).
- Implement CRUD protected API routes for alert management; enforce `MAX_ACTIVE_ALERTS` on create.
- Add a monitoring cron job that compares current accommodation prices against alert thresholds and triggers notifications.
- Add web UI on the tourist's "mi cuenta" section and on the accommodation detail page to create/manage alerts.

## Out of scope (initial)

- Anything beyond the single feature; pricing/limit calibration lives in SPEC-310.

## Open questions

- Does Hospeda currently store or track per-accommodation price history over time? Price-drop detection requires a historical baseline — this is a hard prerequisite before the cron can work.
- Which notification channels should be used on alert trigger — email only, in-app notification, or both? (The `@repo/notifications` system exists but channel availability needs confirmation.)

## Related

- Parent audit: SPEC-310 (plan packaging recalibration).
- SPEC-289 (search history) — tourist engagement features in the same tier block.
- SPEC-313 (exclusive deals) — sibling tourist-plus/vip feature.
