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
 * | `editor.posts.drafts`                  | A    | all   | GET /api/v1/admin/posts?status=DRAFT&pageSize=5&sort=updatedAt:desc |
 * | `editor.events.upcoming`               | B    | all   | GET /api/v1/admin/events?startDateAfter={now}&pageSize=5&sort=startDate:asc + featured |
 * | `editor.newsletter.subscribers`        | C    | all   | GET /api/v1/admin/newsletter/subscribers?subscriberStatus=active&pageSize=1 + GET /api/v1/admin/newsletter/subscribers/by-preference |
 * | `editor.newsletter.campaigns`          | D    | all   | GET /api/v1/admin/newsletter/campaigns?pageSize=3 (sort defaults to createdAt:desc) |
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

/**
 * Minimal admin list response wrapper.
 *
 * The Hono admin list factory wraps responses as
 * `{ success, data: { items, pagination }, metadata }`. After `fetchApi`
 * adds its own `{ data, status }` envelope, the path to the array is
 * `result.data.data.items` and the total is `result.data.data.pagination.total`.
 */
interface AdminListApiResponse<T = unknown> {
    readonly success: boolean;
    readonly data?: {
        readonly items?: ReadonlyArray<T>;
        readonly pagination?: { readonly total?: number };
    };
}

/** Shape of a post item in admin list responses. */
interface PostItem {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly createdAt?: string;
    readonly updatedAt?: string;
    readonly publishedAt?: string | null;
    readonly likes?: number;
    readonly comments?: number;
    readonly shares?: number;
    readonly featuredImage?: string;
    readonly tags?: ReadonlyArray<unknown>;
    readonly seoTitle?: string;
}

/**
 * Shape of an event item in admin list responses.
 * The event entity stores its start/end inside a JSONB `date` object, not flat columns.
 */
interface EventItem {
    readonly id: string;
    readonly name: string;
    readonly status?: string;
    readonly isFeatured?: boolean;
    readonly date?: { readonly start?: string; readonly end?: string };
    readonly featuredImage?: string;
    readonly locationId?: string;
    readonly organizerId?: string;
    readonly description?: string;
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
 * EDITOR card A: posts mini-grid (Este mes / Total publicados / Borradores)
 * + recent drafts as companion list.
 *
 * Multi-KPI tile pattern (same shape HOST card A uses) so every number on
 * the card has an explicit label, instead of a single counter floating
 * without context.
 *
 * Source ID: `'editor.posts.published-this-month'`
 * Scope: `'all'`
 * Endpoints (parallel):
 *   - GET /api/v1/admin/posts?status=ACTIVE&createdAfter={month-start}&pageSize=1
 *   - GET /api/v1/admin/posts?status=ACTIVE&pageSize=1
 *   - GET /api/v1/admin/posts?status=DRAFT&pageSize=5&sort=updatedAt:desc
 */
registerDataSource('editor.posts.published-this-month', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.posts.published-this-month', ctx),
    queryFn: async () => {
        const monthStart = currentMonthStart();
        const [thisMonthResult, totalPublishedResult, draftsResult] = await Promise.all([
            fetchApi<AdminListApiResponse<PostItem>>({
                path: `/api/v1/admin/posts?status=ACTIVE&createdAfter=${encodeURIComponent(monthStart)}&pageSize=1`
            }),
            fetchApi<AdminListApiResponse<PostItem>>({
                path: '/api/v1/admin/posts?status=ACTIVE&pageSize=1'
            }),
            fetchApi<AdminListApiResponse<PostItem>>({
                path: '/api/v1/admin/posts?status=DRAFT&pageSize=5&sort=updatedAt:desc'
            })
        ]);

        const thisMonth = thisMonthResult.data.data?.pagination?.total ?? 0;
        const totalPublished = totalPublishedResult.data.data?.pagination?.total ?? 0;
        const draftItems = draftsResult.data.data?.items ?? [];
        const draftTotal = draftsResult.data.data?.pagination?.total ?? 0;

        const companionItems = draftItems.map((post) => ({
            key: post.id,
            label: post.title,
            href: `/contenido/posts/${post.id}`
        }));

        return {
            kpis: [
                {
                    key: 'thisMonth',
                    label: { es: 'Este mes', en: 'This month', pt: 'Este mês' },
                    value: thisMonth,
                    accent: 'success',
                    icon: 'article',
                    href: '/contenido/posts?status=ACTIVE'
                },
                {
                    key: 'totalPublished',
                    label: { es: 'Total', en: 'Total', pt: 'Total' },
                    value: totalPublished,
                    accent: 'river',
                    icon: 'activity',
                    href: '/contenido/posts?status=ACTIVE'
                },
                {
                    key: 'drafts',
                    label: { es: 'Borradores', en: 'Drafts', pt: 'Rascunhos' },
                    value: draftTotal,
                    accent: 'warning',
                    icon: 'clock',
                    href: '/contenido/posts?status=DRAFT'
                }
            ],
            companionLabel: draftTotal > 0 ? 'Borradores recientes' : undefined,
            companionItems
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
 * Endpoint: GET /api/v1/admin/posts?status=DRAFT&pageSize=5&sort=updatedAt:desc
 */
registerDataSource('editor.posts.drafts', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.posts.drafts', ctx),
    queryFn: async () => {
        const result = await fetchApi<AdminListApiResponse<PostItem>>({
            path: '/api/v1/admin/posts?status=DRAFT&pageSize=5&sort=updatedAt:desc'
        });
        const items = result.data.data?.items ?? [];
        // Normalize to ListItem[] shape expected by ListWidget (companion source).
        // Sort key is `updatedAt:desc`, so meta shows "last edited" rather than created.
        return items.map((post) => ({
            id: post.id,
            label: post.title,
            meta: post.updatedAt ? new Date(post.updatedAt).toLocaleDateString('es-AR') : undefined,
            href: `/contenido/posts/${post.id}`
        }));
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD B — Eventos: upcoming count + list + featured list
// ============================================================================

/**
 * EDITOR card B: upcoming events list (top 5 by start date asc).
 *
 * The admin events list does NOT accept `sort=startDate:*` (it's a JSONB
 * `date.start` field, not a column — only the public route exposes the
 * synthetic sort). We page a 20-row buffer with `startDateAfter={now}` to
 * cap the candidate set, then sort + slice client-side.
 *
 * Source ID: `'editor.events.upcoming'`
 * Scope: `'all'`
 * Endpoint: GET /api/v1/admin/events?startDateAfter={now}&pageSize=20
 */
registerDataSource('editor.events.upcoming', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.events.upcoming', ctx),
    queryFn: async () => {
        const now = nowIso();
        const listResult = await fetchApi<AdminListApiResponse<EventItem>>({
            path: `/api/v1/admin/events?startDateAfter=${encodeURIComponent(now)}&pageSize=20`
        });

        const upcomingItems = listResult.data.data?.items ?? [];

        // Client-side sort by start date ascending; events without a date land last.
        const sorted = [...upcomingItems].sort((a, b) => {
            const aStart = a.date?.start;
            const bStart = b.date?.start;
            if (!aStart && !bStart) return 0;
            if (!aStart) return 1;
            if (!bStart) return -1;
            return aStart.localeCompare(bStart);
        });

        // Normalize to ListItem[] shape expected by ListWidget.
        return sorted.slice(0, 5).map((event) => ({
            id: event.id,
            label: event.name,
            meta: event.date?.start
                ? new Date(event.date.start).toLocaleDateString('es-AR')
                : undefined,
            badge: event.isFeatured ? 'destacado' : undefined,
            href: `/catalogo/eventos/${event.id}`
        }));
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD C — Suscriptores Newsletter: active count + by-preference breakdown
// ============================================================================

/**
 * EDITOR card C: newsletter subscribers mini-grid
 * (Activos / En verificación / Dados de baja).
 *
 * Multi-KPI tile pattern: every number on the card carries an explicit
 * label instead of a single counter floating without context. Open rate
 * is PHASE 2 (no email-open tracking today, SPEC-160).
 *
 * Requires `NEWSLETTER_SUBSCRIBER_VIEW` permission (granted to EDITOR per 03c).
 *
 * Source ID: `'editor.newsletter.subscribers'`
 * Scope: `'all'`
 * Endpoints (parallel, all use `subscriberStatus` — the admin schema renames
 * `status` to avoid shadowing the base LifecycleStatusEnum filter):
 *   - GET /api/v1/admin/newsletter/subscribers?subscriberStatus=active&pageSize=1
 *   - GET /api/v1/admin/newsletter/subscribers?subscriberStatus=pending_verification&pageSize=1
 *   - GET /api/v1/admin/newsletter/subscribers?subscriberStatus=unsubscribed&pageSize=1
 */
registerDataSource('editor.newsletter.subscribers', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.newsletter.subscribers', ctx),
    queryFn: async () => {
        const [activeResult, pendingResult, unsubscribedResult] = await Promise.all([
            fetchApi<AdminListApiResponse>({
                path: '/api/v1/admin/newsletter/subscribers?subscriberStatus=active&pageSize=1'
            }),
            fetchApi<AdminListApiResponse>({
                path: '/api/v1/admin/newsletter/subscribers?subscriberStatus=pending_verification&pageSize=1'
            }),
            fetchApi<AdminListApiResponse>({
                path: '/api/v1/admin/newsletter/subscribers?subscriberStatus=unsubscribed&pageSize=1'
            })
        ]);

        const active = activeResult.data.data?.pagination?.total ?? 0;
        const pending = pendingResult.data.data?.pagination?.total ?? 0;
        const unsubscribed = unsubscribedResult.data.data?.pagination?.total ?? 0;

        // Tile labels keep their full descriptive form; KpiWidget tiles in a
        // 1×1 card visually truncate but expose the complete text via a
        // native `title` tooltip on hover.
        return {
            kpis: [
                {
                    key: 'active',
                    label: { es: 'Activos', en: 'Active', pt: 'Ativos' },
                    value: active,
                    accent: 'success',
                    icon: 'users',
                    href: '/marketing/newsletter/subscribers?subscriberStatus=active'
                },
                {
                    key: 'pending',
                    label: {
                        es: 'En verificación',
                        en: 'Pending verification',
                        pt: 'Em verificação'
                    },
                    value: pending,
                    accent: 'warning',
                    icon: 'clock',
                    href: '/marketing/newsletter/subscribers?subscriberStatus=pending_verification'
                },
                {
                    key: 'unsubscribed',
                    label: { es: 'Dados de baja', en: 'Unsubscribed', pt: 'Cancelados' },
                    value: unsubscribed,
                    accent: 'sand',
                    icon: 'user',
                    href: '/marketing/newsletter/subscribers?subscriberStatus=unsubscribed'
                }
            ]
        };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD D — Campañas Newsletter: recent campaigns
// ============================================================================

/**
 * EDITOR card D: most recent newsletter campaigns regardless of status.
 *
 * The campaign status enum is `DRAFT | SENDING | SENT | CANCELLED` — there
 * is no `SCHEDULED` state in MVP (scheduled sends are V2). Showing the latest
 * activity by created_desc is more useful day-to-day than filtering by a
 * single status; the row badge surfaces the per-campaign status.
 *
 * Requires `NEWSLETTER_CAMPAIGN_VIEW` permission (granted to EDITOR per 03c).
 *
 * Source ID: `'editor.newsletter.campaigns'`
 * Scope: `'all'`
 * Endpoint: GET /api/v1/admin/newsletter/campaigns?pageSize=3
 * (sort defaults to `createdAt:desc` per AdminSearchBaseSchema)
 */
registerDataSource('editor.newsletter.campaigns', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.newsletter.campaigns', ctx),
    queryFn: async () => {
        const result = await fetchApi<AdminListApiResponse<CampaignItem>>({
            path: '/api/v1/admin/newsletter/campaigns?pageSize=3'
        });
        const campaigns = result.data.data?.items ?? [];
        // Normalize to ListItem[] shape expected by ListWidget.
        return campaigns.map((campaign) => ({
            id: campaign.id,
            label: campaign.subject,
            meta: campaign.scheduledAt
                ? new Date(campaign.scheduledAt).toLocaleDateString('es-AR')
                : undefined,
            badge: campaign.status
        }));
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
        const [activeResult, draftResult, archivedResult, trendResult] = await Promise.all([
            fetchApi<AdminListApiResponse<PostItem>>({
                path: '/api/v1/admin/posts?status=ACTIVE&pageSize=1'
            }),
            fetchApi<AdminListApiResponse<PostItem>>({
                path: '/api/v1/admin/posts?status=DRAFT&pageSize=1'
            }),
            fetchApi<AdminListApiResponse<PostItem>>({
                path: '/api/v1/admin/posts?status=ARCHIVED&pageSize=1'
            }),
            fetchApi<PostsTrendApiResponse>({
                path: '/api/v1/admin/posts/trend'
            })
        ]);

        const monthlyTrend = trendResult.data.data ?? [];

        // Normalize to ChartData shape expected by ChartWidget.
        // Use the monthly trend as the chart series (posts published per month).
        // Fall back to status-distribution bar chart when trend is empty.
        if (monthlyTrend.length > 0) {
            return {
                series: monthlyTrend.map((point) => ({
                    label: point.month,
                    value: point.count
                }))
            };
        }

        // Fallback: status distribution as a bar chart
        const active = activeResult.data.data?.pagination?.total ?? 0;
        const draft = draftResult.data.data?.pagination?.total ?? 0;
        const archived = archivedResult.data.data?.pagination?.total ?? 0;
        return {
            series: [
                { label: 'Publicados', value: active },
                { label: 'Borradores', value: draft },
                { label: 'Archivados', value: archived }
            ]
        };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD F — Estadísticas eventos: total event count
// ============================================================================

/**
 * EDITOR card F: events stats as a 3-tile mini grid (Total / Próximos / Destacados).
 *
 * Three parallel count queries; the KpiWidget renders a multi-KPI grid when
 * `kpis[]` is provided (same shape HOST card A uses for "Total/Activos/Borradores").
 *
 * Views per event are PHASE 2 (cross-entity view tracking not built).
 *
 * Source ID: `'editor.events.stats'`
 * Scope: `'all'`
 * Endpoints (parallel):
 *   - GET /api/v1/admin/events?pageSize=1                              (total)
 *   - GET /api/v1/admin/events?startDateAfter={now}&pageSize=1         (upcoming)
 *   - GET /api/v1/admin/events?isFeatured=true&pageSize=1              (featured)
 */
registerDataSource('editor.events.stats', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.events.stats', ctx),
    queryFn: async () => {
        const now = nowIso();
        const [totalResult, upcomingResult, featuredResult] = await Promise.all([
            fetchApi<AdminListApiResponse<EventItem>>({
                path: '/api/v1/admin/events?pageSize=1'
            }),
            fetchApi<AdminListApiResponse<EventItem>>({
                path: `/api/v1/admin/events?startDateAfter=${encodeURIComponent(now)}&pageSize=1`
            }),
            fetchApi<AdminListApiResponse<EventItem>>({
                path: '/api/v1/admin/events?isFeatured=true&pageSize=1'
            })
        ]);

        const total = totalResult.data.data?.pagination?.total ?? 0;
        const upcoming = upcomingResult.data.data?.pagination?.total ?? 0;
        const featured = featuredResult.data.data?.pagination?.total ?? 0;

        return {
            kpis: [
                {
                    key: 'total',
                    label: { es: 'Total', en: 'Total', pt: 'Total' },
                    value: total,
                    accent: 'cyan',
                    icon: 'calendar',
                    href: '/catalogo/eventos'
                },
                {
                    key: 'upcoming',
                    label: { es: 'Próximos', en: 'Upcoming', pt: 'Próximos' },
                    value: upcoming,
                    accent: 'success',
                    icon: 'clock',
                    href: '/catalogo/eventos'
                },
                {
                    key: 'featured',
                    label: { es: 'Destacados', en: 'Featured', pt: 'Destaques' },
                    value: featured,
                    accent: 'warning',
                    icon: 'star',
                    href: '/catalogo/eventos?isFeatured=true'
                }
            ]
        };
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
