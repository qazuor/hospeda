/**
 * EDITOR Dashboard Data-Source Registrations — T-019 (SPEC-155)
 *
 * Registers all data-source resolvers consumed by the EDITOR dashboard
 * ("La redacción", cards A–H). EDITOR scope covers Posts, Events,
 * Tags/Post-tags, Media, Bookmarks, and (with the newsletter-perm grant from
 * 03c) Newsletter view/write + subscriber-view.
 *
 * ## Registered source IDs
 *
 * | Source ID                              | Card | Scope | Endpoint(s) |
 * |----------------------------------------|------|-------|-------------|
 * | `editor.posts.published-this-month`    | A    | all   | GET /api/v1/admin/posts?status=ACTIVE&createdAfter={month-start}&pageSize=1 |
 * | `editor.posts.drafts`                  | A    | all   | GET /api/v1/admin/posts?status=DRAFT&pageSize=5&sort=updated_at_desc |
 * | `editor.events.upcoming`               | B    | all   | GET /api/v1/admin/events?startDateAfter={now}&pageSize=5&sort=start_date_asc + featured |
 * | `editor.newsletter.subscribers`        | C    | all   | GET /api/v1/admin/newsletter/subscribers?status=active&pageSize=1 + GET /api/v1/admin/newsletter/subscribers/by-preference |
 * | `editor.newsletter.campaigns`          | D    | all   | GET /api/v1/admin/newsletter/campaigns?status=scheduled&pageSize=3 |
 * | `editor.posts.stats`                   | E    | all   | GET /api/v1/admin/posts (status distribution) + popular + count + trend |
 * | `editor.events.stats`                  | F    | all   | GET /api/v1/admin/events?pageSize=1 (total) |
 *
 * ## No-source slots (deferred / phase 2)
 *
 * - **Card G** (`editor.content.health`): client-side checklist — posts/events
 *   missing featured image, tags, SEO, location, organizer, description.
 *   Computed from loaded entity lists; no separate remote source needed.
 * - **Card H** (`editor.comments.recent`): 🟡 backend pending. Comment-listing
 *   endpoint must be verified/built (EDITOR-Q1). Source registered as
 *   `editor.comments.recent` once the endpoint lands.
 * - **Card C — open rate**: 🔴 PHASE 2 (no email-open tracking today).
 * - **Card E — views per post** / **Card F — views per event**: 🔴 PHASE 2
 *   (cross-entity view tracking, global decision).
 *
 * @module dashboard-sources/editor
 * @see apps/admin/src/lib/dashboard-sources.ts — registry API
 * @see .claude/audit/admin-redesign/proposals/03c-dashboards-redefinition.md — EDITOR §
 * @see SPEC-155 T-019
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

/** Minimal admin list response wrapper used for pagination totals. */
interface AdminListApiResponse<T = unknown> {
    readonly success: boolean;
    readonly data?: {
        readonly data?: ReadonlyArray<T>;
        readonly pagination?: { readonly total?: number };
    };
}

/** Shape of a post item in admin list responses. */
interface PostItem {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly createdAt?: string;
    readonly likes?: number;
    readonly comments?: number;
    readonly shares?: number;
    readonly featuredImage?: string;
    readonly tags?: ReadonlyArray<unknown>;
    readonly seoTitle?: string;
}

/** Shape of an event item in admin list responses. */
interface EventItem {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly isFeatured?: boolean;
    readonly startDate?: string;
    readonly featuredImage?: string;
    readonly locationId?: string;
    readonly organizerId?: string;
    readonly description?: string;
}

/** Shape of GET /api/v1/admin/newsletter/subscribers/by-preference response. */
interface SubscribersByPreferenceApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly OFFERS?: number;
        readonly EVENTS?: number;
        readonly GUIDES?: number;
        readonly PRODUCT_NEWS?: number;
    };
}

/** Shape of a newsletter campaign item. */
interface CampaignItem {
    readonly id: string;
    readonly subject: string;
    readonly status: string;
    readonly scheduledAt?: string;
}

/** Shape of GET /api/v1/admin/posts/trend response. */
interface PostsTrendApiResponse {
    readonly success: boolean;
    readonly data?: ReadonlyArray<{
        readonly month: string;
        readonly count: number;
    }>;
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
// CARD A — Posts: published this month + pending drafts
// ============================================================================

/**
 * EDITOR card A: posts published this month (count) and pending drafts (list).
 *
 * Source ID: `'editor.posts.published-this-month'`
 * Scope: `'all'`
 * Endpoints:
 *   - GET /api/v1/admin/posts?status=ACTIVE&createdAfter={month-start}&pageSize=1
 *   - GET /api/v1/admin/posts?status=DRAFT&pageSize=5&sort=updated_at_desc
 */
registerDataSource('editor.posts.published-this-month', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.posts.published-this-month', ctx),
    queryFn: async () => {
        const monthStart = currentMonthStart();
        const [publishedResult, draftsResult] = await Promise.all([
            fetchApi<AdminListApiResponse<PostItem>>({
                path: `/api/v1/admin/posts?status=ACTIVE&createdAfter=${encodeURIComponent(monthStart)}&pageSize=1`
            }),
            fetchApi<AdminListApiResponse<PostItem>>({
                path: '/api/v1/admin/posts?status=DRAFT&pageSize=5&sort=updated_at_desc'
            })
        ]);

        return {
            publishedThisMonth: publishedResult.data.data?.pagination?.total ?? 0,
            pendingDraftsCount: draftsResult.data.data?.pagination?.total ?? 0,
            recentDrafts: draftsResult.data.data?.data ?? []
        };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

/**
 * EDITOR card A (alias for draft list only). Registered separately so the
 * renderer can use a dedicated source if it renders drafts in a list widget
 * distinct from the published-this-month KPI.
 *
 * Source ID: `'editor.posts.drafts'`
 * Scope: `'all'`
 * Endpoint: GET /api/v1/admin/posts?status=DRAFT&pageSize=5&sort=updated_at_desc
 */
registerDataSource('editor.posts.drafts', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.posts.drafts', ctx),
    queryFn: async () => {
        const result = await fetchApi<AdminListApiResponse<PostItem>>({
            path: '/api/v1/admin/posts?status=DRAFT&pageSize=5&sort=updated_at_desc'
        });
        return {
            items: result.data.data?.data ?? [],
            total: result.data.data?.pagination?.total ?? 0
        };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD B — Eventos: upcoming count + list + featured list
// ============================================================================

/**
 * EDITOR card B: upcoming events count, list, and featured upcoming list.
 *
 * Source ID: `'editor.events.upcoming'`
 * Scope: `'all'`
 * Endpoints:
 *   - GET /api/v1/admin/events?startDateAfter={now}&pageSize=1
 *   - GET /api/v1/admin/events?startDateAfter={now}&pageSize=5&sort=start_date_asc
 *   - GET /api/v1/admin/events?isFeatured=true&startDateAfter={now}&pageSize=5
 */
registerDataSource('editor.events.upcoming', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.events.upcoming', ctx),
    queryFn: async () => {
        const now = nowIso();
        const [countResult, listResult, featuredResult] = await Promise.all([
            fetchApi<AdminListApiResponse<EventItem>>({
                path: `/api/v1/admin/events?startDateAfter=${encodeURIComponent(now)}&pageSize=1`
            }),
            fetchApi<AdminListApiResponse<EventItem>>({
                path: `/api/v1/admin/events?startDateAfter=${encodeURIComponent(now)}&pageSize=5&sort=start_date_asc`
            }),
            fetchApi<AdminListApiResponse<EventItem>>({
                path: `/api/v1/admin/events?isFeatured=true&startDateAfter=${encodeURIComponent(now)}&pageSize=5`
            })
        ]);

        return {
            upcomingCount: countResult.data.data?.pagination?.total ?? 0,
            upcomingItems: listResult.data.data?.data ?? [],
            featuredUpcomingItems: featuredResult.data.data?.data ?? []
        };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD C — Suscriptores Newsletter: active count + by-preference breakdown
// ============================================================================

/**
 * EDITOR card C: newsletter subscriber count + breakdown by content preference.
 *
 * Requires `NEWSLETTER_SUBSCRIBER_VIEW` permission (granted to EDITOR per 03c).
 * The `by-preference` breakdown calls the new aggregation endpoint added in
 * Phase 1 (GET /api/v1/admin/newsletter/subscribers/by-preference).
 *
 * Note: open rate is PHASE 2 (no email-open tracking today).
 *
 * Source ID: `'editor.newsletter.subscribers'`
 * Scope: `'all'`
 * Endpoints:
 *   - GET /api/v1/admin/newsletter/subscribers?status=active&pageSize=1
 *   - GET /api/v1/admin/newsletter/subscribers/by-preference
 */
registerDataSource('editor.newsletter.subscribers', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.newsletter.subscribers', ctx),
    queryFn: async () => {
        const [countResult, byPrefResult] = await Promise.all([
            fetchApi<AdminListApiResponse>({
                path: '/api/v1/admin/newsletter/subscribers?status=active&pageSize=1'
            }),
            fetchApi<SubscribersByPreferenceApiResponse>({
                path: '/api/v1/admin/newsletter/subscribers/by-preference'
            })
        ]);

        return {
            activeCount: countResult.data.data?.pagination?.total ?? 0,
            byPreference: byPrefResult.data.data ?? null
        };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD D — Campañas Newsletter: scheduled campaigns
// ============================================================================

/**
 * EDITOR card D: upcoming scheduled newsletter campaigns.
 *
 * Requires `NEWSLETTER_CAMPAIGN_VIEW` permission (granted to EDITOR per 03c).
 *
 * Source ID: `'editor.newsletter.campaigns'`
 * Scope: `'all'`
 * Endpoint: GET /api/v1/admin/newsletter/campaigns?status=scheduled&pageSize=3
 */
registerDataSource('editor.newsletter.campaigns', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.newsletter.campaigns', ctx),
    queryFn: async () => {
        const result = await fetchApi<AdminListApiResponse<CampaignItem>>({
            path: '/api/v1/admin/newsletter/campaigns?status=scheduled&pageSize=3'
        });
        return result.data.data?.data ?? [];
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD E — Estadísticas blog: post status distribution + popular + trend
// ============================================================================

/**
 * EDITOR card E: blog statistics — post status distribution, most popular
 * posts by engagement, total published count, and posts-per-month trend.
 *
 * Views per post are PHASE 2 (cross-entity view tracking not built).
 *
 * Source ID: `'editor.posts.stats'`
 * Scope: `'all'`
 * Endpoints:
 *   - GET /api/v1/admin/posts?status=ACTIVE&pageSize=1  (total published)
 *   - GET /api/v1/admin/posts?status=DRAFT&pageSize=1   (total draft)
 *   - GET /api/v1/admin/posts?status=ARCHIVED&pageSize=1  (total archived)
 *   - GET /api/v1/admin/posts?status=ACTIVE&sort=engagement_desc&pageSize=5  (popular)
 *   - GET /api/v1/admin/posts/trend  (monthly trend — new endpoint from Phase 1)
 */
registerDataSource('editor.posts.stats', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.posts.stats', ctx),
    queryFn: async () => {
        const [activeResult, draftResult, archivedResult, popularResult, trendResult] =
            await Promise.all([
                fetchApi<AdminListApiResponse<PostItem>>({
                    path: '/api/v1/admin/posts?status=ACTIVE&pageSize=1'
                }),
                fetchApi<AdminListApiResponse<PostItem>>({
                    path: '/api/v1/admin/posts?status=DRAFT&pageSize=1'
                }),
                fetchApi<AdminListApiResponse<PostItem>>({
                    path: '/api/v1/admin/posts?status=ARCHIVED&pageSize=1'
                }),
                fetchApi<AdminListApiResponse<PostItem>>({
                    path: '/api/v1/admin/posts?status=ACTIVE&sort=engagement_desc&pageSize=5'
                }),
                fetchApi<PostsTrendApiResponse>({
                    path: '/api/v1/admin/posts/trend'
                })
            ]);

        return {
            statusDistribution: {
                active: activeResult.data.data?.pagination?.total ?? 0,
                draft: draftResult.data.data?.pagination?.total ?? 0,
                archived: archivedResult.data.data?.pagination?.total ?? 0
            },
            popularPosts: popularResult.data.data?.data ?? [],
            totalPublished: activeResult.data.data?.pagination?.total ?? 0,
            monthlyTrend: trendResult.data.data ?? []
        };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD F — Estadísticas eventos: total event count
// ============================================================================

/**
 * EDITOR card F: total events count.
 *
 * Views per event are PHASE 2 (cross-entity view tracking not built).
 *
 * Source ID: `'editor.events.stats'`
 * Scope: `'all'`
 * Endpoint: GET /api/v1/admin/events?pageSize=1
 */
registerDataSource('editor.events.stats', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.events.stats', ctx),
    queryFn: async () => {
        const result = await fetchApi<AdminListApiResponse<EventItem>>({
            path: '/api/v1/admin/events?pageSize=1'
        });
        return { totalEvents: result.data.data?.pagination?.total ?? 0 };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// NOTE — client-side-only and deferred slots (NO resolver registration)
// ============================================================================
// Card G ('editor.content.health'): client-side checklist computed from loaded
//   post/event lists — checks for missing featured image, tags, SEO, location,
//   organizer, description. No remote source needed; widget uses loaded entity data.
//
// Card H ('editor.comments.recent'): 🟡 PENDING — comment-listing endpoint
//   must be verified/built (EDITOR-Q1). Register here once the endpoint lands.
//
// Card C — open rate: 🔴 PHASE 2 (no email-open tracking). Deferred.
// Card E — views per post: 🔴 PHASE 2 (cross-entity view tracking).
// Card F — views per event: 🔴 PHASE 2 (cross-entity view tracking).
