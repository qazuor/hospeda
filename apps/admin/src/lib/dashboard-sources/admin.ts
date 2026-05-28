/**
 * ADMIN/SUPER_ADMIN Base Dashboard Data-Source Registrations — T-020 (SPEC-155)
 *
 * Registers all data-source resolvers consumed by the ADMIN base dashboard
 * (cards A–G, shared by both ADMIN and SUPER_ADMIN roles). The two example
 * sources already registered in `dashboard-sources.ts`
 * (`admin.entities.counts` and `admin.users.stats`) cover cards A and G;
 * this file adds the remaining 5 sources for cards B–F.
 *
 * ## Registered source IDs
 *
 * | Source ID                          | Card | Scope | Endpoint(s) |
 * |------------------------------------|------|-------|-------------|
 * | `admin.accommodations.latest`      | B    | all   | GET /api/v1/admin/accommodations?sort=createdAt:desc&pageSize=5 |
 * | `admin.editorial.summary`          | C    | all   | GET /api/v1/admin/events (featured upcoming) + posts (drafts + month) + events (drafts) |
 * | `admin.crons.list`                 | D    | all   | GET /api/v1/admin/cron (cron-admin endpoint) |
 * | `admin.system.health`              | E    | all   | GET /api/v1/admin/system/health |
 * | `admin.moderation.pending`         | F    | all   | GET /api/v1/admin/moderation/pending-count |
 *
 * NOTE: `admin.entities.counts` (Card A) and `admin.users.stats` (Card G) are
 * already registered in the T-017 base module (`dashboard-sources.ts`). They
 * are intentionally NOT re-registered here to avoid duplicate-registration errors.
 *
 * ## No-source slots (deferred / needs new backend)
 *
 * - **Card D — cron failed/last-run**: 🔴 per-run result NOT persisted. Needs
 *   new backend (run-history storage + endpoint). DeferredWidget / `onMissing: 'hide'`
 *   in T-031.
 * - **Card E — maintenance-mode flag**: 🟡 must confirm the flag is readable;
 *   folded into `admin.system.health` response once confirmed.
 *
 * @module dashboard-sources/admin
 * @see apps/admin/src/lib/dashboard-sources.ts — registry API + admin.entities.counts + admin.users.stats
 * @see .claude/audit/admin-redesign/proposals/03c-dashboards-redefinition.md — ADMIN §
 * @see SPEC-155 T-020
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
 * Minimal admin list response wrapper.
 *
 * The admin list endpoints return `{ success, data: { items, pagination } }`
 * (the rows live under `data.items`, NOT `data.data`). This was the source of
 * the empty-list bug on cards B and C (SPEC-155 follow-up).
 */
interface AdminListApiResponse<T = unknown> {
    readonly success: boolean;
    readonly data?: {
        readonly items?: ReadonlyArray<T>;
        readonly pagination?: { readonly total?: number };
    };
}

/** Accommodation fields surfaced in the "Últimos alojamientos" card. */
interface AccommodationItem {
    readonly id: string;
    readonly name: string;
    readonly type?: string;
    readonly lifecycleState?: string;
    readonly isFeatured?: boolean;
    readonly cityDestination?: { readonly name?: string } | null;
    readonly owner?: { readonly id?: string; readonly displayName?: string } | null;
    readonly createdAt?: string;
    readonly publishedAt?: string;
}

/** Spanish labels for the accommodation type enum (UI display only). */
const ACCOMMODATION_TYPE_LABELS_ES: Readonly<Record<string, string>> = {
    APARTMENT: 'Departamento',
    HOTEL: 'Hotel',
    HOUSE: 'Casa',
    CABIN: 'Cabaña',
    HOSTEL: 'Hostel',
    CAMPING: 'Camping',
    COUNTRY_HOUSE: 'Casa de campo',
    BEDANDBREAKFAST: 'B&B'
};

/** Lifecycle state → list-item status badge mapping. */
const ACCOMMODATION_LIFECYCLE_BADGE: Readonly<
    Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'neutral' }>
> = {
    ACTIVE: { label: 'Activo', variant: 'success' },
    DRAFT: { label: 'Borrador', variant: 'warning' },
    ARCHIVED: { label: 'Archivado', variant: 'neutral' },
    SOFT_DELETED: { label: 'Eliminado', variant: 'destructive' },
    INACTIVE: { label: 'Inactivo', variant: 'neutral' }
};

/** Formats an ISO timestamp as a short Spanish date ("29 may"). */
function shortDateEs(iso: string | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

/** Shape of an event item used in the editorial summary. */
interface EventItem {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly isFeatured?: boolean;
    readonly startDate?: string;
}

/** Shape of a post item used in the editorial summary. */
interface PostItem {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly updatedAt?: string;
}

/** Shape of a cron-job item from the cron-admin endpoint. */
interface CronJobItem {
    readonly id: string;
    readonly name: string;
    readonly enabled: boolean;
    readonly schedule?: string;
    readonly lastRun?: string;
}

/** Shape of GET /api/v1/admin/cron response. */
interface CronJobsApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly jobs?: ReadonlyArray<CronJobItem>;
        readonly total?: number;
        readonly enabled?: number;
    };
}

/**
 * Shape of GET /api/v1/admin/system/health (admin envelope).
 *
 * `status` already arrives rolled-up as `up | degraded | down` (matching the
 * widget's variantMap), so no client-side normalization is needed.
 */
interface SystemHealthApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly status?: 'up' | 'degraded' | 'down';
        readonly db?: string;
        readonly redis?: string;
        readonly uptime?: number;
    };
}

/** Shape of GET /api/v1/admin/metrics — used as second source for card E. */
interface AdminMetricsApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly summary?: {
            readonly totalRequests?: number;
            readonly totalErrors?: number;
            readonly globalErrorRate?: number;
            readonly activeConnections?: number;
        };
    };
}

/**
 * Shape of GET /api/v1/admin/moderation/pending-count response.
 *
 * `total` is at the top of `data`; the per-entity counts are nested under
 * `data.byEntity` (NOT flat on `data`). Reading them flat left the breakdown
 * at all-zeros (SPEC-155 follow-up).
 */
interface ModerationPendingCountApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly total?: number;
        readonly byEntity?: {
            readonly accommodations?: number;
            readonly destinations?: number;
            readonly posts?: number;
            readonly events?: number;
            readonly reviews?: number;
        };
    };
}

// ============================================================================
// HELPERS
// ============================================================================

/** Returns the ISO string for the first day of the current UTC month. */
function currentMonthStart(): string {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Returns the current UTC ISO timestamp string. */
function nowIso(): string {
    return new Date().toISOString();
}

// ============================================================================
// CARD B — Alojamientos: latest published accommodations
// ============================================================================

/**
 * ADMIN card B: latest published accommodations (top 5).
 *
 * Source ID: `'admin.accommodations.latest'`
 * Scope: `'all'`
 * Endpoint: GET /api/v1/admin/accommodations?sort=createdAt:desc&pageSize=5
 */
registerDataSource('admin.accommodations.latest', (ctx) => ({
    queryKey: buildDashboardQueryKey('admin.accommodations.latest', ctx),
    queryFn: async () => {
        // Sort format is `field:asc|desc` (NOT `field_desc`); `publishedAt` is not
        // a sortable field on this endpoint, so use `createdAt:desc` (most recent).
        const result = await fetchApi<AdminListApiResponse<AccommodationItem>>({
            path: '/api/v1/admin/accommodations?sort=createdAt:desc&pageSize=5'
        });
        const items = result.data.data?.items ?? [];

        // Normalize to ListItem shape expected by ListWidget. Each row carries:
        //  - meta: `Tipo · Destino · Fecha`
        //  - statusBadge: lifecycle state (Activo / Borrador / …)
        //  - ownerName / ownerHref: clickable author of the accommodation
        //  - badge: `★ Destacado` when featured
        return items.map((item) => {
            const parts: string[] = [];
            if (item.type) {
                parts.push(ACCOMMODATION_TYPE_LABELS_ES[item.type] ?? item.type);
            }
            const destName = item.cityDestination?.name;
            if (destName) parts.push(destName);
            const date = shortDateEs(item.createdAt ?? item.publishedAt);
            if (date) parts.push(date);

            return {
                id: item.id,
                label: item.name,
                meta: parts.join(' · '),
                href: `/accommodations/${item.id}`,
                badge: item.isFeatured ? '★' : undefined,
                statusBadge: item.lifecycleState
                    ? ACCOMMODATION_LIFECYCLE_BADGE[item.lifecycleState]
                    : undefined,
                ownerName: item.owner?.displayName,
                ownerHref: item.owner?.id ? `/access/users/${item.owner.id}` : undefined
            };
        });
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD C — Editorial: featured upcoming events + drafts + posts this month
// ============================================================================

/**
 * ADMIN card C: editorial summary.
 *
 * Confirmed set (03c 2026-05-26):
 *   - Featured upcoming events
 *   - Recent draft posts
 *   - Draft events
 *   - Posts this month
 *
 * ADMIN has `POST_VIEW_ALL` + `EVENT_VIEW_ALL`, so these are unscoped queries.
 *
 * Source ID: `'admin.editorial.summary'`
 * Scope: `'all'`
 * Endpoints (parallel):
 *   - GET /api/v1/admin/events?isFeatured=true&startDateAfter={now}&pageSize=5
 *   - GET /api/v1/admin/posts?status=DRAFT&sort=updatedAt:desc&pageSize=5
 *   - GET /api/v1/admin/events?status=DRAFT&pageSize=5
 *   - GET /api/v1/admin/posts?status=ACTIVE&createdAfter={month-start}&pageSize=1
 */
registerDataSource('admin.editorial.summary', (ctx) => ({
    queryKey: buildDashboardQueryKey('admin.editorial.summary', ctx),
    queryFn: async () => {
        const now = nowIso();
        const monthStart = currentMonthStart();

        const [featuredEventsResult, draftPostsResult, draftEventsResult, postsThisMonthResult] =
            await Promise.all([
                fetchApi<AdminListApiResponse<EventItem>>({
                    path: `/api/v1/admin/events?isFeatured=true&startDateAfter=${encodeURIComponent(now)}&pageSize=1`
                }),
                fetchApi<AdminListApiResponse<PostItem>>({
                    path: '/api/v1/admin/posts?status=DRAFT&pageSize=1'
                }),
                fetchApi<AdminListApiResponse<EventItem>>({
                    path: '/api/v1/admin/events?status=DRAFT&pageSize=1'
                }),
                fetchApi<AdminListApiResponse<PostItem>>({
                    path: `/api/v1/admin/posts?status=ACTIVE&createdAfter=${encodeURIComponent(monthStart)}&pageSize=1`
                })
            ]);

        // Read pagination totals (we only need counts; pageSize=1 is fine).
        const featuredEventsTotal = featuredEventsResult.data.data?.pagination?.total ?? 0;
        const draftPostsTotal = draftPostsResult.data.data?.pagination?.total ?? 0;
        const draftEventsTotal = draftEventsResult.data.data?.pagination?.total ?? 0;
        const postsThisMonthTotal = postsThisMonthResult.data.data?.pagination?.total ?? 0;

        // 4 explicit KPIs (mini-grid) — each one is a clear, named metric so
        // the card actually communicates what's happening editorially.
        const kpis = [
            {
                key: 'featuredEvents',
                label: {
                    es: 'Eventos destacados próximos',
                    en: 'Upcoming featured events',
                    pt: 'Eventos destacados próximos'
                },
                value: featuredEventsTotal,
                href: '/events',
                accent: 'accent',
                icon: 'calendar'
            },
            {
                key: 'postsThisMonth',
                label: {
                    es: 'Posts publicados este mes',
                    en: 'Posts published this month',
                    pt: 'Posts publicados este mês'
                },
                value: postsThisMonthTotal,
                href: '/posts',
                accent: 'forest',
                icon: 'article'
            },
            {
                key: 'draftPosts',
                label: {
                    es: 'Posts borrador',
                    en: 'Draft posts',
                    pt: 'Posts rascunho'
                },
                value: draftPostsTotal,
                href: '/posts',
                accent: 'terracotta',
                icon: 'article'
            },
            {
                key: 'draftEvents',
                label: {
                    es: 'Eventos borrador',
                    en: 'Draft events',
                    pt: 'Eventos rascunho'
                },
                value: draftEventsTotal,
                href: '/events',
                accent: 'sand',
                icon: 'calendar'
            }
        ];

        const total = kpis.reduce((sum, k) => sum + k.value, 0);
        return { value: total, kpis };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD D — Crons: cron job list + enabled/total count
// ============================================================================

/**
 * ADMIN card D: cron job list with enabled/total summary.
 *
 * Per-run results (failed/last-run status) are NOT persisted — those slots are
 * 🔴 and require new backend. Only the list + enabled count are fetched here.
 *
 * Source ID: `'admin.crons.list'`
 * Scope: `'all'`
 * Endpoint: GET /api/v1/admin/cron
 */
registerDataSource('admin.crons.list', (ctx) => ({
    queryKey: buildDashboardQueryKey('admin.crons.list', ctx),
    queryFn: async () => {
        const result = await fetchApi<CronJobsApiResponse>({
            path: '/api/v1/admin/cron'
        });
        const jobs = result.data.data?.jobs ?? [];

        // Normalize to ListItem[] shape expected by ListWidget.
        return jobs.map((job) => ({
            id: job.id,
            label: job.name,
            meta: job.schedule ?? undefined,
            badge: job.enabled ? 'activo' : 'inactivo'
        }));
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD E — Estado del sistema: health checks
// ============================================================================

/**
 * ADMIN card E: system health (db/redis status).
 *
 * Uses the dedicated admin endpoint (under /api/v1/admin/* so CORS + auth
 * apply) rather than the root /health, which has no CORS headers and is
 * blocked by the browser on the cross-origin, credentialed admin fetch.
 * Shorter stale time (30 s) for faster freshness feedback.
 *
 * Source ID: `'admin.system.health'`
 * Scope: `'all'`
 * Endpoint: GET /api/v1/admin/system/health
 */
registerDataSource('admin.system.health', (ctx) => ({
    queryKey: buildDashboardQueryKey('admin.system.health', ctx),
    queryFn: async () => {
        // Two fetches in parallel: rollup health (db/redis chips + uptime) +
        // metrics summary (active connections, requests, error rate) so the
        // card surfaces both system status AND traffic at a glance.
        const [healthResult, metricsResult] = await Promise.all([
            fetchApi<SystemHealthApiResponse>({ path: '/api/v1/admin/system/health' }),
            fetchApi<AdminMetricsApiResponse>({ path: '/api/v1/admin/metrics' }).catch(
                () => undefined
            )
        ]);

        const data = healthResult.data.data;
        if (!data) return null;

        // Multi-chip StatusData shape: one chip per sub-system (API / DB /
        // Redis) so they read uniformly. `status` (rollup up/degraded/down)
        // is retained for the card-level rollup.
        const dbItemStatus =
            data.db === 'connected' ? 'up' : data.db === 'disconnected' ? 'down' : 'unknown';
        const redisItemStatus =
            data.redis === 'connected' ? 'up' : data.redis === 'disconnected' ? 'down' : 'unknown';

        const summary = metricsResult?.data.data?.summary;

        return {
            status: data.status ?? 'unknown',
            items: [
                // If we got the response at all, the API is up — surfaced as a
                // first chip so the card always reads as 3 uniform entries.
                { key: 'api', label: 'API', status: 'up' },
                { key: 'db', label: 'Base de datos', status: dbItemStatus },
                { key: 'redis', label: 'Redis', status: redisItemStatus }
            ],
            metrics: {
                uptime: data.uptime,
                activeConnections: summary?.activeConnections,
                totalRequests: summary?.totalRequests,
                errorRate: summary?.globalErrorRate
            }
        };
    },
    // Shorter stale time for health checks — 30 s gives more up-to-date feedback.
    staleTime: 30_000
}));

// ============================================================================
// CARD F — Pendiente de moderación: unified pending count
// ============================================================================

/**
 * ADMIN card F: moderation pending count across all entity types.
 *
 * Calls the new aggregator endpoint built in Phase 1
 * (GET /api/v1/admin/moderation/pending-count). This endpoint aggregates
 * accommodations + destinations + posts + events + reviews pending moderation
 * into a single response to avoid 4+ parallel requests.
 *
 * Source ID: `'admin.moderation.pending'`
 * Scope: `'all'`
 * Endpoint: GET /api/v1/admin/moderation/pending-count
 */
registerDataSource('admin.moderation.pending', (ctx) => ({
    queryKey: buildDashboardQueryKey('admin.moderation.pending', ctx),
    queryFn: async () => {
        const result = await fetchApi<ModerationPendingCountApiResponse>({
            path: '/api/v1/admin/moderation/pending-count'
        });
        const data = result.data.data;
        if (!data) return null;

        // Normalize to KpiData GRID MODE shape (kpis array) so the card renders
        // one mini-tile per entity instead of a single opaque total. Matches
        // the visual pattern of card A (multi-accent per entity).
        const byEntity = data.byEntity ?? {};
        const total = data.total ?? 0;
        const kpis = [
            {
                key: 'accommodations',
                label: { es: 'Alojamientos', en: 'Accommodations', pt: 'Alojamentos' },
                value: byEntity.accommodations ?? 0,
                href: '/accommodations',
                accent: 'river',
                icon: 'buildings'
            },
            {
                key: 'destinations',
                label: { es: 'Destinos', en: 'Destinations', pt: 'Destinos' },
                value: byEntity.destinations ?? 0,
                href: '/destinations',
                accent: 'forest',
                icon: 'compass'
            },
            {
                key: 'posts',
                label: { es: 'Posts', en: 'Posts', pt: 'Posts' },
                value: byEntity.posts ?? 0,
                href: '/posts',
                accent: 'terracotta',
                icon: 'article'
            },
            {
                key: 'events',
                label: { es: 'Eventos', en: 'Events', pt: 'Eventos' },
                value: byEntity.events ?? 0,
                href: '/events',
                accent: 'accent',
                icon: 'calendar'
            }
        ];

        return { value: total, kpis };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// NOTE — already registered in T-017 base module
// ============================================================================
// `admin.entities.counts` (Card A) — registered in dashboard-sources.ts
// `admin.users.stats`     (Card G) — registered in dashboard-sources.ts
// Do NOT re-register here; duplicates throw in DEV mode.

// ============================================================================
// NOTE — deferred / needs new backend
// ============================================================================
// Card D — cron failed/last-run: 🔴 per-run history NOT persisted. New backend
//   (run-history table + endpoint) required before this can be registered.
//   DeferredWidget handles this slot; T-031 sets onMissing: 'hide'.
//
// Card E — maintenance-mode flag: 🟡 confirm the SYSTEM_MAINTENANCE_MODE flag
//   is readable. Once confirmed, add it to the admin.system.health queryFn above.
