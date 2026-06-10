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
 * Matches GET /api/v1/admin/billing/metrics.
 * Requires `BILLING_METRICS_VIEW` permission (SUPER_ADMIN-only per 03c).
 *
 * The headline figures are nested under `data.overview` (NOT flat on `data`);
 * reading them flat returned `undefined` → the card rendered 0 regardless of
 * real data (SPEC-155 follow-up).
 */
interface BillingMetricsApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly overview?: {
            /** Active paid subscriptions on the platform. */
            readonly activeSubscriptions?: number;
            /** Subscriptions currently in a trial period. */
            readonly trialingSubscriptions?: number;
            /** Monthly Recurring Revenue in centavos (integer). */
            readonly mrr?: number;
            /** Average Revenue Per User in centavos (integer). */
            readonly arpu?: number;
            /** Churn rate as a decimal (0–1). */
            readonly churnRate?: number;
            /** Total customers (paying or not). */
            readonly totalCustomers?: number;
            /** Total revenue to date in centavos (integer). */
            readonly totalRevenue?: number;
        };
        /** Revenue by month for the trailing 12 months. */
        readonly revenueTimeSeries?: ReadonlyArray<{
            readonly month: string;
            readonly revenue: number;
        }>;
        /** Subscription counts broken down by plan tier. */
        readonly subscriptionBreakdown?: ReadonlyArray<unknown>;
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
        const overview = result.data.data?.overview;
        if (!overview) return null;

        // Multi-KPI grid: surface the headline billing figures as individual
        // tiles so the card actually reads as data, not as a single 0. MRR is
        // stored in centavos; convert to pesos for display.
        const mrrPesos =
            overview.mrr !== undefined && overview.mrr > 0 ? Math.round(overview.mrr / 100) : 0;
        const churnPct =
            overview.churnRate !== undefined ? Math.round(overview.churnRate * 1000) / 10 : 0;

        // Short, plain-Spanish labels so each tile fits without truncation. MRR
        // and Churn are jargon, so they get the meaning, not the acronym.
        const kpis = [
            {
                key: 'activeSubs',
                label: { es: 'Activas', en: 'Active', pt: 'Ativas' },
                value: overview.activeSubscriptions ?? 0,
                accent: 'success',
                icon: 'billing'
            },
            {
                key: 'trialingSubs',
                label: { es: 'En prueba', en: 'Trialing', pt: 'Em teste' },
                value: overview.trialingSubscriptions ?? 0,
                accent: 'warning',
                icon: 'clock'
            },
            {
                key: 'mrr',
                label: { es: 'Ingreso mensual', en: 'Monthly revenue', pt: 'Receita mensal' },
                value: mrrPesos,
                unitPrefix: '$',
                accent: 'forest',
                icon: 'chart'
            },
            {
                key: 'customers',
                label: { es: 'Clientes', en: 'Customers', pt: 'Clientes' },
                value: overview.totalCustomers ?? 0,
                accent: 'purple',
                icon: 'users'
            },
            {
                key: 'churn',
                label: { es: 'Tasa de baja', en: 'Churn rate', pt: 'Taxa de saída' },
                value: churnPct,
                unitSuffix: '%',
                accent: 'rose',
                icon: 'activity'
            }
        ];

        // `value` (active subs) retained for back-compat; not shown in grid mode.
        return { value: overview.activeSubscriptions ?? 0, kpis };
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

// ============================================================================
// NOTE — WHATS NEW RECENT (SPEC-175 T-016)
// ============================================================================
// `whats-new.recent` is registered in `./whats-new.ts` (imported via index.ts).
// Shared across all four roles — see apps/admin/src/lib/dashboard-sources/index.ts.
