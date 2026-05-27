---
specId: SPEC-163
title: Sentry Error Metrics Integration
status: draft
complexity: medium
owner: qazuor
created: 2026-05-26
parent: (none)
related:
  - SPEC-155 (admin-dashboards-v1 — consumer of the Sentry widget)
tags:
  - sentry
  - observability
  - super-admin
  - integration
  - backend
  - phase-2
  - backlog
---

# SPEC-163 — Sentry Error Metrics Integration

> **Status**: DRAFT — extracted from the 2026-05-26 dashboard redefinition session as "heavy backend". Lowest priority of the extracted specs (external integration, non-critical). See `.claude/audit/admin-redesign/proposals/03c-dashboards-redefinition.md` (SUPER-only card H).

## 1. Origin

The SUPER_ADMIN dashboard wants an "errores Sentry (últimas 24h)" widget. Today Sentry is **write-only** in our stack (error capture + profiling); there is no path to **query** error counts / distribution / release health from our own backend. The dashboard cannot show Sentry data without a new integration.

## 2. Goal

Expose Sentry error metrics (e.g., error count last 24h, top issues) to the admin dashboard via a backend proxy that calls the Sentry API.

## 3. Scope

### IN
- A server-side integration that queries the Sentry API (org/project scoped) for error counts / top issues over a window.
- An admin read endpoint feeding the widget (cache to respect Sentry API rate limits).

### OUT
- Two-way Sentry management (resolving issues from our panel).
- Per-release health, performance metrics (could be later).

## 4. Enables (SPEC-155 widget, SUPER-only)

- SUPER · Card H · "Errores Sentry (últimas 24h)".

## 5. Risks / notes

- Depends on Sentry API auth (token) + rate limits → must cache.
- Lowest priority: the widget is "nice to have" for SUPER_ADMIN ops; the dashboard ships fine without it. Candidate to stay in backlog.

## 6. Dependencies

- Existing Sentry setup (`apps/api/src/lib/sentry.ts`) for org/project identifiers.
- SPEC-155 is the CONSUMER.

## 7. Next steps

Needs tech-analysis (Sentry API surface + auth + caching) + task atomization. No DB change (external data).
