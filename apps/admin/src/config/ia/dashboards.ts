/**
 * Admin IA — Dashboard Configs (SPEC-155)
 *
 * Defines the per-role dashboard objects consumed by the config-driven IA
 * system (SPEC-154). Phase 5 (T-029..T-033) replaces the placeholder stubs
 * with the real widget definitions per the card set in
 * `.claude/audit/admin-redesign/proposals/03c-dashboards-redefinition.md`.
 *
 * ## Structure
 *
 * The ADMIN / SUPER_ADMIN shared model uses a "base + extension" pattern:
 *
 * - `adminBaseDashboard`     — 7 widgets (cards A–G), shared between ADMIN
 *                              and SUPER_ADMIN. ADMIN role points directly to
 *                              this dashboard and sees only cards A–G.
 * - `superAdminOnlySection`  — 2 widgets (cards H–I) with `onMissing: 'hide'`.
 *                              Never included in `adminBaseDashboard`. Exported
 *                              as a named object so the renderer can reference it.
 * - `superAdminDashboard`    — Assembled from `adminBaseDashboard.widgets` +
 *                              `superAdminOnlySection.widgets` (9 total).
 *                              SUPER_ADMIN role points to this dashboard.
 *
 * ## DeferredWidget contract
 *
 * Slots whose backend is deferred to a future spec use a phase-2 type (e.g.
 * `type: 'callout'`) with a special `config.deferred` object so the renderer
 * can delegate to `DeferredWidget`. Each deferred slot carries:
 *   - `config.deferred: true`
 *   - `config.phaseSpec`: the spec that will deliver the data (e.g. "SPEC-159")
 *   - `config.description` (optional): human-readable description of the slot
 *
 * @see apps/admin/src/config/ia/schema.ts  — Dashboard / Widget type contracts
 * @see .claude/audit/admin-redesign/proposals/03c-dashboards-redefinition.md
 * @see apps/admin/src/lib/dashboard-sources/host.ts    — HOST source IDs
 * @see apps/admin/src/lib/dashboard-sources/editor.ts  — EDITOR source IDs
 * @see apps/admin/src/lib/dashboard-sources/admin.ts   — ADMIN source IDs
 * @see apps/admin/src/lib/dashboard-sources/super.ts   — SUPER source IDs
 */

import type { DashboardInput } from './schema';

// ============================================================================
// hostDashboard — "Mi negocio" — 10 cards A–J
// ============================================================================

/**
 * Dashboard for the HOST role — 10-card "Mi negocio" view.
 *
 * Card set (SPEC-155 §3 / 03c HOST section):
 *   A — Mis alojamientos        (kpi + list, sources: host.accommodations.count + host.accommodations.drafts)
 *   B — Mi plan                 (callout,    source: host.billing.plan)
 *   C — Consultas               (kpi + list, source: host.conversations.pending)
 *   D — Estado de mi alojamiento (checklist, checkset: accommodation-health, w/ selector)
 *   E — Reseñas                 (list,       source: host.reviews.latest)
 *   F — Mi perfil               (checklist,  checkset: host-profile-health)
 *   G — Estadísticas            (kpi + list + deferred, sources: host.stats.ratings / host.stats.favorites / host.stats.response-rate + DeferredWidget for views)
 *
 * @example
 * ```ts
 * import { dashboards } from '@/config/ia/dashboards';
 * dashboards.hostDashboard.widgets.length; // 10
 * ```
 */
const hostDashboard: DashboardInput = {
    widgets: [
        // Card A — Mis alojamientos
        // own listings count KPI + DRAFT list with publish link
        // sources: host.accommodations.count (count), host.accommodations.drafts (draft list)
        {
            id: 'host-card-a',
            type: 'kpi',
            label: {
                es: 'Mis alojamientos',
                en: 'My accommodations',
                pt: 'Meus alojamentos'
            },
            scope: 'own',
            // Bento: full hero — multi-KPI tiles + draft sub-list below benefit from full width.
            gridSpan: { cols: 3 },
            config: {
                source: 'host.accommodations.count',
                // Companion draft list source — rendered below the KPI by the card renderer
                companionSource: 'host.accommodations.drafts',
                accent: 'river',
                icon: 'buildings',
                emptyText: 'Todavía no tenés alojamientos',
                emptyDescription: 'Cuando publiques tu primer alojamiento, vas a verlo acá.',
                errorText: 'No pudimos cargar tus alojamientos',
                errorDescription: 'Probá actualizar — si persiste, avisanos.'
            }
        },

        // Card B — Mi plan
        // subscription status badge + next charge date + plan name
        // source: host.billing.plan (fetches subscription + plan in parallel)
        // type: 'status' — renders via StatusWidget with the subscription state badge
        // (active / expiring / expired → success / warning / destructive).
        // Plan usage (accommodations used / limit) is a phase-2 enhancement (SPEC-155).
        {
            id: 'host-card-b',
            type: 'status',
            label: {
                es: 'Mi plan',
                en: 'My plan',
                pt: 'Meu plano'
            },
            scope: 'own',
            // Bento: wide (2×1) — plan name hero + 3 limit tiles + chips + CTA
            // is dense content; a 1×1 felt cramped.
            gridSpan: { cols: 2 },
            config: {
                source: 'host.billing.plan',
                accent: 'success',
                icon: 'billing',
                variantMap: {
                    active: 'success',
                    expiring: 'warning',
                    expired: 'destructive',
                    cancelled: 'neutral',
                    trial: 'warning',
                    past_due: 'destructive',
                    pending: 'warning',
                    paused: 'warning'
                },
                emptyText: 'Todavía no tenés un plan activo',
                emptyDescription: 'Activá un plan para publicar y administrar tus alojamientos.',
                errorText: 'No pudimos cargar tu plan',
                errorDescription: 'El servicio de facturación no está disponible ahora mismo.'
            }
        },

        // Card C — Consultas
        // pending inquiry count (large KPI) + top-5 list with "Responder" per-item action
        // source: host.conversations.pending (fetches count + list in parallel)
        {
            id: 'host-card-c',
            type: 'list',
            label: {
                es: 'Consultas',
                en: 'Inquiries',
                pt: 'Consultas'
            },
            scope: 'own',
            // Bento: compact (1×1) — header counter pill + 3 pending rows fit
            // in a single column; the full counter stays visible regardless.
            config: {
                source: 'host.conversations.pending',
                accent: 'sky',
                icon: 'chat',
                maxItems: 3,
                actionPerItem: {
                    label: { es: 'Responder', en: 'Reply', pt: 'Responder' },
                    hrefTemplate: '/consultas/{id}'
                },
                emptyText: 'Sin consultas pendientes',
                emptyDescription: 'Cuando un huésped te escriba, aparecerá acá para responder.',
                errorText: 'No pudimos cargar tus consultas',
                errorDescription: 'Probá actualizar el panel.'
            }
        },

        // Card D — Estado de mi alojamiento
        // "Mejorá tu alojamiento" completeness checklist — computed client-side from
        // the loaded accommodation object (no remote source). The ChecklistWidget
        // renders an accommodation selector dropdown when the host has >1 listing.
        // checkset: 'accommodation-health' → checks photos / description / amenities / price / location / contact
        {
            id: 'host-card-d',
            type: 'checklist',
            label: {
                es: 'Estado de mi alojamiento',
                en: 'Accommodation health',
                pt: 'Estado do meu alojamento'
            },
            scope: 'own',
            // Bento: compact (1×1) — checklist with completion bar + CTA.
            config: {
                checkset: 'accommodation-health',
                // Resolves to full accommodation entities for the host (id +
                // photos / description / amenities / price / lat-lng / contact).
                source: 'host.accommodations.entities',
                accent: 'warning',
                icon: 'shield',
                // CTA shown when completeness < 100%
                cta: {
                    label: {
                        es: 'Editar alojamiento',
                        en: 'Edit listing',
                        pt: 'Editar alojamento'
                    },
                    hrefTemplate: '/accommodations/{id}/edit'
                },
                emptyText: 'Aún no tenés alojamientos',
                emptyDescription: 'Creá uno y volvé acá para ver qué le falta a su ficha.',
                errorText: 'No pudimos cargar el estado de tu alojamiento'
                // The ChecklistWidget falls back to config.entities injected by the card renderer.
            }
        },

        // Card E — Reseñas
        // latest reviews received (read-only list)
        // source: host.reviews.latest (REVIEW_VIEW_OWN permission)
        {
            id: 'host-card-e',
            type: 'list',
            label: {
                es: 'Reseñas',
                en: 'Reviews',
                pt: 'Avaliações'
            },
            scope: 'own',
            // Bento: wide (2×1) — reviews list reads better with horizontal room.
            gridSpan: { cols: 2 },
            config: {
                source: 'host.reviews.latest',
                accent: 'terracotta',
                icon: 'star',
                maxItems: 5,
                // Render rating as visual stars (★★★★☆) instead of a plain number badge.
                variant: 'stars',
                emptyText: 'Todavía no recibiste reseñas',
                emptyDescription: 'Cuando un huésped deje una opinión, vas a verla acá.',
                errorText: 'No pudimos cargar tus reseñas',
                errorDescription: 'Volvé a intentar en un momento.'
            }
        },

        // Card F — Mi perfil
        // "Salud del perfil de host" completeness checklist — computed client-side
        // from the authenticated user/host object (no remote source).
        // checkset: 'host-profile-health' → checks avatar / bio / phone / social / verified email / full name
        {
            id: 'host-card-f',
            type: 'checklist',
            label: {
                es: 'Mi perfil',
                en: 'My profile',
                pt: 'Meu perfil'
            },
            scope: 'own',
            // Bento: tall (1×2) — fills the col-1 slot alongside the wide
            // 2×1 cards on rows 4-5 so the grid never leaves col-3 holes.
            gridSpan: { rows: 2 },
            config: {
                checkset: 'host-profile-health',
                // Resolves to the current host's user record (name / avatar /
                // bio / phone / socialLink / emailVerified).
                source: 'host.profile.current',
                accent: 'accent',
                icon: 'user',
                // CTA shown when completeness < 100%
                cta: {
                    label: {
                        es: 'Completar perfil',
                        en: 'Complete profile',
                        pt: 'Completar perfil'
                    },
                    href: '/access/profile'
                },
                emptyText: 'Perfil no disponible',
                emptyDescription: 'No pudimos leer los datos de tu perfil para evaluarlo.',
                errorText: 'No pudimos leer tu perfil'
            }
        },

        // Card G — Estadísticas
        // Four sub-slots:
        //   1. Ratings: avg rating + total reviews (host.stats.ratings)
        //   2. Favorites: per-accommodation breakdown (host.stats.favorites)
        //   3. Response rate: % answered + avg time (host.stats.response-rate)
        //   4. Views: unique + total 7/30d → DeferredWidget (SPEC-159, cross-entity view tracking)
        //
        // The card renderer is responsible for composing all four into one card surface.
        // The `source` here is the primary (ratings) source; companion sources are listed
        // in config so the renderer can load them. The views slot is marked deferred.
        {
            id: 'host-card-g',
            type: 'kpi',
            label: {
                es: 'Estadísticas',
                en: 'Statistics',
                pt: 'Estatísticas'
            },
            scope: 'own',
            // Bento: wide (2×1) — multi-KPI tiles + breakdown list need horizontal room.
            gridSpan: { cols: 2 },
            config: {
                // Primary: average rating + total reviews (already persisted on accommodation)
                source: 'host.stats.ratings',
                accent: 'purple',
                icon: 'chart',
                // Companion sources for the card renderer to co-load
                companionSources: ['host.stats.favorites', 'host.stats.response-rate'],
                // Views slot is deferred — no backend yet (PostHog client-side only, no DB)
                deferredSlots: [
                    {
                        phaseSpec: 'SPEC-159',
                        description:
                            'Vistas únicas y totales por alojamiento (7/30 días) — disponible cuando se implemente el tracking de vistas.'
                    }
                ],
                emptyText: 'Aún no tenemos estadísticas',
                emptyDescription:
                    'Las métricas van a aparecer a medida que tu alojamiento tenga actividad.',
                errorText: 'No pudimos cargar tus estadísticas',
                errorDescription: 'Probá actualizar el panel.'
            }
        },

        // Card I — Tendencia mensual
        // Bar chart with the host's monthly inquiry count for the last 6 months.
        // Source: host.stats.conversations-monthly (gap-filled server-side).
        {
            id: 'host-card-i',
            type: 'chart',
            label: {
                es: 'Consultas por mes',
                en: 'Inquiries per month',
                pt: 'Consultas por mês'
            },
            scope: 'own',
            // Bento: wide (2×1) — 6-bucket bars stay legible at 2 cols and
            // pair cleanly with the suggestions + market-comparison rows below.
            gridSpan: { cols: 2 },
            config: {
                source: 'host.stats.conversations-monthly',
                chartType: 'bar',
                accent: 'sky',
                icon: 'chart',
                emptyText: 'Aún no hay consultas',
                emptyDescription:
                    'Cuando empieces a recibir consultas, vas a ver la tendencia mensual acá.',
                errorText: 'No pudimos cargar la tendencia',
                errorDescription: 'Probá actualizar el panel.'
            }
        },

        // Card H — Próximos pasos
        // Priority-sorted list of actionable items composed from the same
        // sources that feed cards B/C/D/E (subscription, conversations,
        // reviews, accommodations). Each row is a concrete next step the
        // host can tackle, with a CTA per item.
        {
            id: 'host-card-h',
            type: 'list',
            label: {
                es: 'Próximos pasos',
                en: 'Next steps',
                pt: 'Próximos passos'
            },
            scope: 'own',
            // Bento: narrow (1×1) — actionable rows are short, so a single
            // column is enough; shares the row with card J (market comparison).
            gridSpan: { cols: 1 },
            config: {
                source: 'host.suggestions.list',
                accent: 'warning',
                icon: 'compass',
                maxItems: 5,
                actionPerItem: {
                    label: { es: 'Ir', en: 'Go', pt: 'Ir' }
                    // hrefTemplate omitted — each suggestion row supplies its
                    // own `href` and the ListWidget honors it directly.
                },
                emptyText: '¡Todo al día!',
                emptyDescription:
                    'No tenés pendientes urgentes. Cuando algo pida atención, lo verás acá.',
                errorText: 'No pudimos cargar tus pendientes',
                errorDescription: 'Probá actualizar el panel.'
            }
        },

        // Card J — Comparativo de mercado
        // Per-accommodation comparison: your rating + price vs the destination
        // average (computed across every other active accommodation in the same
        // destination). One row per listing; the host can scan their portfolio
        // and spot listings that are punching above or below market.
        {
            id: 'host-card-j',
            type: 'list',
            label: {
                es: 'Comparativo de mercado',
                en: 'Market comparison',
                pt: 'Comparativo de mercado'
            },
            scope: 'own',
            // Bento: wide (2×1) — per-row meta lines + CTA fit comfortably at
            // 2 cols; shares the row with card H (suggestions) to its left.
            gridSpan: { cols: 2 },
            config: {
                source: 'host.stats.market-comparison',
                accent: 'cyan',
                icon: 'compass',
                maxItems: 5,
                actionPerItem: {
                    label: { es: 'Ver alojamiento', en: 'View listing', pt: 'Ver alojamento' },
                    hrefTemplate: '/accommodations/{id}'
                },
                additionalActionsPerItem: [
                    {
                        label: {
                            es: 'Editar',
                            en: 'Edit',
                            pt: 'Editar'
                        },
                        hrefTemplate: '/accommodations/{id}/edit'
                    }
                ],
                emptyText: 'Sin datos para comparar todavía',
                emptyDescription:
                    'Publicá un alojamiento y volvé acá para ver cómo te comparás con el destino.',
                errorText: 'No pudimos cargar el comparativo',
                errorDescription: 'Probá actualizar el panel.'
            }
        }
    ]
};

// ============================================================================
// editorDashboard — "La redacción" — 8 cards A–H
// ============================================================================

/**
 * Dashboard for the EDITOR role — 11-card "La redacción" view.
 *
 * Card set (SPEC-155 §3 / 03c EDITOR section):
 *   A  — Estadísticas publicaciones   (kpi-grid+companion+deferred, source: editor.posts.published-this-month)
 *   B  — Eventos próximos              (list,                          source: editor.events.upcoming)
 *   C  — Suscriptores Newsletter       (kpi-grid+deferred,             source: editor.newsletter.subscribers)
 *   D  — Campañas recientes            (list,                          source: editor.newsletter.campaigns)
 *   E  — Distribución publicaciones    (chart+deferred,                source: editor.posts.stats)
 *   F  — Estadísticas eventos          (kpi-grid+deferred,             source: editor.events.stats — 6 tiles)
 *   G1 — Salud del contenido · Posts   (checklist grouped,             source: editor.content.health.posts)
 *   G2 — Salud del contenido · Eventos (checklist grouped,             source: editor.content.health.events)
 *   H  — Comentarios                   (callout deferred,              SPEC-165)
 *   I  — Últimos posts                 (list,                          source: editor.posts.latest)
 *   J  — Acciones                      (list,                          source: editor.shortcuts)
 *
 * Bento layout (6-col grid lg, rendered in array order):
 *   Row 1: A (⅓) + B (⅔)     — Stats publicaciones | Eventos próximos
 *   Row 2: J (⅓) + I (⅔)     — Acciones            | Últimos posts
 *   Row 3: D (⅓) + F (⅔)     — Campañas recientes  | Stats eventos (6 tiles)
 *   Row 4: E (½) + C (½)     — Distribución        | Suscriptores Newsletter
 *   Row 5: G1 (½) + G2 (½)   — Salud posts          | Salud eventos
 *   Row 6: H (full)          — Comentarios (deferred banner)
 *
 * Pattern: rows 1–3 are ⅓+⅔ to pair a compact metric/list card with a
 * content-rich hero. Rows 4–5 are ½+½ for equal-weight pairs. Row 6 is a
 * full-width banner to host the comments placeholder without leaving a
 * lopsided gap on any other row.
 *
 * @example
 * ```ts
 * import { dashboards } from '@/config/ia/dashboards';
 * dashboards.editorDashboard.widgets.length; // 11
 * ```
 */
const editorDashboard: DashboardInput = {
    widgets: [
        // -- Row 1: Estadísticas publicaciones (⅓) + Eventos próximos (⅔) --
        // Posts compact KPI alongside the events hero list: same row balances
        // a number-card and a content-card with similar visual weight.

        // Card A — Estadísticas publicaciones (Row 1 left, ⅓)
        // 3-tile grid (Este mes / Total / Borradores) + top 5 by engagement
        // companion list. Deferred "Vistas" tile renders BELOW the grid.
        {
            id: 'editor-card-a',
            type: 'kpi',
            label: {
                es: 'Estadísticas publicaciones',
                en: 'Post statistics',
                pt: 'Estatísticas publicações'
            },
            scope: 'all',
            // Bento: compact (1 = ⅓) — short tile labels + companion list.
            config: {
                source: 'editor.posts.published-this-month',
                accent: 'success',
                icon: 'article',
                emptyText: 'Aún no hay publicaciones',
                emptyDescription:
                    'Cuando publiques tu primer post, va a aparecer acá con sus métricas.',
                errorText: 'No pudimos cargar las publicaciones',
                errorDescription: 'Probá actualizar el panel.',
                deferredSlots: [
                    {
                        phaseSpec: 'SPEC-159',
                        label: 'Vistas',
                        description:
                            'Vistas totales por post — disponible cuando se implemente el tracking de vistas (SPEC-159).'
                    }
                ]
            }
        },

        // Card B — Eventos próximos (Row 1 right, ⅔)
        // upcoming events list (top 5 by date.start asc, client-sorted from
        // a 20-row buffer since admin events doesn't expose a startDate sort).
        {
            id: 'editor-card-b',
            type: 'list',
            label: {
                es: 'Eventos próximos',
                en: 'Upcoming events',
                pt: 'Próximos eventos'
            },
            scope: 'all',
            gridSpan: { cols: 2 },
            config: {
                source: 'editor.events.upcoming',
                accent: 'warning',
                icon: 'calendar',
                maxItems: 5,
                emptyText: 'Sin eventos próximos',
                emptyDescription: 'Cuando se publiquen nuevos eventos, los vas a ver acá.',
                errorText: 'No pudimos cargar los eventos',
                errorDescription: 'Probá actualizar el panel.'
            }
        },

        // -- Row 2: Acciones (⅓) + Últimos posts (⅔) --
        // Compact actions card next to the latest-posts hero list.

        // Card J — Acciones (Row 2 left, ⅓)
        // editorial quick-action shortcuts as ListWidget items.
        {
            id: 'editor-card-j',
            type: 'list',
            label: {
                es: 'Acciones',
                en: 'Quick actions',
                pt: 'Ações'
            },
            scope: 'all',
            config: {
                source: 'editor.shortcuts',
                accent: 'accent',
                icon: 'compass',
                maxItems: 4,
                emptyText: 'No hay acciones disponibles',
                emptyDescription: 'Las acciones rápidas van a aparecer acá.',
                errorText: 'No pudimos cargar las acciones',
                errorDescription: 'Probá actualizar el panel.'
            }
        },

        // Card I — Últimos posts (Row 2 right, ⅔)
        // top 5 published posts by publishedAt:desc — mirrors card B on the
        // previous row so the editor scans freshest content of both surfaces.
        {
            id: 'editor-card-i',
            type: 'list',
            label: {
                es: 'Últimos posts',
                en: 'Latest posts',
                pt: 'Últimos posts'
            },
            scope: 'all',
            gridSpan: { cols: 2 },
            config: {
                source: 'editor.posts.latest',
                accent: 'success',
                icon: 'article',
                maxItems: 5,
                emptyText: 'Sin posts publicados',
                emptyDescription: 'Cuando publiques tu primer post, va a aparecer acá.',
                errorText: 'No pudimos cargar los posts',
                errorDescription: 'Probá actualizar el panel.'
            }
        },

        // -- Row 3: Campañas (⅓) + Estadísticas eventos (⅔) --
        // Compact campaigns list next to the 6-tile event stats hero.

        // Card D — Campañas recientes (Row 3 left, ⅓)
        {
            id: 'editor-card-d',
            type: 'list',
            label: {
                es: 'Campañas recientes',
                en: 'Recent campaigns',
                pt: 'Campanhas recentes'
            },
            scope: 'all',
            config: {
                source: 'editor.newsletter.campaigns',
                accent: 'purple',
                icon: 'activity',
                maxItems: 3,
                emptyText: 'Aún no hay campañas',
                emptyDescription: 'Cuando crees tu primera campaña vas a verla acá con su estado.',
                errorText: 'No pudimos cargar las campañas',
                errorDescription: 'Probá actualizar el panel.'
            }
        },

        // Card F — Estadísticas eventos (Row 3 right, ⅔)
        // 6-tile mini-grid: 3 counters (Total / Próximos / Destacados) +
        // 3 content-health proxies (Sin imagen / Sin ubicación / Sin organizer)
        // + 2 deferred placeholder tiles (Vistas, Favoritos) below the grid.
        {
            id: 'editor-card-f',
            type: 'kpi',
            label: {
                es: 'Estadísticas eventos',
                en: 'Event statistics',
                pt: 'Estatísticas eventos'
            },
            scope: 'all',
            gridSpan: { cols: 2 },
            config: {
                source: 'editor.events.stats',
                accent: 'cyan',
                icon: 'calendar',
                emptyText: 'Aún sin eventos',
                emptyDescription: 'Cuando agregues el primer evento, vas a ver el total acá.',
                errorText: 'No pudimos cargar las estadísticas',
                errorDescription: 'Probá actualizar el panel.',
                deferredSlots: [
                    {
                        phaseSpec: 'SPEC-159',
                        label: 'Vistas',
                        description:
                            'Vistas por evento — disponible cuando se implemente el tracking de vistas (SPEC-159).'
                    },
                    {
                        phaseSpec: 'SPEC-EVENT-FAV',
                        label: 'Favoritos',
                        description:
                            'Eventos favoriteados — requiere agregar el contador de favoritos al schema event (nuevo SPEC).'
                    }
                ]
            }
        },

        // -- Row 4: Distribución (½) + Suscriptores Newsletter (½) --
        // Two half-width metric cards. Suscriptores no longer needs a full
        // row — paired with the chart it reads as a single "audience snapshot".

        // Card E — Distribución de publicaciones (Row 4 left, ½)
        // status distribution bar chart (Publicados / Borradores / Archivados).
        {
            id: 'editor-card-e',
            type: 'chart',
            label: {
                es: 'Distribución de publicaciones',
                en: 'Posts distribution',
                pt: 'Distribuição de publicações'
            },
            scope: 'all',
            gridSpan: { cols: 'half' },
            config: {
                source: 'editor.posts.stats',
                chartType: 'bar',
                accent: 'river',
                icon: 'chart',
                emptyText: 'Aún sin estadísticas',
                emptyDescription: 'Las métricas van apareciendo a medida que publiques contenido.',
                errorText: 'No pudimos cargar las estadísticas',
                errorDescription: 'Probá actualizar el panel.',
                deferredSlots: [
                    {
                        phaseSpec: 'SPEC-159',
                        description:
                            'Vistas por post — disponible cuando se implemente el tracking de vistas.'
                    }
                ]
            }
        },

        // Card C — Suscriptores Newsletter (Row 4 right, ½)
        // 3-tile mini-grid (Activos / En verificación / Dados de baja)
        // + deferred "Tasa de apertura" placeholder below the grid.
        {
            id: 'editor-card-c',
            type: 'kpi',
            label: {
                es: 'Suscriptores Newsletter',
                en: 'Newsletter subscribers',
                pt: 'Assinantes Newsletter'
            },
            scope: 'all',
            gridSpan: { cols: 'half' },
            config: {
                source: 'editor.newsletter.subscribers',
                accent: 'sky',
                icon: 'users',
                emptyText: 'Sin suscriptores',
                emptyDescription:
                    'Cuando los lectores se sumen a la newsletter, vas a ver el desglose acá.',
                errorText: 'No pudimos cargar los suscriptores',
                errorDescription: 'Probá actualizar el panel.',
                deferredSlots: [
                    {
                        phaseSpec: 'SPEC-160',
                        label: 'Tasa de apertura',
                        description:
                            'Tasa de apertura de campañas — disponible cuando se implemente el tracking de aperturas de email (SPEC-160).'
                    }
                ]
            }
        },

        // Card G1 — Salud del contenido · Posts (Row 6 left, half width)
        // Per-post grouped health (one row per post with completeness %,
        // missing-field chips, View/Edit actions). The widget shows top 10
        // worst-rated inline and exposes the rest via a "Ver los X restantes"
        // dialog.
        {
            id: 'editor-card-g-posts',
            type: 'checklist',
            label: {
                es: 'Salud del contenido · Posts',
                en: 'Content health · Posts',
                pt: 'Saúde do conteúdo · Posts'
            },
            scope: 'all',
            // Bento: half-width — pairs side-by-side with G2 on the same row.
            gridSpan: { cols: 'half' },
            config: {
                source: 'editor.content.health.posts',
                checkset: 'content-health',
                accent: 'success',
                icon: 'article',
                emptyText: '¡Todo en orden!',
                emptyDescription: 'Ningún post tiene observaciones pendientes.',
                errorText: 'No pudimos evaluar la salud de los posts',
                errorDescription: 'Probá actualizar el panel.'
            }
        },

        // Card G2 — Salud del contenido · Eventos (Row 5 right, half width)
        // Per-event grouped health, same shape as the posts variant.
        {
            id: 'editor-card-g-events',
            type: 'checklist',
            label: {
                es: 'Salud del contenido · Eventos',
                en: 'Content health · Events',
                pt: 'Saúde do conteúdo · Eventos'
            },
            scope: 'all',
            // Bento: half-width — pairs with G1 on the same row.
            gridSpan: { cols: 'half' },
            config: {
                source: 'editor.content.health.events',
                checkset: 'content-health',
                accent: 'cyan',
                icon: 'calendar',
                emptyText: '¡Todo en orden!',
                emptyDescription: 'Ningún evento tiene observaciones pendientes.',
                errorText: 'No pudimos evaluar la salud de los eventos',
                errorDescription: 'Probá actualizar el panel.'
            }
        },

        // Card H — Comentarios (Row 6, full width banner)
        // DeferredWidget — recent comments endpoint pending SPEC-165.
        // Sits at the bottom as a full-width banner so the placeholder
        // doesn't leave a lopsided half on any other row.
        {
            id: 'editor-card-h',
            type: 'callout',
            label: {
                es: 'Comentarios',
                en: 'Comments',
                pt: 'Comentários'
            },
            scope: 'all',
            onMissing: 'hide',
            gridSpan: { cols: 3 },
            config: {
                deferred: true,
                phaseSpec: 'SPEC-165',
                accent: 'warning',
                icon: 'chat',
                description:
                    'Comentarios recientes en posts y eventos para moderar — disponible cuando se implemente el endpoint de listado de comentarios.'
            }
        }
    ]
};

// ============================================================================
// adminBaseDashboard — cards A–G (shared between ADMIN and SUPER_ADMIN)
// ============================================================================

/**
 * Base dashboard shared by both the ADMIN and SUPER_ADMIN roles — 7 cards A–G.
 *
 * Card set (SPEC-155 §3 / 03c ADMIN section):
 *   A — Estadísticas de entidades   (kpi,    source: admin.entities.counts — 6 KPIs)
 *   B — Alojamientos                (list,   source: admin.accommodations.latest)
 *   C — Editorial                   (list,   source: admin.editorial.summary)
 *   D — Crons                       (list,   source: admin.crons.list + DeferredWidget for failed/last-run)
 *   E — Estado del sistema          (status, source: admin.system.health + DeferredWidget for maintenance)
 *   F — Pendiente de moderación     (kpi,    source: admin.moderation.pending + DeferredWidget for reviews-pending)
 *   G — Usuarios                    (chart,  source: admin.users.stats)
 *
 * ADMIN role points directly to `adminBaseDashboard`.
 * SUPER_ADMIN role points to `superAdminDashboard`, which assembles this base
 * plus `superAdminOnlySection` (cards H–I).
 *
 * @example
 * ```ts
 * import { dashboards } from '@/config/ia/dashboards';
 * dashboards.adminBaseDashboard.widgets.length; // 7
 * ```
 */
const adminBaseDashboard: DashboardInput = {
    widgets: [
        // Card A — Estadísticas de entidades
        // 6 content KPIs: accommodations, destinations, events, posts, attractions, users
        // source: admin.entities.counts (registered in dashboard-sources.ts T-017 built-in)
        {
            id: 'admin-card-a',
            type: 'kpi',
            label: {
                es: 'Estadísticas de entidades',
                en: 'Entity statistics',
                pt: 'Estatísticas de entidades'
            },
            scope: 'all',
            // Bento: full-width hero — 6 horizontal KPI tiles benefit from max width.
            gridSpan: { cols: 3 },
            config: { source: 'admin.entities.counts', accent: 'river', icon: 'chart' }
        },

        // Card B — Alojamientos
        // latest published accommodations (top 5 by published_desc)
        // source: admin.accommodations.latest
        {
            id: 'admin-card-b',
            type: 'list',
            label: {
                es: 'Últimos alojamientos',
                en: 'Latest accommodations',
                pt: 'Últimos alojamentos'
            },
            scope: 'all',
            // Bento: tall (1×2) — vertical list of 5 needs height to breathe.
            gridSpan: { rows: 2 },
            config: {
                source: 'admin.accommodations.latest',
                accent: 'river',
                icon: 'buildings',
                maxItems: 5,
                actionPerItem: {
                    label: { es: 'Ver', en: 'View', pt: 'Ver' },
                    hrefTemplate: '/accommodations/{id}'
                }
            }
        },

        // Card C — Editorial
        // featured upcoming events + recent draft posts + draft events + posts this month
        // source: admin.editorial.summary (fetches all 4 in parallel)
        {
            id: 'admin-card-c',
            type: 'kpi',
            label: {
                es: 'Editorial',
                en: 'Editorial',
                pt: 'Editorial'
            },
            scope: 'all',
            config: {
                source: 'admin.editorial.summary',
                accent: 'terracotta',
                icon: 'article'
            }
        },

        // Card D — Crons
        // cron job list + enabled/total count
        // source: admin.crons.list
        // DeferredWidget for failed/last-run sub-slot (SPEC-161 — per-run history not persisted)
        {
            id: 'admin-card-d',
            type: 'list',
            label: {
                es: 'Crons',
                en: 'Crons',
                pt: 'Crons'
            },
            scope: 'all',
            // Bento: big square (2×2) — grouped list with categories + scrollable body.
            gridSpan: { cols: 2, rows: 2 },
            config: {
                source: 'admin.crons.list',
                accent: 'teal',
                icon: 'clock',
                deferredSlots: [
                    {
                        phaseSpec: 'SPEC-161',
                        description:
                            'Historial de ejecuciones (fallos / última corrida) — disponible cuando se implemente el almacenamiento de resultados de cron.'
                    }
                ]
            }
        },

        // Card E — Estado del sistema
        // system health (db/redis/api status)
        // source: admin.system.health (30s stale time, not 60s)
        // type: 'status' — renders via StatusWidget with the health state badge
        // (up / degraded / down → success / warning / destructive).
        // DeferredWidget for maintenance-mode flag sub-slot (SPEC-161 — no spec yet).
        {
            id: 'admin-card-e',
            type: 'status',
            label: {
                es: 'Estado del sistema',
                en: 'System health',
                pt: 'Estado do sistema'
            },
            scope: 'all',
            // Bento: wide (2×1) — 3 chips + 4 metric tiles row needs horizontal room.
            gridSpan: { cols: 2 },
            config: {
                source: 'admin.system.health',
                accent: 'forest',
                icon: 'activity',
                variantMap: {
                    up: 'success',
                    degraded: 'warning',
                    down: 'destructive'
                },
                deferredSlots: [
                    {
                        phaseSpec: 'SPEC-161',
                        description:
                            'Estado del modo mantenimiento — pendiente de confirmación de la flag SYSTEM_MAINTENANCE_MODE.'
                    }
                ]
            }
        },

        // Card F — Pendiente de moderación
        // unified pending-moderation count across accommodations/destinations/posts/events
        // source: admin.moderation.pending (new aggregator endpoint from Phase 1)
        // DeferredWidget for reviews-pending sub-slot (SPEC-166)
        {
            id: 'admin-card-f',
            type: 'kpi',
            label: {
                es: 'Pendiente de moderación',
                en: 'Pending moderation',
                pt: 'Pendente de moderação'
            },
            scope: 'all',
            config: {
                source: 'admin.moderation.pending',
                accent: 'warning',
                icon: 'shield',
                deferredSlots: [
                    {
                        phaseSpec: 'SPEC-166',
                        description:
                            'Reseñas pendientes de moderación — disponible cuando se implemente el endpoint de conteo de reseñas en cola.'
                    }
                ]
            }
        },

        // Card G — Usuarios
        // users by role + new users registration trend
        // source: admin.users.stats (registered in dashboard-sources.ts T-017 built-in)
        {
            id: 'admin-card-g',
            type: 'chart',
            label: {
                es: 'Usuarios',
                en: 'Users',
                pt: 'Usuários'
            },
            scope: 'all',
            // Bento: wide (2×1) — horizontal ranking bars need width to show role spread.
            gridSpan: { cols: 2 },
            config: {
                source: 'admin.users.stats',
                chartType: 'ranking',
                accent: 'purple',
                icon: 'users'
            }
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
 * Card set (SPEC-155 §3 / 03c SUPER_ADMIN section):
 *   H — Audit Logs             — ALL sub-slots deferred (SPEC-162/163/Sentry)
 *   I — Estadísticas de billing — kpi + chart, source: super.billing.stats
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
export const superAdminOnlySection: DashboardInput = {
    widgets: [
        // Card H — Audit Logs (SUPER_ADMIN-only)
        // All three sub-slots are deferred — no queryable backend today:
        //   1. Admin actions audit log (SPEC-162 — logger-only, no queryable endpoint)
        //   2. Security log (SPEC-162 — same infrastructure gap)
        //   3. Sentry errors 24h (SPEC-163 — Sentry write-only, no API proxy)
        //
        // The entire card is a DeferredWidget cluster. `onMissing: 'hide'` means
        // it is invisible until the backend lands.
        {
            id: 'super-card-h',
            type: 'callout',
            label: {
                es: 'Audit Logs',
                en: 'Audit Logs',
                pt: 'Audit Logs'
            },
            scope: 'all',
            onMissing: 'hide',
            config: {
                // All three sub-slots use DeferredWidget — no source registered
                deferredSlots: [
                    {
                        phaseSpec: 'SPEC-162',
                        description:
                            'Registro de acciones de administración — disponible cuando se implemente el endpoint de auditoría.'
                    },
                    {
                        phaseSpec: 'SPEC-162',
                        description:
                            'Log de seguridad — disponible cuando se implemente el endpoint de log de seguridad.'
                    },
                    {
                        phaseSpec: 'SPEC-163',
                        description:
                            'Errores Sentry (últimas 24h) — disponible cuando se implemente la integración proxy con la API de Sentry.'
                    }
                ]
            }
        },

        // Card I — Estadísticas de billing (SUPER_ADMIN-only)
        // active subscriptions, MRR, 12-month revenue chart, ARPU, churn, subscription breakdown
        // source: super.billing.stats (requires BILLING_METRICS_VIEW — SUPER_ADMIN-only per 03c)
        // Note: per 03c decision #2, BILLING_METRICS_VIEW is revoked from ADMIN role.
        {
            id: 'super-card-i',
            type: 'kpi',
            label: {
                es: 'Estadísticas de billing',
                en: 'Billing statistics',
                pt: 'Estatísticas de billing'
            },
            scope: 'all',
            onMissing: 'hide',
            // Bento: wide (2×1) — 5 KPIs + companion chart line need horizontal room.
            gridSpan: { cols: 2 },
            config: {
                source: 'super.billing.stats',
                accent: 'success',
                icon: 'billing',
                // Companion chart for the 12-month revenue trend
                chartType: 'line'
            }
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
 * The spread construction means editing the source constants automatically
 * updates this assembled dashboard — no manual duplication required.
 *
 * @example
 * ```ts
 * import { dashboards } from '@/config/ia/dashboards';
 * dashboards.superAdminDashboard.widgets.length; // 9 (7 base + 2 super-only)
 * ```
 */
const superAdminDashboard: DashboardInput = {
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
 * - `hostDashboard`          — HOST role (10 cards)
 * - `editorDashboard`        — EDITOR role (8 cards)
 * - `adminBaseDashboard`     — ADMIN role + SUPER_ADMIN base section (7 cards)
 * - `superAdminOnlySection`  — SUPER_ADMIN-exclusive cards H–I (2 cards, `onMissing:'hide'`)
 *
 * Role-facing entries:
 * - `superAdminDashboard`    — SUPER_ADMIN role (assembled: 9 cards = base + super-only)
 *
 * @example
 * ```ts
 * import { dashboards } from '@/config/ia/dashboards';
 * const widgets = dashboards['adminBaseDashboard'].widgets;  // 7 widgets
 * const allWidgets = dashboards['superAdminDashboard'].widgets; // 9 widgets
 * ```
 */
export const dashboards: Record<string, DashboardInput> = {
    hostDashboard,
    editorDashboard,
    adminBaseDashboard,
    superAdminOnlySection,
    superAdminDashboard
};
