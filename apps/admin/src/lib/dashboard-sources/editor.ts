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
 * EDITOR card G: feeds the ChecklistWidget with a mixed list of recent
 * posts and events so it can compute the `content-health` checkset.
 *
 * The widget's `computeItems` discriminator uses `'locationId' in entity`
 * to tell posts and events apart. We fetch 5 of each, mix into a single
 * array, and return it; the widget then iterates and produces health
 * items (missing featured image, missing SEO, missing organizer, etc).
 *
 * Source ID: `'editor.content.health'`
 * Scope: `'all'`
 * Endpoints (parallel):
 *   - GET /api/v1/admin/posts?status=ACTIVE&pageSize=5&sort=publishedAt:desc
 *   - GET /api/v1/admin/events?pageSize=5
 */
registerDataSource('editor.content.health', (ctx) => ({
    queryKey: buildDashboardQueryKey('editor.content.health', ctx),
    queryFn: async () => {
        const [postsResult, eventsResult] = await Promise.all([
            fetchApi<AdminListApiResponse<PostItem>>({
                path: '/api/v1/admin/posts?status=ACTIVE&pageSize=5&sort=publishedAt:desc'
            }),
            fetchApi<AdminListApiResponse<EventItem>>({
                path: '/api/v1/admin/events?pageSize=5'
            })
        ]);
        const posts = postsResult.data.data?.items ?? [];
        const events = eventsResult.data.data?.items ?? [];

        // Normalize each into the ChecklistEntity shape the widget expects.
        // Posts use `title`; events use `name` — the widget reads `entity.title`
        // for both labels, so we alias `event.name` to `title` on the event
        // entries. The `locationId` field is the discriminator that lets the
        // widget pick the events branch of the check function.
        const postEntities = posts.map((p) => ({
            id: p.id,
            title: p.title,
            featuredImage: p.featuredImage,
            tags: p.tags,
            seoTitle: p.seoTitle
        }));
        const eventEntities = events.map((e) => ({
            id: e.id,
            title: e.name,
            featuredImage: e.media?.featuredImage?.url ?? undefined,
            locationId: e.locationId ?? undefined,
            organizerId: e.organizerId ?? undefined,
            description: e.description
        }));

        return [...postEntities, ...eventEntities];
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// NOTE — deferred slots (NO resolver registration)
// ============================================================================
// Card H ('editor.comments.recent'): 🟡 PENDING — comment-listing endpoint
//   must be verified/built (EDITOR-Q1). Register here once the endpoint lands.
//
// Card C — open rate: 🔴 PHASE 2 (no email-open tracking). Deferred.
// Card E — views per post: 🔴 PHASE 2 (cross-entity view tracking).
// Card F — views per event: 🔴 PHASE 2 (cross-entity view tracking).
