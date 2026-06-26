---
specId: SPEC-289
title: Search History
type: feat
complexity: medium
status: draft
created: 2026-06-26
tags: [tourist, search-history, entitlements, web]
---

# SPEC-289 — Search History

> Builds a feature that today is only a **phantom gate**. Surfaced during the
> SPEC-282 review.

## 1. Summary

The entitlement `CAN_VIEW_SEARCH_HISTORY` is granted on paid tourist plans, but the
feature **does not exist**: `gateSearchHistory()` in
`apps/api/src/middlewares/tourist-entitlements.ts` is a
`// PHANTOM-GATE (SPEC-145): route not built yet`. No storage, no route, no UI.

This spec builds search history: store a tourist's past searches and let them view/
re-run them, with **per-plan functionality/limit differences** (e.g. how much
history is retained).

## 2. Context

- **Verified 2026-06-26:** phantom gate only. No DB table, no route, no web page.

## 3. Goals

- **G-1** Persist authenticated users' searches (query + filters + timestamp).
- **G-2** A web surface to view and re-run past searches.
- **G-3** Mount `CAN_VIEW_SEARCH_HISTORY`; define per-plan differences (retention
  depth / count; OQ-1).

## 4. Non-Goals

- No analytics/recommendation use of history in v1 (that feeds SPEC-284 later).
- No anonymous (pre-login) history persistence.

## 5. Open Questions

- **OQ-1** Per-plan differences: retention window or entry count by plan (and
  whether a new `LimitKey` is needed) — confirm at implementation.
- **OQ-2** Privacy: retention default, user-initiated clear, opt-out.
- **OQ-3** Relationship to SPEC-284 (recommendations may consume history as a
  signal) — define the read contract.

## 6. Relationship to SPEC-282

SPEC-282 shows "Historial de búsqueda" as *Próximamente* with intended per-tier
availability. Real per-plan numbers land when SPEC-289 ships.
