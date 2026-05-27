/**
 * SUPER_ADMIN-Only Dashboard Data-Source Registrations — T-021 (SPEC-155)
 *
 * Registers the data-source resolvers exclusive to the SUPER_ADMIN dashboard
 * (cards H–I in `superAdminOnlySection`). All base cards A–G are covered by
 * `admin.ts` (T-020) and the T-017 built-ins.
 *
 * ## Registered source IDs
 *
 * | Source ID                  | Card | Scope | Endpoint(s) |
 * |----------------------------|------|-------|-------------|
 * | `super.billing.stats`      | I    | all   | GET /api/v1/admin/billing/metrics (or GET /api/v1/billing/admin/metrics) |
 *
 * ## No-source slots (all of Card H)
 *
 * Card H (`super.audit.log`) contains three sub-slots, ALL deferred:
 *
 * - **Admin actions audit log** 🟡: logging infra exists (`audit-logger.ts`,
 *   `AuditEventType`) but is logger-only; a queryable admin endpoint is needed
 *   (likely SPEC-162). Requires `AUDIT_LOG_VIEW` permission.
 * - **Security log** 🔴: same infrastructure gap; `SECURITY_LOG_VIEW`.
 *   Likely SPEC-163.
 * - **Sentry errors (24h)** 🔴: Sentry is write-only from our backend; requires
 *   a Sentry-API proxy integration.
 *
 * Card H therefore has NO registered source. DeferredWidget handles all three
 * sub-slots; T-033 sets `onMissing: 'hide'` on the whole card.
 *
 * @module dashboard-sources/super
 * @see apps/admin/src/lib/dashboard-sources.ts — registry API
 * @see apps/admin/src/lib/dashboard-sources/admin.ts — base sources (A–G)
 * @see .claude/audit/admin-redesign/proposals/03c-dashboards-redefinition.md — SUPER §
 * @see SPEC-155 T-021
 */

import { fetchApi } from '@/lib/api/client';
import {
    DASHBOARD_STALE_TIME_MS,
    buildDashboardQueryKey,
    registerDataSource
} from '@/lib/dashboard-sources';

// ============================================================================
// RESPONSE TYPE SHAPES
// ============================================================================

/**
 * Shape of the billing metrics API response.
 * Matches GET /api/v1/admin/billing/metrics (qzpay-hono route).
 * Requires `BILLING_METRICS_VIEW` permission (SUPER_ADMIN-only per 03c).
 */
interface BillingMetricsApiResponse {
    readonly success: boolean;
    readonly data?: {
        /** Total active paid subscriptions on the platform. */
        readonly activeSubscriptions?: number;
        /** Monthly Recurring Revenue in centavos (integer). */
        readonly mrr?: number;
        /** Annual Recurring Revenue in centavos (integer). */
        readonly arr?: number;
        /** Average Revenue Per User in centavos (integer). */
        readonly arpu?: number;
        /** Churn rate as a decimal (0–1). */
        readonly churnRate?: number;
        /** Revenue by month for the trailing 12 months. */
        readonly monthlyRevenue?: ReadonlyArray<{
            readonly month: string;
            readonly revenue: number;
        }>;
        /** Subscription counts broken down by plan tier. */
        readonly subscriptionBreakdown?: Record<string, number>;
    };
}

// ============================================================================
// CARD I — Estadísticas de billing (SUPER_ADMIN-only)
// ============================================================================

/**
 * SUPER_ADMIN card I: billing platform metrics.
 *
 * Fetches active subscriptions, MRR, 12-month revenue chart, ARPU, churn
 * rate, and subscription tier breakdown from the billing metrics endpoint.
 *
 * Permission required: `BILLING_METRICS_VIEW` (SUPER_ADMIN-only per 03c
 * decision — this permission is revoked from ADMIN in the same spec).
 *
 * The widget definition in `superAdminOnlySection` carries `onMissing: 'hide'`
 * so the card is invisible to non-SUPER_ADMIN users even if they somehow
 * receive the `superAdminDashboard` config object.
 *
 * Source ID: `'super.billing.stats'`
 * Scope: `'all'` (platform-wide billing data, not user-scoped)
 * Endpoint: GET /api/v1/admin/billing/metrics
 */
registerDataSource('super.billing.stats', (ctx) => ({
    queryKey: buildDashboardQueryKey('super.billing.stats', ctx),
    queryFn: async () => {
        const result = await fetchApi<BillingMetricsApiResponse>({
            path: '/api/v1/admin/billing/metrics'
        });
        const data = result.data.data;
        if (!data) return null;

        // Normalize to KpiData shape expected by KpiWidget.
        // Primary value: active subscriptions count.
        // MRR is surfaced as unitPrefix/unitSuffix for context.
        const mrrPesos = data.mrr !== undefined ? Math.round(data.mrr / 100) : undefined;
        return {
            value: data.activeSubscriptions ?? 0,
            unitSuffix: 'suscripciones',
            ...(mrrPesos !== undefined ? { mrr: mrrPesos } : {})
        };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// NOTE — Card H: all sub-slots are deferred (NO resolver registration)
// ============================================================================
// `super.audit.log` has three sub-slots, all without backend today:
//
//   - Admin actions audit log: logger-only infra, no queryable endpoint.
//     Planned SPEC-162 (AUDIT_LOG_VIEW required).
//   - Security log: same infra gap. Planned SPEC-163 (SECURITY_LOG_VIEW).
//   - Sentry errors (24h): Sentry write-only from our backend; needs a
//     Sentry-API proxy (external dependency, no DB).
//
// When these backends land, register their resolvers here:
//
//   registerDataSource('super.audit.log.actions', (ctx) => ({ ... }));
//   registerDataSource('super.audit.log.security', (ctx) => ({ ... }));
//   registerDataSource('super.audit.log.sentry', (ctx) => ({ ... }));
