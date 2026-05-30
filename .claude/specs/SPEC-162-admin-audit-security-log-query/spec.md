---
specId: SPEC-162
title: Admin Audit & Security Log Query Layer
status: draft
complexity: high
owner: qazuor
created: 2026-05-26
parent: (none)
related:
  - SPEC-155 (admin-dashboards-v1 — consumer of audit/security widgets)
tags:
  - audit
  - security
  - observability
  - super-admin
  - backend
  - phase-2
---

# SPEC-162 — Admin Audit & Security Log Query Layer

> **Status**: DRAFT — extracted from the 2026-05-26 dashboard redefinition session as "heavy backend". See `.claude/audit/admin-redesign/proposals/03c-dashboards-redefinition.md` (SUPER-only card H).

> **Related beta feedback** (not a 1:1 match): [BETA-82](https://linear.app/hospeda-beta/issue/BETA-82) — "Mejorar logging de API para terminal, archivo y visualización en admin". SPEC-162 covers the **audit/security subset** (making those events queryable + admin endpoints); BETA-82 is broader general-purpose API logging. Partial overlap on the "view logs in admin" piece.

## 1. Origin

The SUPER_ADMIN dashboard wants an "audit log / recent admin actions" widget and a "security log" widget. The logging infrastructure exists (`apps/api/src/utils/audit-logger.ts`, `AuditEventType` enum) but it is **logger-only** — events are emitted as breadcrumbs/logs, not stored in a queryable form. There is no admin endpoint to read them back.

## 2. Goal

Make admin audit events and security events **queryable**: persist them in a readable store and expose admin endpoints gated by `AUDIT_LOG_VIEW` / `SECURITY_LOG_VIEW` (both SUPER_ADMIN-only permissions).

## 3. Scope

### IN
- Queryable persistence of audit events (who/what/when/target).
- Queryable persistence of security events (auth failures, lockouts, etc.).
- Admin read endpoints (paginated, filterable) gated by the respective VIEW permissions.

### OUT
- Tamper-proof/append-only guarantees beyond soft-delete (can be a later hardening).
- Exporting / SIEM integration.

## 4. Enables (SPEC-155 widgets, SUPER-only)

- SUPER · Card H · "Audit log / acciones recientes de admins" (`AUDIT_LOG_VIEW`).
- SUPER · Card H · "Security log" (`SECURITY_LOG_VIEW`).

## 5. Dependencies

- Existing logging infra (`audit-logger.ts`, `AuditEventType`).
- SPEC-155 is the CONSUMER.

## 6. Next steps

Needs tech-analysis (storage model: dedicated table vs. structured log sink we can query) + task atomization. Likely a DB change.
