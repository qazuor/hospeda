# Accepted Security Risks

This document lists known security risks that have been reviewed and accepted. Each risk has a unique identifier, rationale, and mitigations in place.

## SEC-001: Entitlements Fail-Closed by Design

**Source:** SPEC-037 GAP-08

**Description:** When the billing system is unavailable, entitlement checks fail closed (deny access). This means users may temporarily lose access to paid features during billing service outages.

**Risk Level:** Low

**Rationale:** Fail-closed is the safer default for a billing system. Fail-open would allow unpaid access. The blast radius is limited since billing outages are brief and only affect premium features.

**Mitigations:**

- Grace period middleware allows recovery paths through even when blocked
- Billing middleware logs warnings when service is unavailable
- Health check endpoints monitor billing service availability

---

## SEC-002: Permissions Exposed in /auth/me Response

**Source:** SPEC-037 GAP-44

**Description:** The `/api/v1/public/auth/me` endpoint returns the user's permissions array. This data is needed for client-side UI gating (showing/hiding admin buttons, menu items, etc.).

**Risk Level:** Low

**Rationale:** Permissions are the user's own data and are needed by both the web app and admin panel for UI rendering. Server-side enforcement is the actual security boundary. Knowing your own permissions does not enable privilege escalation.

**Mitigations:**

- All permission checks are enforced server-side in API routes and services
- Permissions are read-only in the response (cannot be modified via API)
- Session cookies are httpOnly and cannot be tampered with

---

## SEC-003: Vercel Free Plan Cron Limitation

**Source:** SPEC-037 GAP-65

**Description:** Vercel's free (Hobby) plan supports only daily cron schedules, not hourly. The `webhook-retry` job is configured for hourly execution (`0 */1 * * *`) but on Vercel free plan will only run once daily.

**Risk Level:** Low

**Rationale:** Failed webhooks are persisted in the dead letter queue and retried whenever the cron runs. Delayed retry (daily vs hourly) affects time-to-resolution but not data integrity. The dead letter queue preserves all failed events.

**Mitigations:**

- Dead letter queue ensures no webhook events are lost
- Admin panel provides manual webhook retry via `/admin/cron/webhook-retry`
- Upgrading to Vercel Pro enables hourly schedules
- Self-hosted deployments use `node-cron` adapter with real hourly scheduling

---

## Review Schedule

This document should be reviewed:

- When new security gaps are identified and accepted
- During quarterly security reviews
- Before major releases or deployment changes

**Last Updated:** 2026-03-07
