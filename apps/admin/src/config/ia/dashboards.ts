/**
 * Admin IA — Dashboard Configs (T-004/SPEC-155)
 *
 * Defines the per-role dashboard objects consumed by the config-driven IA
 * system (SPEC-154). All widgets in this file are PLACEHOLDER stubs — the
 * final widget definitions (card counts, sources, real labels) land in
 * Phase 5 tasks T-029..T-033.
 *
 * ## Structure
 *
 * The ADMIN / SUPER_ADMIN shared model uses a "base + extension" pattern:
 *
 * - `adminBaseDashboard`     — 7 placeholder widgets (cards A–G), shared between
 *                              ADMIN and SUPER_ADMIN. ADMIN role points directly
 *                              to this dashboard and sees only cards A–G.
 * - `superAdminOnlySection`  — 2 placeholder widgets (cards H–I) with
 *                              `onMissing: 'hide'`. Never included in
 *                              `adminBaseDashboard`. Exported as a named object
 *                              so Phase 5 and the renderer can reference it.
 * - `superAdminDashboard`    — Assembled from `adminBaseDashboard.widgets` +
 *                              `superAdminOnlySection.widgets` (9 total).
 *                              SUPER_ADMIN role points to this dashboard.
 *
 * This layout satisfies SPEC-155 AC-4 (4 named source objects) and AC-8
 * (ADMIN→base, SUPER_ADMIN→base+extension) within the existing flat
 * `DashboardSchema` (which does not support composition natively).
 *
 * ## Gating mechanism
 *
 * Cards H and I carry `onMissing: 'hide'`. When the renderer evaluates
 * `superAdminDashboard` for a non-SUPER_ADMIN user it hides those widgets
 * entirely. In practice the ADMIN role is wired to `adminBaseDashboard` so
 * it never receives H/I at all — the `onMissing` is a belt-and-suspenders
 * guard for any renderer path that resolves by widget-level permission gates.
 *
 * ## Phase 5 notes (T-029..T-033)
 *
 * - Replace each STUB widget with the real set described in 03c §3.
 * - `config.source` values become real source IDs registered in
 *   `dashboard-sources.ts`.
 * - Widget `type` values should match the final renderer catalogue (kpi,
 *   list, chart, feed, callout, shortcut, checklist, …).
 * - `scope` must be set correctly for each card (HOST cards use `'own'`;
 *   ADMIN/SUPER_ADMIN cards use `'all'`; EDITOR uses `'all'`).
 *
 * @see apps/admin/src/config/ia/schema.ts  — Dashboard / Widget type contracts
 * @see .claude/audit/admin-redesign/proposals/03c-dashboards-redefinition.md
 */

import type { Dashboard } from './schema';

// ============================================================================
// hostDashboard — "Mi negocio"
// ============================================================================

/**
 * Dashboard for the HOST role — 7-card "Mi negocio" view.
 *
 * Final card set (SPEC-155 §3):
 *   A — Mis alojamientos   D — Estado de mi alojamiento
 *   B — Mi plan            E — Reseñas
 *   C — Consultas          F — Mi perfil
 *                          G — Estadísticas
 *
 * All widgets are STUBS — real definitions land in Phase 5 (T-029).
 *
 * @example
 * ```ts
 * import { dashboards } from '@/config/ia/dashboards';
 * dashboards.hostDashboard.widgets.length; // 7 (placeholder stubs)
 * ```
 */
const hostDashboard: Dashboard = {
    // STUB — real widgets land in Phase 5 / T-029
    widgets: [
        {
            id: 'host-card-a',
            type: 'kpi',
            label: {
                es: '[STUB] Mis alojamientos',
                en: '[STUB] My accommodations',
                pt: '[STUB] Meus alojamentos'
            },
            scope: 'own',
            config: { source: 'host.accommodations.count' }
        },
        {
            id: 'host-card-b',
            type: 'callout',
            label: {
                es: '[STUB] Mi plan',
                en: '[STUB] My plan',
                pt: '[STUB] Meu plano'
            },
            scope: 'own',
            config: { source: 'host.billing.plan' }
        },
        {
            id: 'host-card-c',
            type: 'list',
            label: {
                es: '[STUB] Consultas',
                en: '[STUB] Inquiries',
                pt: '[STUB] Consultas'
            },
            scope: 'own',
            config: { source: 'host.conversations.pending' }
        },
        {
            id: 'host-card-d',
            type: 'checklist',
            label: {
                es: '[STUB] Estado de mi alojamiento',
                en: '[STUB] Accommodation health',
                pt: '[STUB] Estado do meu alojamento'
            },
            scope: 'own',
            config: { source: 'host.accommodations.health' }
        },
        {
            id: 'host-card-e',
            type: 'list',
            label: {
                es: '[STUB] Reseñas',
                en: '[STUB] Reviews',
                pt: '[STUB] Avaliações'
            },
            scope: 'own',
            config: { source: 'host.reviews.latest' }
        },
        {
            id: 'host-card-f',
            type: 'checklist',
            label: {
                es: '[STUB] Mi perfil',
                en: '[STUB] My profile',
                pt: '[STUB] Meu perfil'
            },
            scope: 'own',
            config: { source: 'host.profile.health' }
        },
        {
            id: 'host-card-g',
            type: 'kpi',
            label: {
                es: '[STUB] Estadísticas',
                en: '[STUB] Statistics',
                pt: '[STUB] Estatísticas'
            },
            scope: 'own',
            config: { source: 'host.stats' }
        }
    ]
};

// ============================================================================
// editorDashboard — "La redacción"
// ============================================================================

/**
 * Dashboard for the EDITOR role — 8-card "La redacción" view.
 *
 * Final card set (SPEC-155 §3):
 *   A — Posts                      E — Estadísticas blog
 *   B — Eventos                    F — Estadísticas eventos
 *   C — Suscriptores Newsletter    G — Salud
 *   D — Campañas Newsletter        H — Comentarios
 *
 * All widgets are STUBS — real definitions land in Phase 5 (T-030).
 *
 * @example
 * ```ts
 * import { dashboards } from '@/config/ia/dashboards';
 * dashboards.editorDashboard.widgets.length; // 8 (placeholder stubs)
 * ```
 */
const editorDashboard: Dashboard = {
    // STUB — real widgets land in Phase 5 / T-030
    widgets: [
        {
            id: 'editor-card-a',
            type: 'kpi',
            label: {
                es: '[STUB] Posts',
                en: '[STUB] Posts',
                pt: '[STUB] Posts'
            },
            scope: 'all',
            config: { source: 'editor.posts.summary' }
        },
        {
            id: 'editor-card-b',
            type: 'list',
            label: {
                es: '[STUB] Eventos',
                en: '[STUB] Events',
                pt: '[STUB] Eventos'
            },
            scope: 'all',
            config: { source: 'editor.events.upcoming' }
        },
        {
            id: 'editor-card-c',
            type: 'kpi',
            label: {
                es: '[STUB] Suscriptores Newsletter',
                en: '[STUB] Newsletter subscribers',
                pt: '[STUB] Assinantes Newsletter'
            },
            scope: 'all',
            config: { source: 'editor.newsletter.subscribers' }
        },
        {
            id: 'editor-card-d',
            type: 'list',
            label: {
                es: '[STUB] Campañas Newsletter',
                en: '[STUB] Newsletter campaigns',
                pt: '[STUB] Campanhas Newsletter'
            },
            scope: 'all',
            config: { source: 'editor.newsletter.campaigns' }
        },
        {
            id: 'editor-card-e',
            type: 'chart',
            label: {
                es: '[STUB] Estadísticas blog',
                en: '[STUB] Blog statistics',
                pt: '[STUB] Estatísticas blog'
            },
            scope: 'all',
            config: { source: 'editor.posts.stats' }
        },
        {
            id: 'editor-card-f',
            type: 'kpi',
            label: {
                es: '[STUB] Estadísticas eventos',
                en: '[STUB] Event statistics',
                pt: '[STUB] Estatísticas eventos'
            },
            scope: 'all',
            config: { source: 'editor.events.stats' }
        },
        {
            id: 'editor-card-g',
            type: 'checklist',
            label: {
                es: '[STUB] Salud',
                en: '[STUB] Health',
                pt: '[STUB] Saúde'
            },
            scope: 'all',
            config: { source: 'editor.content.health' }
        },
        {
            id: 'editor-card-h',
            type: 'feed',
            label: {
                es: '[STUB] Comentarios',
                en: '[STUB] Comments',
                pt: '[STUB] Comentários'
            },
            scope: 'all',
            config: { source: 'editor.comments.recent' }
        }
    ]
};

// ============================================================================
// adminBaseDashboard — cards A–G (shared between ADMIN and SUPER_ADMIN)
// ============================================================================

/**
 * Base dashboard shared by both the ADMIN and SUPER_ADMIN roles — 7 cards A–G.
 *
 * Final card set (SPEC-155 §3):
 *   A — Estadísticas de entidades    E — Estado del sistema
 *   B — Alojamientos                 F — Pendiente de moderación
 *   C — Editorial                    G — Usuarios
 *   D — Crons
 *
 * ADMIN role points directly to `adminBaseDashboard`.
 * SUPER_ADMIN role points to `superAdminDashboard`, which assembles this base
 * plus `superAdminOnlySection` (cards H–I).
 *
 * All widgets are STUBS — real definitions land in Phase 5 (T-031/T-032).
 *
 * @example
 * ```ts
 * import { dashboards } from '@/config/ia/dashboards';
 * dashboards.adminBaseDashboard.widgets.length; // 7 (placeholder stubs)
 * ```
 */
const adminBaseDashboard: Dashboard = {
    // STUB — real widgets land in Phase 5 / T-031 (ADMIN) and T-032 (SUPER_ADMIN base)
    widgets: [
        {
            id: 'admin-card-a',
            type: 'kpi',
            label: {
                es: '[STUB] Estadísticas de entidades',
                en: '[STUB] Entity statistics',
                pt: '[STUB] Estatísticas de entidades'
            },
            scope: 'all',
            config: { source: 'admin.entities.counts' }
        },
        {
            id: 'admin-card-b',
            type: 'list',
            label: {
                es: '[STUB] Alojamientos',
                en: '[STUB] Accommodations',
                pt: '[STUB] Alojamentos'
            },
            scope: 'all',
            config: { source: 'admin.accommodations.latest' }
        },
        {
            id: 'admin-card-c',
            type: 'list',
            label: {
                es: '[STUB] Editorial',
                en: '[STUB] Editorial',
                pt: '[STUB] Editorial'
            },
            scope: 'all',
            config: { source: 'admin.editorial.summary' }
        },
        {
            id: 'admin-card-d',
            type: 'list',
            label: {
                es: '[STUB] Crons',
                en: '[STUB] Crons',
                pt: '[STUB] Crons'
            },
            scope: 'all',
            config: { source: 'admin.crons.list' }
        },
        {
            id: 'admin-card-e',
            type: 'callout',
            label: {
                es: '[STUB] Estado del sistema',
                en: '[STUB] System health',
                pt: '[STUB] Estado do sistema'
            },
            scope: 'all',
            config: { source: 'admin.system.health' }
        },
        {
            id: 'admin-card-f',
            type: 'kpi',
            label: {
                es: '[STUB] Pendiente de moderación',
                en: '[STUB] Pending moderation',
                pt: '[STUB] Pendente de moderação'
            },
            scope: 'all',
            config: { source: 'admin.moderation.pending' }
        },
        {
            id: 'admin-card-g',
            type: 'chart',
            label: {
                es: '[STUB] Usuarios',
                en: '[STUB] Users',
                pt: '[STUB] Usuários'
            },
            scope: 'all',
            config: { source: 'admin.users.stats' }
        }
    ]
};

// ============================================================================
// superAdminOnlySection — cards H–I (SUPER_ADMIN-exclusive)
// ============================================================================

/**
 * SUPER_ADMIN-exclusive section — 2 cards H–I, gated by `onMissing: 'hide'`.
 *
 * These widgets are absent from `adminBaseDashboard` and present only in
 * `superAdminDashboard`. The `onMissing: 'hide'` on each widget acts as a
 * belt-and-suspenders guard: any renderer path that evaluates widgets against
 * permission gates will also hide them from non-SUPER_ADMIN users.
 *
 * Final card set (SPEC-155 §3):
 *   H — Audit Logs (all slots deferred → SPEC-162/163 placeholders)
 *   I — Estadísticas de billing
 *
 * All widgets are STUBS — real definitions land in Phase 5 (T-033).
 *
 * SPEC-155 AC-7: every widget here MUST carry `onMissing: 'hide'`.
 * SPEC-155 AC-31: ADMIN never receives these cards — they are absent from
 * `adminBaseDashboard` by config (not by permission check).
 *
 * @example
 * ```ts
 * import { superAdminOnlySection } from '@/config/ia/dashboards';
 * superAdminOnlySection.widgets.every(w => w.onMissing === 'hide'); // true
 * ```
 */
export const superAdminOnlySection: Dashboard = {
    // STUB — real widgets land in Phase 5 / T-033
    widgets: [
        {
            id: 'super-card-h',
            type: 'feed',
            label: {
                es: '[STUB] Audit Logs',
                en: '[STUB] Audit Logs',
                pt: '[STUB] Audit Logs'
            },
            scope: 'all',
            // onMissing: 'hide' — SUPER_ADMIN-only; hide for any non-SUPER user
            // who might evaluate this dashboard via widget-level permission gates.
            onMissing: 'hide',
            config: { source: 'super.audit.log' }
        },
        {
            id: 'super-card-i',
            type: 'kpi',
            label: {
                es: '[STUB] Estadísticas de billing',
                en: '[STUB] Billing statistics',
                pt: '[STUB] Estatísticas de billing'
            },
            scope: 'all',
            // onMissing: 'hide' — SUPER_ADMIN-only; absent from adminBaseDashboard.
            onMissing: 'hide',
            config: { source: 'super.billing.stats' }
        }
    ]
};

// ============================================================================
// superAdminDashboard — assembled base (A–G) + super-only section (H–I)
// ============================================================================

/**
 * Assembled dashboard for the SUPER_ADMIN role — 9 cards (A–I).
 *
 * Built by spreading the widgets from `adminBaseDashboard` (cards A–G, shared)
 * and `superAdminOnlySection` (cards H–I, `onMissing: 'hide'`).
 *
 * SUPER_ADMIN role config points to this key. ADMIN role config points to
 * `adminBaseDashboard` — it never sees cards H or I because they are absent
 * from that dashboard (SPEC-155 AC-31).
 *
 * Phase 5 (T-032/T-033) replaces the base widgets AND the super-only stubs.
 * The spread construction here means editing the source constants automatically
 * updates this assembled dashboard — no manual duplication required.
 *
 * @example
 * ```ts
 * import { dashboards } from '@/config/ia/dashboards';
 * dashboards.superAdminDashboard.widgets.length; // 9 (7 base + 2 super-only)
 * ```
 */
const superAdminDashboard: Dashboard = {
    widgets: [...adminBaseDashboard.widgets, ...superAdminOnlySection.widgets]
};

// ============================================================================
// Registry export
// ============================================================================

/**
 * Registry of all admin dashboard definitions, keyed by canonical ID.
 *
 * Role configs reference these IDs in their `dashboard` field.
 * The renderer looks up the active dashboard from this registry.
 *
 * Named source objects (SPEC-155 AC-4):
 * - `hostDashboard`          — HOST role (7 stubs)
 * - `editorDashboard`        — EDITOR role (8 stubs)
 * - `adminBaseDashboard`     — ADMIN role + SUPER_ADMIN base section (7 stubs)
 * - `superAdminOnlySection`  — SUPER_ADMIN-exclusive cards H–I (2 stubs, `onMissing:'hide'`)
 *
 * Role-facing entries:
 * - `superAdminDashboard`    — SUPER_ADMIN role (assembled: 9 stubs = base + super-only)
 *
 * @example
 * ```ts
 * import { dashboards } from '@/config/ia/dashboards';
 * const widgets = dashboards['adminBaseDashboard'].widgets;  // 7 stubs
 * const allWidgets = dashboards['superAdminDashboard'].widgets; // 9 stubs
 * ```
 */
export const dashboards: Record<string, Dashboard> = {
    hostDashboard,
    editorDashboard,
    adminBaseDashboard,
    superAdminOnlySection,
    superAdminDashboard
};
