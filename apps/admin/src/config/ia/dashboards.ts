/**
 * Admin IA — Dashboard Stubs (T-016)
 *
 * Stub dashboard definitions for the 4 canonical role dashboards.
 * Each dashboard has one minimal placeholder KPI widget to satisfy the
 * DashboardSchema constraint (widgets ≥ 1).
 *
 * STUB — real widgets land in SPEC-155.
 * The widget set described in doc 01 §6 and doc 03-dashboards.md will replace
 * these placeholders when SPEC-155 is implemented.
 *
 * Design source of truth: `.claude/audit/admin-redesign/proposals/01-information-architecture.md` §6.
 *
 * @see apps/admin/src/config/ia/schema.ts  — Dashboard / Widget type contracts
 */

import type { Dashboard } from './schema';

// ---------------------------------------------------------------------------
// hostDashboard
// ---------------------------------------------------------------------------

/**
 * STUB dashboard for the HOST role — "Mi negocio".
 *
 * Intended to show KPIs scoped to the host's own accommodations:
 * active listings, month revenue, upcoming check-ins, subscription status.
 * SPEC-155 will replace this stub with 6 scoped widgets.
 *
 * @example
 * ```ts
 * import { dashboards } from '@/config/ia/dashboards';
 * dashboards.hostDashboard.widgets.length; // 1 (stub)
 * ```
 */
const hostDashboard: Dashboard = {
    // STUB — real widgets land in SPEC-155
    widgets: [
        {
            id: 'host-accommodations-count',
            type: 'kpi',
            label: {
                es: 'Mis alojamientos activos',
                en: 'My active accommodations',
                pt: 'Meus alojamentos ativos'
            },
            scope: 'own',
            permissions: ['ACCOMMODATION_VIEW_ALL'],
            config: { source: 'accommodation.list.count.own' }
        }
    ]
};

// ---------------------------------------------------------------------------
// superAdminDashboard
// ---------------------------------------------------------------------------

/**
 * STUB dashboard for the SUPER_ADMIN role — global KPIs + system health.
 *
 * Intended to show: global platform KPIs, MRR, system health (api/web/admin/db/redis),
 * Sentry errors (last 24h), failed crons, recent admin actions audit preview.
 * SPEC-155 will replace this stub with 10+ widgets.
 *
 * @example
 * ```ts
 * import { dashboards } from '@/config/ia/dashboards';
 * dashboards.superAdminDashboard.widgets.length; // 1 (stub)
 * ```
 */
const superAdminDashboard: Dashboard = {
    // STUB — real widgets land in SPEC-155
    widgets: [
        {
            id: 'platform-mrr',
            type: 'kpi',
            label: {
                es: 'MRR de la plataforma',
                en: 'Platform MRR',
                pt: 'MRR da plataforma'
            },
            scope: 'all',
            permissions: ['BILLING_READ_ALL'],
            config: { source: 'billing.mrr.current' }
        }
    ]
};

// ---------------------------------------------------------------------------
// adminDashboard
// ---------------------------------------------------------------------------

/**
 * STUB dashboard for the ADMIN role — same as SUPER_ADMIN minus system ops block.
 *
 * Intended to show global KPIs without the "System ops" widget block
 * (Sentry errors, failed crons, admin audit preview — those are SUPER_ADMIN only).
 * SPEC-155 will replace this stub with 8+ widgets.
 *
 * @example
 * ```ts
 * import { dashboards } from '@/config/ia/dashboards';
 * dashboards.adminDashboard.widgets.length; // 1 (stub)
 * ```
 */
const adminDashboard: Dashboard = {
    // STUB — real widgets land in SPEC-155
    widgets: [
        {
            id: 'active-accommodations-count',
            type: 'kpi',
            label: {
                es: 'Alojamientos activos',
                en: 'Active accommodations',
                pt: 'Alojamentos ativos'
            },
            scope: 'all',
            permissions: ['ACCOMMODATION_VIEW_ALL'],
            config: { source: 'accommodation.list.count.all' }
        }
    ]
};

// ---------------------------------------------------------------------------
// editorDashboard
// ---------------------------------------------------------------------------

/**
 * STUB dashboard for the EDITOR role — "La redacción".
 *
 * Intended to show: posts published this month, upcoming events, newsletter
 * open rate/CTR, editorial calendar (next 14 days), top performers, pending drafts.
 * SPEC-155 will replace this stub with 8 widgets.
 *
 * @example
 * ```ts
 * import { dashboards } from '@/config/ia/dashboards';
 * dashboards.editorDashboard.widgets.length; // 1 (stub)
 * ```
 */
const editorDashboard: Dashboard = {
    // STUB — real widgets land in SPEC-155
    widgets: [
        {
            id: 'posts-published-month',
            type: 'kpi',
            label: {
                es: 'Posts publicados este mes',
                en: 'Posts published this month',
                pt: 'Posts publicados este mês'
            },
            scope: 'all',
            permissions: ['POST_VIEW_ALL'],
            config: { source: 'post.list.count.published.month' }
        }
    ]
};

// ---------------------------------------------------------------------------
// Registry export
// ---------------------------------------------------------------------------

/**
 * Registry of all admin dashboard definitions, keyed by canonical ID.
 *
 * Role configs reference these IDs in their `dashboard` field.
 * The renderer looks up the active dashboard from this registry.
 *
 * @example
 * ```ts
 * import { dashboards } from '@/config/ia/dashboards';
 * const widgets = dashboards['hostDashboard'].widgets;
 * ```
 */
export const dashboards: Record<string, Dashboard> = {
    hostDashboard,
    superAdminDashboard,
    adminDashboard,
    editorDashboard
};
