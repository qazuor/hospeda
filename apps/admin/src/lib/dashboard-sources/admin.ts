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
 * | `admin.accommodations.latest`      | B    | all   | GET /api/v1/admin/accommodations?sort=published_desc&pageSize=5 |
 * | `admin.editorial.summary`          | C    | all   | GET /api/v1/admin/events (featured upcoming) + posts (drafts + month) + events (drafts) |
 * | `admin.crons.list`                 | D    | all   | GET /api/v1/admin/cron-jobs (cron-admin endpoint) |
 * | `admin.system.health`              | E    | all   | GET /api/v1/health + db/live/ready sub-endpoints |
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

/** Minimal admin list response wrapper. */
interface AdminListApiResponse<T = unknown> {
    readonly success: boolean;
    readonly data?: {
        readonly data?: ReadonlyArray<T>;
        readonly pagination?: { readonly total?: number };
    };
}

/** Minimal accommodation item fields used in the latest-list widget. */
interface AccommodationItem {
    readonly id: string;
    readonly name: string;
    readonly status: string;
    readonly publishedAt?: string;
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

/** Shape of GET /api/v1/admin/cron-jobs response. */
interface CronJobsApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly jobs?: ReadonlyArray<CronJobItem>;
        readonly total?: number;
        readonly enabled?: number;
    };
}

/** Shape of health check endpoints (db/live/ready). */
interface HealthApiResponse {
    readonly status: string;
    readonly db?: string;
    readonly redis?: string;
}

/** Shape of GET /api/v1/admin/moderation/pending-count response. */
interface ModerationPendingCountApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly total?: number;
        readonly accommodations?: number;
        readonly destinations?: number;
        readonly posts?: number;
        readonly events?: number;
        readonly reviews?: number;
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
 * Endpoint: GET /api/v1/admin/accommodations?sort=published_desc&pageSize=5
 */
registerDataSource('admin.accommodations.latest', (ctx) => ({
    queryKey: buildDashboardQueryKey('admin.accommodations.latest', ctx),
    queryFn: async () => {
        const result = await fetchApi<AdminListApiResponse<AccommodationItem>>({
            path: '/api/v1/admin/accommodations?sort=published_desc&pageSize=5'
        });
        const items = result.data.data?.data ?? [];
        // Normalize to ListItem shape expected by ListWidget.
        return items.map((item) => ({
            id: item.id,
            label: item.name,
            meta: item.status,
            href: `/catalogo/alojamientos/${item.id}`
        }));
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
 *   - GET /api/v1/admin/posts?status=DRAFT&sort=updated_at_desc&pageSize=5
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
                    path: `/api/v1/admin/events?isFeatured=true&startDateAfter=${encodeURIComponent(now)}&pageSize=5`
                }),
                fetchApi<AdminListApiResponse<PostItem>>({
                    path: '/api/v1/admin/posts?status=DRAFT&sort=updated_at_desc&pageSize=5'
                }),
                fetchApi<AdminListApiResponse<EventItem>>({
                    path: '/api/v1/admin/events?status=DRAFT&pageSize=5'
                }),
                fetchApi<AdminListApiResponse<PostItem>>({
                    path: `/api/v1/admin/posts?status=ACTIVE&createdAfter=${encodeURIComponent(monthStart)}&pageSize=1`
                })
            ]);

        const featuredEvents = featuredEventsResult.data.data?.data ?? [];
        const draftPosts = draftPostsResult.data.data?.data ?? [];
        const draftEvents = draftEventsResult.data.data?.data ?? [];
        const postsThisMonth = postsThisMonthResult.data.data?.pagination?.total ?? 0;

        // Normalize to ListItem[] shape expected by ListWidget.
        // Combine all editorial items into a single flat list, tagged by type in meta.
        const items = [
            ...featuredEvents.slice(0, 2).map((e) => ({
                id: e.id,
                label: e.title,
                meta: `Evento destacado${e.startDate ? ` · ${new Date(e.startDate).toLocaleDateString('es-AR')}` : ''}`,
                href: `/catalogo/eventos/${e.id}`
            })),
            ...draftPosts.slice(0, 2).map((p) => ({
                id: p.id,
                label: p.title,
                meta: `Post borrador${p.updatedAt ? ` · ${new Date(p.updatedAt).toLocaleDateString('es-AR')}` : ''}`,
                href: `/contenido/posts/${p.id}`
            })),
            ...draftEvents.slice(0, 1).map((e) => ({
                id: e.id,
                label: e.title,
                meta: 'Evento borrador',
                href: `/catalogo/eventos/${e.id}`
            }))
        ];

        // Surface the posts-this-month count as the first badge item if > 0
        const result = items.map((item, i) =>
            i === 0 && postsThisMonth > 0 ? { ...item, badge: `${postsThisMonth} este mes` } : item
        );

        return result;
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
 * Endpoint: GET /api/v1/admin/cron-jobs
 */
registerDataSource('admin.crons.list', (ctx) => ({
    queryKey: buildDashboardQueryKey('admin.crons.list', ctx),
    queryFn: async () => {
        const result = await fetchApi<CronJobsApiResponse>({
            path: '/api/v1/admin/cron-jobs'
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
 * ADMIN card E: system health (db/redis/api status).
 *
 * Maintenance-mode flag is folded into this source once confirmed readable
 * (currently 🟡 — ADMIN-E open item). The health endpoints are always-available
 * so the query has a shorter stale time (30 s) for faster freshness feedback.
 *
 * Source ID: `'admin.system.health'`
 * Scope: `'all'`
 * Endpoint: GET /api/v1/health (+ sub-endpoints if available)
 */
registerDataSource('admin.system.health', (ctx) => ({
    queryKey: buildDashboardQueryKey('admin.system.health', ctx),
    queryFn: async () => {
        const result = await fetchApi<HealthApiResponse>({
            path: '/api/v1/health'
        });
        const rawStatus = result.data.status;
        const db = result.data.db ?? 'unknown';
        const redis = result.data.redis ?? 'unknown';

        // Normalize to StatusData shape expected by StatusWidget.
        // The health endpoint may return 'ok', 'degraded', 'down', or other values.
        // Map 'ok' → 'up' (the variantMap in dashboards.ts uses 'up'/'degraded'/'down').
        const normalizedStatus = rawStatus === 'ok' ? 'up' : (rawStatus ?? 'unknown');
        const description = `DB: ${db} · Redis: ${redis}`;

        return { status: normalizedStatus, description };
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

        // Normalize to KpiData shape expected by KpiWidget.
        // `total` is the primary KPI value; breakdown fields are extra context.
        return {
            value: data.total ?? 0,
            breakdown: {
                accommodations: data.accommodations ?? 0,
                destinations: data.destinations ?? 0,
                posts: data.posts ?? 0,
                events: data.events ?? 0,
                reviews: data.reviews ?? 0
            }
        };
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
