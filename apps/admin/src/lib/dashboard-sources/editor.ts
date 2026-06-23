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
 * - **Card C — open rate**: shipped in SPEC-160 T-001 (last-sent campaign open
 *   rate appended as 4th tile in `editor.newsletter.subscribers` queryFn).
 * - **Card E — views per post** / **Card F — views per event**: 🔴 PHASE 2
 *   (cross-entity view tracking, global decision).
 *
 * @module dashboard-sources/editor
 * @see apps/admin/src/lib/dashboard-sources.ts — registry API
 * @see .claude/audit/admin-redesign/proposals/03c-dashboards-redefinition.md — EDITOR §
 * @see SPEC-155 T-019
 */

import { fetchCampaignMetrics } from '@/hooks/newsletter/use-campaign-metrics';
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
    readonly isNews?: boolean;
    readonly likes?: number;
    readonly comments?: number;
    readonly shares?: number;
    readonly featuredImage?: string;
    readonly tags?: ReadonlyArray<unknown>;
    readonly seoTitle?: string;
}

/**
 * Shape of an event item in admin list responses.
 * The event entity stores its start/end inside a JSONB `date` object and its
 * media inside a JSONB `media` object — neither is exposed as a flat column.
 * Location and organizer FKs are nullable.
 */
interface EventItem {
    readonly id: string;
    readonly name: string;
    readonly status?: string;
    readonly isFeatured?: boolean;
    readonly date?: { readonly start?: string; readonly end?: string };
    readonly media?: { readonly featuredImage?: { readonly url?: string } | null };
    readonly featuredImage?: string;
    readonly locationId?: string | null;
    readonly organizerId?: string | null;
    readonly description?: string;
}

/** Shape of a newsletter campaign item. */
interface CampaignItem {
    readonly id: string;
    readonly subject: string;
    readonly status: string;
    readonly scheduledAt?: string;
    /** ISO timestamp of when the campaign was sent; null/undefined when not yet sent. */
    readonly sentAt?: string | null;
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
 * + top 5 posts by engagement as companion list.
 *
 * Multi-KPI tile pattern (same shape HOST card A uses) so every number on
 * the card has an explicit label. The companion list ranks by an engagement
 * score (likes + comments + shares) — all three fields already live on the
 * post entity so no aggregation endpoint is required.
 *
 * Source ID: `'editor.posts.published-this-month'`
 * Scope: `'all'`
 * Endpoints (parallel):
 *   - GET /api/v1/admin/posts?status=ACTIVE&createdAfter={month-start}&pageSize=1
 *   - GET /api/v1/admin/posts?status=ACTIVE&pageSize=1
 *   - GET /api/v1/admin/posts?status=DRAFT&pageSize=1
 *   - GET /api/v1/admin/posts?status=ACTIVE&pageSize=50 (engagement pool)
 */
registerDataSource('editor.posts.published-this-month', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.posts.published-this-month', ctx),
    queryFn: async () => {
        const monthStart = currentMonthStart();
        const [thisMonthResult, totalPublishedResult, draftsResult, engagementPoolResult] =
            await Promise.all([
                fetchApi<AdminListApiResponse<PostItem>>({
                    path: `/api/v1/admin/posts?status=ACTIVE&createdAfter=${encodeURIComponent(monthStart)}&pageSize=1`
                }),
                fetchApi<AdminListApiResponse<PostItem>>({
                    path: '/api/v1/admin/posts?status=ACTIVE&pageSize=1'
                }),
                fetchApi<AdminListApiResponse<PostItem>>({
                    path: '/api/v1/admin/posts?status=DRAFT&pageSize=1'
                }),
                fetchApi<AdminListApiResponse<PostItem>>({
                    path: '/api/v1/admin/posts?status=ACTIVE&pageSize=50'
                })
            ]);

        const thisMonth = thisMonthResult.data.data?.pagination?.total ?? 0;
        const totalPublished = totalPublishedResult.data.data?.pagination?.total ?? 0;
        const draftTotal = draftsResult.data.data?.pagination?.total ?? 0;

        // Top 5 posts by engagement score (likes + comments + shares).
        // Aproximated client-side from a 50-row pool to avoid a new backend
        // aggregation endpoint; a dedicated `/admin/posts/top-engagement` is
        // a follow-up SPEC if the pool ever exceeds 50 active posts.
        const pool = engagementPoolResult.data.data?.items ?? [];
        const ranked = [...pool]
            .map((post) => ({
                post,
                score: (post.likes ?? 0) + (post.comments ?? 0) + (post.shares ?? 0)
            }))
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        const companionItems = ranked.map(({ post, score }) => ({
            key: post.id,
            label: post.title,
            meta: `${score} interacciones · ${post.likes ?? 0} ♥ ${post.comments ?? 0} 💬 ${post.shares ?? 0} ↗`,
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
            companionLabel: companionItems.length > 0 ? 'Top 5 por engagement' : undefined,
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
 * label instead of a single counter floating without context. A 4th tile
 * shows the open rate of the most recently sent campaign (SPEC-160 T-001).
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
 *
 * Open rate (SPEC-160 T-001):
 *   The 4th tile shows the open rate of the most recently SENT campaign.
 *   Resolution order:
 *   1. Fetch a pool of up to 10 SENT campaigns (campaignStatus=sent&pageSize=10,
 *      sorted by createdAt:desc — the only server-side sort the endpoint supports).
 *   2. Pick the one with the greatest `sentAt` value client-side.
 *      Rationale: `sentAt` is the semantically correct anchor for "last sent";
 *      `createdAt` and `sentAt` are usually close but may diverge for campaigns
 *      drafted well before they are dispatched. A pool of 10 is sufficient for
 *      day-to-day usage while keeping the payload tiny.
 *   3. Fetch its metrics (opened / delivered) and compute openRate = opened / delivered.
 *   The subscriber tiles are primary: if step 1-3 fails for any reason the
 *   three subscriber tiles still render and the open-rate tile shows `—`.
 *   - GET /api/v1/admin/newsletter/campaigns?campaignStatus=sent&pageSize=10
 *   - GET /api/v1/admin/newsletter/campaigns/{id}/metrics  (for the most recent)
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

        // ── Open rate (secondary) ────────────────────────────────────────────
        // Wrapped in try/catch so a failure here NEVER breaks the 3 primary
        // subscriber tiles above. On any error or missing data, openRateValue
        // stays undefined and the open-rate tile renders `—` (see below).
        let openRateValue: number | undefined;
        try {
            const campaignsResult = await fetchApi<AdminListApiResponse<CampaignItem>>({
                // Fetch a small pool of SENT campaigns sorted by createdAt:desc.
                // We then pick the one with the max `sentAt` client-side because
                // the API only supports createdAt sorting (not sentAt sorting).
                path: '/api/v1/admin/newsletter/campaigns?campaignStatus=sent&pageSize=10'
            });
            const sentCampaigns = campaignsResult.data.data?.items ?? [];
            if (sentCampaigns.length > 0) {
                // Pick the campaign with the greatest sentAt value. Fall back to
                // the first item (already newest-createdAt) if sentAt is absent.
                const latest = sentCampaigns.reduce<CampaignItem>((best, current) => {
                    const bestTime = best.sentAt ? new Date(best.sentAt).getTime() : 0;
                    const currentTime = current.sentAt ? new Date(current.sentAt).getTime() : 0;
                    return currentTime > bestTime ? current : best;
                }, sentCampaigns[0]);

                const metrics = await fetchCampaignMetrics(latest.id);
                // API already provides openRate (opened/delivered with 0 guard), but
                // we re-derive it from raw counts so the tile's computation is explicit
                // and not coupled to any future change in the service's computed field.
                openRateValue =
                    metrics.delivered > 0
                        ? Math.round((metrics.opened / metrics.delivered) * 100)
                        : 0;
            }
        } catch {
            // Non-critical: leave openRateValue undefined so the tile renders `—`.
            // Logging is intentionally skipped — dashboard data-sources are
            // fire-and-forget and logging on every background refresh would be noisy.
        }

        // ── KPI tiles ────────────────────────────────────────────────────────
        // Tile labels keep their full descriptive form; KpiWidget tiles in a
        // 1×1 card visually truncate but expose the complete text via a
        // native `title` tooltip on hover.
        //
        // The open-rate tile is ALWAYS appended so Card C consistently shows the
        // metric slot. `openRateValue` stays `undefined` when no campaign has
        // ever been sent OR when the secondary fetch failed; in both cases
        // KpiGridTile renders a neutral `—` (it checks `typeof value === 'number'`).
        // This satisfies AC-2 (neutral empty state instead of a percentage).
        const openRateTile = {
            key: 'openRate',
            label: { es: 'Tasa de apertura', en: 'Open rate', pt: 'Taxa de abertura' },
            // `undefined` → KpiGridTile renders '—' (empty state).
            value: openRateValue,
            accent: 'sky',
            icon: 'mail',
            unitSuffix: typeof openRateValue === 'number' ? '%' : undefined,
            href: '/marketing/newsletter/campaigns'
        };

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
                },
                openRateTile
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
        const [activeResult, draftResult, archivedResult] = await Promise.all([
            fetchApi<AdminListApiResponse<PostItem>>({
                path: '/api/v1/admin/posts?status=ACTIVE&pageSize=1'
            }),
            fetchApi<AdminListApiResponse<PostItem>>({
                path: '/api/v1/admin/posts?status=DRAFT&pageSize=1'
            }),
            fetchApi<AdminListApiResponse<PostItem>>({
                path: '/api/v1/admin/posts?status=ARCHIVED&pageSize=1'
            })
        ]);

        // Status distribution bar chart — three buckets (Publicados / Borradores
        // / Archivados). Replaces the previous monthly-trend variant which
        // collapsed to two visible Y-ticks when posts clustered in one month
        // and didn't tell the editor anything actionable at a glance.
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
 * EDITOR card F: events stats as a 6-tile mini grid.
 *
 * Row 1 of tiles: Total / Próximos / Destacados — overview counters.
 * Row 2 of tiles: Sin imagen / Sin location / Sin organizer — content
 * health proxies aggregated server-side via 3 count queries. Helps the
 * editor spot what to fix without having to scan the events list.
 *
 * Views per event and per-event favorites are PHASE 2 (cross-entity
 * view tracking — SPEC-159 — plus a new SPEC for event favorites).
 *
 * Source ID: `'editor.events.stats'`
 * Scope: `'all'`
 * Endpoints (4 parallel):
 *   - GET /api/v1/admin/events?pageSize=1                              (total)
 *   - GET /api/v1/admin/events?startDateAfter={now}&pageSize=1         (upcoming)
 *   - GET /api/v1/admin/events?isFeatured=true&pageSize=1              (featured)
 *   - GET /api/v1/admin/events?pageSize=100                            (pool for client-side missing-* counts)
 */
registerDataSource('editor.events.stats', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.events.stats', ctx),
    queryFn: async () => {
        const now = nowIso();
        // The admin events search schema doesn't expose `hasFeaturedImage`,
        // `hasLocation`, `hasOrganizer` filters yet, so the missing-* counts
        // are computed client-side from a 100-row pool (the AdminSearchBase
        // pageSize cap). A dedicated `/admin/events/health-stats` endpoint
        // is a follow-up SPEC if the catalog ever exceeds 100 events and
        // the approximation stops being acceptable.
        const [totalResult, upcomingResult, featuredResult, poolResult] = await Promise.all([
            fetchApi<AdminListApiResponse<EventItem>>({
                path: '/api/v1/admin/events?pageSize=1'
            }),
            fetchApi<AdminListApiResponse<EventItem>>({
                path: `/api/v1/admin/events?startDateAfter=${encodeURIComponent(now)}&pageSize=1`
            }),
            fetchApi<AdminListApiResponse<EventItem>>({
                path: '/api/v1/admin/events?isFeatured=true&pageSize=1'
            }),
            fetchApi<AdminListApiResponse<EventItem>>({
                path: '/api/v1/admin/events?pageSize=100'
            })
        ]);

        const total = totalResult.data.data?.pagination?.total ?? 0;
        const upcoming = upcomingResult.data.data?.pagination?.total ?? 0;
        const featured = featuredResult.data.data?.pagination?.total ?? 0;
        const pool = poolResult.data.data?.items ?? [];
        const missingImage = pool.filter((e) => !e.media?.featuredImage?.url).length;
        const missingLocation = pool.filter((e) => !e.locationId).length;
        const missingOrganizer = pool.filter((e) => !e.organizerId).length;

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
                },
                {
                    key: 'missingImage',
                    label: { es: 'Sin imagen', en: 'Missing image', pt: 'Sem imagem' },
                    value: missingImage,
                    accent: 'danger',
                    icon: 'shield',
                    href: '/catalogo/eventos'
                },
                {
                    key: 'missingLocation',
                    label: {
                        es: 'Sin ubicación',
                        en: 'Missing location',
                        pt: 'Sem localização'
                    },
                    value: missingLocation,
                    accent: 'danger',
                    icon: 'compass',
                    href: '/catalogo/eventos'
                },
                {
                    key: 'missingOrganizer',
                    label: {
                        es: 'Sin organizador',
                        en: 'Missing organizer',
                        pt: 'Sem organizador'
                    },
                    value: missingOrganizer,
                    accent: 'danger',
                    icon: 'user',
                    href: '/catalogo/eventos'
                }
            ]
        };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD — Últimos posts (NEW): top 5 published posts, most recent first
// ============================================================================

/**
 * EDITOR card: recently published posts (top 5 by publishedAt desc).
 *
 * Paired with `editor.events.upcoming` (card B) to give the editor a quick
 * read on the freshest content on both publish surfaces.
 *
 * Source ID: `'editor.posts.latest'`
 * Scope: `'all'`
 * Endpoint: GET /api/v1/admin/posts?status=ACTIVE&pageSize=5&sort=publishedAt:desc
 */
registerDataSource('editor.posts.latest', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.posts.latest', ctx),
    queryFn: async () => {
        const result = await fetchApi<AdminListApiResponse<PostItem>>({
            path: '/api/v1/admin/posts?status=ACTIVE&pageSize=5&sort=publishedAt:desc'
        });
        const items = result.data.data?.items ?? [];
        return items.map((post) => ({
            id: post.id,
            label: post.title,
            meta: post.publishedAt
                ? new Date(post.publishedAt).toLocaleDateString('es-AR')
                : post.updatedAt
                  ? new Date(post.updatedAt).toLocaleDateString('es-AR')
                  : undefined,
            badge: post.isNews ? 'novedad' : undefined,
            href: `/contenido/posts/${post.id}`
        }));
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD — Acciones (NEW): static list of editorial quick actions
// ============================================================================

/**
 * EDITOR card: editorial quick-action shortcuts.
 *
 * The shortcut widget type lives in the schema but has no implementation
 * (only a deferred-placeholder fallback in tests). We model the actions
 * as ListWidget items with `href`/`label`/`meta`, so the card uses an
 * already-shipped renderer and clicking each row navigates to the
 * matching create page.
 *
 * Source ID: `'editor.shortcuts'`
 * Scope: `'all'`
 * No network call — items are static.
 */
registerDataSource('editor.shortcuts', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.shortcuts', ctx),
    queryFn: async () => {
        return [
            {
                id: 'new-post',
                label: 'Crear post',
                meta: 'Nuevo artículo del blog',
                href: '/contenido/posts/new'
            },
            {
                id: 'new-event',
                label: 'Crear evento',
                meta: 'Próximo evento en agenda',
                href: '/catalogo/eventos/new'
            },
            {
                id: 'new-campaign',
                label: 'Nueva campaña',
                meta: 'Newsletter a suscriptores',
                href: '/marketing/newsletter/campaigns/new'
            },
            {
                id: 'media',
                label: 'Gestionar media',
                meta: 'Subir imágenes y videos',
                href: '/contenido/media'
            }
        ];
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD G — Salud del contenido (FIXED): combined posts + events for checks
// ============================================================================

/**
 * EDITOR card G-posts: per-post content health, top 10 worst-rated.
 *
 * Returns the `EntityHealthListData` shape: one row per entity (NOT one row
 * per missing field), each carrying its completeness percentage, the list
 * of missing labels as chips, and View/Edit hrefs. Sorted ascending by
 * completeness so the entries that need most love float to the top.
 *
 * Source ID: `'editor.content.health.posts'`
 * Scope: `'all'`
 * Endpoint: GET /api/v1/admin/posts?status=ACTIVE&pageSize=100 (pool)
 */
registerDataSource('editor.content.health.posts', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.content.health.posts', ctx),
    queryFn: async () => {
        const result = await fetchApi<AdminListApiResponse<PostItem>>({
            path: '/api/v1/admin/posts?status=ACTIVE&pageSize=100'
        });
        const pool = result.data.data?.items ?? [];

        const evaluated = pool.map((post) => {
            const missing: string[] = [];
            if (!post.featuredImage) missing.push('Imagen destacada');
            if (!post.tags || post.tags.length === 0) missing.push('Etiquetas');
            if (!post.seoTitle) missing.push('Metadata SEO');
            const totalChecks = 3;
            const doneChecks = totalChecks - missing.length;
            const completenessPct = Math.round((doneChecks / totalChecks) * 100);
            return {
                id: post.id,
                title: post.title,
                completenessPct,
                doneChecks,
                totalChecks,
                missingItems: missing,
                viewHref: `/contenido/posts/${post.id}`,
                editHref: `/contenido/posts/${post.id}/edit`
            };
        });

        const withIssues = [...evaluated]
            .filter((e) => e.missingItems.length > 0)
            .sort((a, b) => a.completenessPct - b.completenessPct);

        // Return the full sorted list — the widget shows the first 10
        // inline and exposes the rest via a "Ver todas" dialog so we don't
        // need a second round-trip when the user opens it.
        return {
            entities: withIssues,
            total: withIssues.length,
            poolSize: pool.length
        };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

/**
 * EDITOR card G-events: per-event content health, top 10 worst-rated.
 * Same `EntityHealthListData` shape as the posts variant.
 *
 * Source ID: `'editor.content.health.events'`
 * Scope: `'all'`
 * Endpoint: GET /api/v1/admin/events?pageSize=100 (pool)
 */
registerDataSource('editor.content.health.events', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.content.health.events', ctx),
    queryFn: async () => {
        const result = await fetchApi<AdminListApiResponse<EventItem>>({
            path: '/api/v1/admin/events?pageSize=100'
        });
        const pool = result.data.data?.items ?? [];

        const evaluated = pool.map((event) => {
            const missing: string[] = [];
            if (!event.media?.featuredImage?.url) missing.push('Imagen destacada');
            if (!event.locationId) missing.push('Ubicación');
            if (!event.organizerId) missing.push('Organizador');
            if (!event.description || event.description.trim().length === 0) {
                missing.push('Descripción');
            }
            const totalChecks = 4;
            const doneChecks = totalChecks - missing.length;
            const completenessPct = Math.round((doneChecks / totalChecks) * 100);
            return {
                id: event.id,
                title: event.name,
                completenessPct,
                doneChecks,
                totalChecks,
                missingItems: missing,
                viewHref: `/catalogo/eventos/${event.id}`,
                editHref: `/catalogo/eventos/${event.id}/edit`
            };
        });

        const withIssues = [...evaluated]
            .filter((e) => e.missingItems.length > 0)
            .sort((a, b) => a.completenessPct - b.completenessPct);

        return {
            entities: withIssues,
            total: withIssues.length,
            poolSize: pool.length
        };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD H — Recent comments (SPEC-165 T-016)
// ============================================================================

/**
 * Shape of a single item returned by GET /api/v1/admin/comments/recent.
 *
 * The endpoint wraps its payload in `ResponseFactory`, so the full JSON body
 * is `{ success, data: { data: RecentCommentItem[] } }`.
 */
export interface RecentCommentItem {
    readonly id: string;
    readonly entityType: 'POST' | 'EVENT';
    readonly entityId: string;
    readonly content: string;
    readonly authorName: string;
    readonly moderationState: 'APPROVED' | 'REJECTED' | 'PENDING';
    readonly createdAt: string;
}

/** fetchApi envelope for the recent-comments endpoint. */
interface RecentCommentsApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly data?: ReadonlyArray<RecentCommentItem>;
    };
}

/**
 * EDITOR card H: recent comments feed (top 10, newest first).
 *
 * Requires the user to hold POST_COMMENT_VIEW AND EVENT_COMMENT_VIEW — the
 * `onMissing: 'hide'` on the widget config hides the card when the resolver
 * returns empty, but the actual AND-gate check is performed inside
 * `CommentsFeedCard` (the widget renderer reads auth context directly).
 *
 * Source ID: `'editor.comments.recent'`
 * Scope: `'all'`
 * Endpoint: GET /api/v1/admin/comments/recent?pageSize=10
 */
registerDataSource('editor.comments.recent', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.comments.recent', ctx),
    queryFn: async () => {
        const result = await fetchApi<RecentCommentsApiResponse>({
            path: '/api/v1/admin/comments/recent?pageSize=10'
        });
        // The endpoint wraps the payload in ResponseFactory's double-data envelope:
        // fetchApi returns { data: <body>, status } where <body> is
        // { success, data: { data: RecentCommentItem[] } }.
        return result.data.data?.data ?? [];
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD E — Views per post (SPEC-197 T-014)
// ============================================================================

/** Shape of GET /api/v1/protected/views/posts response. */
interface PostViewStatsApiResponse {
    readonly success: boolean;
    readonly data?: ReadonlyArray<{
        readonly entityId: string;
        readonly unique: number;
        readonly total: number;
    }>;
}

/**
 * EDITOR card E — views slot: unique + total view counts per post.
 *
 * The widget maintains its own independent window state (default 30d). The
 * source resolver accepts a `window` parameter via extra context (not yet
 * in ResolverContext; for V1 the resolver fetches 30d as default and the
 * widget re-fetches with a different queryKey when the window changes).
 *
 * Requires the caller to pass the `entityIds` of the posts to query. The
 * source resolver fetches the latest 50 published posts and queries their
 * view stats, returning a per-post list sorted by total DESC.
 *
 * Source ID: `'editor.posts.views'`
 * Scope: `'all'`
 * Endpoints:
 *   - GET /api/v1/admin/posts?status=ACTIVE&pageSize=50&sort=publishedAt:desc  (post ids)
 *   - GET /api/v1/protected/views/posts?window=30d&entityIds=...               (view stats)
 *
 * @see SPEC-197 T-014, §3.2
 */
registerDataSource('editor.posts.views', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.posts.views', ctx),
    queryFn: async () => {
        // Step 1: get post IDs from the recent published posts pool.
        const postsResult = await fetchApi<AdminListApiResponse<PostItem>>({
            path: '/api/v1/admin/posts?status=ACTIVE&pageSize=50&sort=publishedAt:desc'
        });
        const posts = postsResult.data.data?.items ?? [];
        const postIds = posts.map((p) => p.id);

        if (postIds.length === 0) {
            return { items: [], window: '30d' as const };
        }

        // Step 2: fetch view stats for those post IDs.
        const params = new URLSearchParams({ window: '30d' });
        for (const id of postIds) {
            params.append('entityIds', id);
        }
        const viewsResult = await fetchApi<PostViewStatsApiResponse>({
            path: `/api/v1/protected/views/posts?${params}`
        });
        const viewItems = viewsResult.data.data ?? [];

        // Build a lookup by entityId for fast join.
        const viewMap = new Map(viewItems.map((v) => [v.entityId, v]));

        // Merge: one row per post; zero-fill when no views recorded.
        const items = posts.map((post) => {
            const stats = viewMap.get(post.id);
            return {
                entityId: post.id,
                name: post.title,
                unique: stats?.unique ?? 0,
                total: stats?.total ?? 0
            };
        });

        // Sort by total views DESC so top-performing posts float up.
        items.sort((a, b) => b.total - a.total);

        return { items, window: '30d' as const };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD F — Views per event (SPEC-197 T-014)
// ============================================================================

/** Shape of GET /api/v1/protected/views/events response. */
interface EventViewStatsApiResponse {
    readonly success: boolean;
    readonly data?: ReadonlyArray<{
        readonly entityId: string;
        readonly unique: number;
        readonly total: number;
    }>;
}

/**
 * EDITOR card F — views slot: unique + total view counts per event.
 *
 * Mirrors `editor.posts.views` but for the EVENT entity type. Maintains
 * independent window state (default 30d).
 *
 * Source ID: `'editor.events.views'`
 * Scope: `'all'`
 * Endpoints:
 *   - GET /api/v1/admin/events?pageSize=50  (event ids)
 *   - GET /api/v1/protected/views/events?window=30d&entityIds=...  (view stats)
 *
 * @see SPEC-197 T-014, §3.2
 */
registerDataSource('editor.events.views', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.events.views', ctx),
    queryFn: async () => {
        // Step 1: get event IDs from the recent events pool.
        const eventsResult = await fetchApi<AdminListApiResponse<EventItem>>({
            path: '/api/v1/admin/events?pageSize=50'
        });
        const events = eventsResult.data.data?.items ?? [];
        const eventIds = events.map((e) => e.id);

        if (eventIds.length === 0) {
            return { items: [], window: '30d' as const };
        }

        // Step 2: fetch view stats for those event IDs.
        const params = new URLSearchParams({ window: '30d' });
        for (const id of eventIds) {
            params.append('entityIds', id);
        }
        const viewsResult = await fetchApi<EventViewStatsApiResponse>({
            path: `/api/v1/protected/views/events?${params}`
        });
        const viewItems = viewsResult.data.data ?? [];

        const viewMap = new Map(viewItems.map((v) => [v.entityId, v]));

        const items = events.map((event) => {
            const stats = viewMap.get(event.id);
            return {
                entityId: event.id,
                name: event.name,
                unique: stats?.unique ?? 0,
                total: stats?.total ?? 0
            };
        });

        items.sort((a, b) => b.total - a.total);

        return { items, window: '30d' as const };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// NOTE — WHATS NEW RECENT (SPEC-175 T-016)
// ============================================================================
// `whats-new.recent` is registered in `./whats-new.ts` (imported via index.ts).
// Shared across all four roles — see apps/admin/src/lib/dashboard-sources/index.ts.
