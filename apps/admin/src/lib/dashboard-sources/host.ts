/**
 * HOST Dashboard Data-Source Registrations — T-018 (SPEC-155)
 *
 * Registers all data-source resolvers consumed by the HOST dashboard
 * ("Mi negocio", cards A–G). Each registration maps a `source` ID to a
 * TanStack Query options factory that the widget renderer (T-034) passes
 * directly to `useQuery`.
 *
 * ## Registered source IDs
 *
 * | Source ID                          | Card | Scope | Endpoint(s) |
 * |------------------------------------|------|-------|-------------|
 * | `host.accommodations.count`        | A    | own   | GET /api/v1/admin/accommodations?ownerId={uid}&pageSize=1 |
 * | `host.accommodations.drafts`       | A    | own   | GET /api/v1/admin/accommodations?ownerId={uid}&status=DRAFT&pageSize=5 |
 * | `host.billing.plan`                | B    | own   | GET /api/v1/protected/billing/subscriptions?pageSize=1 + GET /api/v1/protected/billing/usage |
 * | `host.conversations.pending`       | C    | own   | GET /api/v1/admin/conversations?ownerId={uid}&conversationStatus=PENDING_OWNER |
 * | `host.reviews.latest`              | E    | own   | GET /api/v1/admin/reviews?ownerId={uid}&pageSize=5&sort=created_at_desc |
 * | `host.stats.favorites`             | G    | own   | GET /api/v1/protected/accommodation/my/favorites-breakdown |
 * | `host.stats.response-rate`         | G    | own   | GET /api/v1/protected/conversations/me/response-rate |
 * | `host.stats.ratings`               | G    | own   | Derived from accommodation fields (averageRating, reviewsCount) |
 *
 * ## No-source slots (deferred / client-side)
 *
 * - **Card D** (`host.accommodations.health`): client-side checklist computed
 *   from the loaded accommodation object — no remote fetch. Handled by
 *   ChecklistWidget directly from entity data; no resolver registration needed.
 * - **Card F** (`host.profile.health`): same — client-side profile completeness
 *   checklist over the loaded user object.
 * - **Card G — views** (`host.stats.views`): 🔴 PHASE 2. Cross-entity view
 *   tracking not yet built (PostHog client-side only, no DB persistence).
 *   DeferredWidget handles these slots via `onMissing: 'hide'` in T-029.
 *
 * @module dashboard-sources/host
 * @see apps/admin/src/lib/dashboard-sources.ts — registry API
 * @see .claude/audit/admin-redesign/proposals/03c-dashboards-redefinition.md — HOST §
 * @see SPEC-155 T-018
 */

import { computeAccommodationHealth } from '@/components/dashboards/widgets/ChecklistWidget';
import { fetchApi } from '@/lib/api/client';
import {
    DASHBOARD_STALE_TIME_MS,
    buildDashboardQueryKey,
    registerDataSource
} from '@/lib/dashboard-sources';
import type { ResolverContext } from '@/lib/dashboard-sources';
import { ApiError } from '@/lib/errors';

// ============================================================================
// RESPONSE TYPE SHAPES
// ============================================================================

/** Minimal shape of the admin accommodation list API response. */
interface AccommodationListApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly data?: ReadonlyArray<{
            readonly id: string;
            readonly name: string;
            readonly status: string;
            readonly averageRating?: number;
            readonly reviewsCount?: number;
        }>;
        readonly pagination?: { readonly total?: number };
    };
}

/**
 * Shape of GET /api/v1/protected/users/me/subscription.
 *
 * Returns the FULL subscription record (planName + status + dates + price)
 * already null-friendly when billing is unavailable, so we don't have to
 * swallow 503s ourselves like with the lower-level qzpay-hono routes.
 */
interface UserSubscriptionApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly subscription: {
            readonly planSlug: string;
            readonly planName: string;
            readonly status: string;
            readonly currentPeriodStart: string | null;
            readonly currentPeriodEnd: string | null;
            readonly cancelAtPeriodEnd: boolean;
            readonly trialEndsAt: string | null;
            readonly monthlyPriceArs: number;
        } | null;
    };
}

/**
 * Shape of GET /api/v1/protected/billing/usage response.
 *
 * The endpoint returns a per-limit breakdown — one entry per LimitKey with
 * `currentUsage` + `maxAllowed`. We index it by `limitKey` so each card-B
 * tile can look up its own usage. The `upgradeUrl` is the canonical pricing
 * URL composed by the billing module (preferred over hand-rolled fallbacks).
 */
interface BillingUsageApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly customerId: string;
        readonly limits: ReadonlyArray<{
            readonly limitKey: string;
            readonly displayName: string;
            readonly currentUsage: number;
            readonly maxAllowed: number;
            readonly usagePercentage: number;
            readonly threshold: 'ok' | 'warning' | 'critical' | 'exceeded';
            readonly planBaseLimit: number;
            readonly addonBonusLimit: number;
        }>;
        readonly overallThreshold: 'ok' | 'warning' | 'critical' | 'exceeded';
        readonly upgradeUrl: string;
    };
}

/**
 * Shape of GET /api/v1/protected/users/me/entitlements.
 *
 * The endpoint surfaces the merged entitlement set + limit map + plan
 * context. We use the `limits` map to render per-plan quota tiles on
 * HOST card B and the `entitlements` array to surface plan-feature badges.
 */
interface EntitlementsApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly entitlements: ReadonlyArray<string>;
        readonly limits: Record<string, number>;
        readonly plan: {
            readonly slug: string;
            readonly name: string;
            readonly status: string;
        } | null;
        readonly asOf: string;
    };
}

/**
 * Curated mapping from `LimitKey` to a short Spanish label for the HOST
 * card B tile grid. Limit keys not in this map are skipped (we surface only
 * the consumer-facing quotas, not infrastructure-level limits).
 */
const HOST_LIMIT_LABELS: Readonly<Record<string, string>> = {
    max_accommodations: 'Alojamientos',
    max_photos_per_accommodation: 'Fotos / alojamiento',
    max_active_promotions: 'Promos activas',
    max_properties: 'Propiedades',
    max_staff_accounts: 'Cuentas staff'
};

/**
 * Curated mapping from `EntitlementKey` to a short Spanish label for the HOST
 * card B feature chips. Order matches the visual order in the card so highly-
 * valued features (statistics, promotions, branding) appear first. Keys NOT
 * in this map are not surfaced on the card — they would clutter the chip row
 * with infrastructure-level entitlements the host doesn't care about.
 */
const HOST_ENTITLEMENT_LABELS: ReadonlyArray<readonly [string, string]> = [
    ['featured_listing', 'Listado destacado'],
    ['view_advanced_stats', 'Estadísticas avanzadas'],
    ['create_promotions', 'Crear promociones'],
    ['can_use_rich_description', 'Descripción enriquecida'],
    ['can_embed_video', 'Videos en publicación'],
    ['can_use_calendar', 'Calendario'],
    ['can_sync_external_calendar', 'Sync calendario externo'],
    ['can_contact_whatsapp_direct', 'WhatsApp directo'],
    ['has_verification_badge', 'Badge verificación'],
    ['respond_reviews', 'Responder reseñas'],
    ['priority_support', 'Soporte prioritario'],
    ['dedicated_manager', 'Account manager'],
    ['custom_branding', 'Branding propio'],
    ['white_label', 'Marca blanca'],
    ['social_media_integration', 'Integración redes'],
    ['multi_property_management', 'Multi-propiedad'],
    ['consolidated_analytics', 'Analítica consolidada'],
    ['api_access', 'Acceso API']
];

/** Shape of GET /api/v1/admin/conversations list response. */
interface ConversationListApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly data?: ReadonlyArray<{
            readonly id: string;
            readonly guestName?: string;
            readonly updatedAt?: string;
        }>;
        readonly pagination?: { readonly total?: number };
    };
}

/** Shape of GET /api/v1/admin/reviews list response. */
interface ReviewListApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly data?: ReadonlyArray<{
            readonly id: string;
            readonly rating: number;
            readonly comment?: string;
            readonly createdAt?: string;
        }>;
        readonly pagination?: { readonly total?: number };
    };
}

/** Shape of GET /api/v1/protected/accommodation/my/favorites-breakdown response. */
interface FavoritesBreakdownApiResponse {
    readonly success: boolean;
    readonly data?: ReadonlyArray<{
        readonly accommodationId: string;
        readonly accommodationName?: string;
        readonly count: number;
    }>;
}

/** Shape of GET /api/v1/protected/conversations/me/response-rate response. */
interface ResponseRateApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly responseRatePercent?: number;
        readonly averageResponseTimeHours?: number;
        readonly totalInquiries?: number;
        readonly respondedCount?: number;
    };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Builds the query-string params to scope admin list endpoints to the HOST's
 * own entities. Appended to every admin endpoint that accepts `ownerId`.
 *
 * @param ctx - Resolver context supplying the authenticated user's ID.
 * @param extra - Additional query-string key/value pairs.
 * @returns A URLSearchParams instance ready to be stringified.
 */
function ownerParams(ctx: ResolverContext, extra: Record<string, string> = {}): URLSearchParams {
    return new URLSearchParams({ ownerId: ctx.userId, ...extra });
}

/**
 * Runs `fn` and swallows {@link ApiError} instances whose `status` is in the
 * `expected` allow-list, returning `fallback` instead. Any other error — a
 * real 500, a network failure, an unexpected 401 — re-throws so the widget's
 * `useQuery` surfaces it as an error state (NOT an empty state).
 *
 * Use only for known-degradable cases (e.g. 503 when an integration is
 * unavailable in local, 404 when an endpoint is not yet wired). Never use as
 * a blanket "make it stop failing" — the user has to be able to tell the
 * difference between a card with no data and a card that failed to load.
 *
 * @example
 * ```ts
 * const result = await swallowExpected(
 *   () => fetchApi<X>({ path: '/billing/usage' }),
 *   [503],
 *   null
 * );
 * ```
 */
async function swallowExpected<T, F>(
    fn: () => Promise<T>,
    expected: ReadonlyArray<number>,
    fallback: F
): Promise<T | F> {
    try {
        return await fn();
    } catch (err) {
        if (err instanceof ApiError && expected.includes(err.status)) {
            return fallback;
        }
        throw err;
    }
}

// ============================================================================
// CARD A — Mis alojamientos: count + drafts
// ============================================================================

/**
 * HOST card A: multi-KPI breakdown of own accommodations (Total / Activos /
 * Borradores) plus a companion list of draft listings.
 *
 * Fetches the total count and the first 5 drafts in parallel; derives the
 * active count as `total - drafts` (avoids a third roundtrip).
 *
 * Source ID: `'host.accommodations.count'`
 * Scope: `'own'` — requires `ownerId` filter.
 * Endpoints:
 *   - GET /api/v1/admin/accommodations?ownerId={uid}&pageSize=1
 *   - GET /api/v1/admin/accommodations?ownerId={uid}&status=DRAFT&pageSize=5
 */
registerDataSource('host.accommodations.count', (ctx) => ({
    queryKey: buildDashboardQueryKey('host.accommodations.count', ctx),
    queryFn: async () => {
        const totalParams = ownerParams(ctx, { pageSize: '1' });
        const draftListParams = ownerParams(ctx, { status: 'DRAFT', pageSize: '5' });

        const [totalResult, draftsResult] = await Promise.all([
            fetchApi<AccommodationListApiResponse>({
                path: `/api/v1/admin/accommodations?${totalParams}`
            }),
            fetchApi<AccommodationListApiResponse>({
                path: `/api/v1/admin/accommodations?${draftListParams}`
            })
        ]);

        const total = totalResult.data.data?.pagination?.total ?? 0;
        const draftTotal = draftsResult.data.data?.pagination?.total ?? 0;
        const draftItems = draftsResult.data.data?.data ?? [];
        const active = Math.max(0, total - draftTotal);

        // Companion list — first 5 drafts with edit links.
        const companionItems = draftItems.map((item) => ({
            key: item.id,
            label: item.name,
            href: `/accommodations/${item.id}/edit`
        }));

        // Multi-KPI grid: Total / Activos / Borradores. The KpiWidget renders
        // each tile with its own accent + icon when `kpis[]` is non-empty.
        return {
            kpis: [
                {
                    key: 'total',
                    label: { es: 'Total', en: 'Total', pt: 'Total' },
                    value: total,
                    accent: 'river',
                    icon: 'buildings',
                    href: '/accommodations'
                },
                {
                    key: 'active',
                    label: { es: 'Activos', en: 'Active', pt: 'Ativos' },
                    value: active,
                    accent: 'success',
                    icon: 'activity',
                    href: '/accommodations?status=ACTIVE'
                },
                {
                    key: 'drafts',
                    label: { es: 'Borradores', en: 'Drafts', pt: 'Rascunhos' },
                    value: draftTotal,
                    accent: 'warning',
                    icon: 'article',
                    href: '/accommodations?status=DRAFT'
                }
            ],
            companionLabel: draftTotal > 0 ? 'Borradores sin publicar' : undefined,
            companionItems
        };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

/**
 * HOST card A (companion): list of own DRAFT accommodations with publish link.
 *
 * Source ID: `'host.accommodations.drafts'`
 * Scope: `'own'` — scoped to this host's unpublished listings.
 * Endpoint: GET /api/v1/admin/accommodations?ownerId={uid}&status=DRAFT&pageSize=5
 */
registerDataSource('host.accommodations.drafts', (ctx) => ({
    queryKey: buildDashboardQueryKey('host.accommodations.drafts', ctx),
    queryFn: async () => {
        const params = ownerParams(ctx, { status: 'DRAFT', pageSize: '5' });
        const result = await fetchApi<AccommodationListApiResponse>({
            path: `/api/v1/admin/accommodations?${params}`
        });
        const items = result.data.data?.data ?? [];
        // Normalize to ListItem[] shape expected by ListWidget (companion list).
        return items.map((item) => ({
            id: item.id,
            label: item.name,
            meta: 'Borrador',
            href: `/catalogo/alojamientos/${item.id}`
        }));
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD B — Mi plan: billing subscription + usage
// ============================================================================

/**
 * HOST card B: unified billing plan widget data.
 *
 * Fetches the active subscription and usage in parallel. The widget renderer
 * (T-023+) is responsible for combining both into the card display.
 *
 * Source ID: `'host.billing.plan'`
 * Scope: `'own'` — always fetches for the current authenticated user.
 * Endpoints:
 *   - GET /api/v1/protected/billing/subscriptions?pageSize=1
 *   - GET /api/v1/protected/billing/usage
 */
registerDataSource('host.billing.plan', (ctx) => ({
    queryKey: buildDashboardQueryKey('host.billing.plan', ctx),
    queryFn: async () => {
        // Uses the higher-level `/me/subscription` route which returns
        // `{ subscription: null }` instead of 503 when the billing client is
        // unavailable, AND carries a richer shape (planName, prettified status,
        // monthly price). Usage + entitlements are best-effort — fall through
        // when the qzpay-hono routes 503.
        const [subResult, usageResult, entResult] = await Promise.all([
            fetchApi<UserSubscriptionApiResponse>({
                path: '/api/v1/protected/users/me/subscription'
            }),
            swallowExpected(
                () =>
                    fetchApi<BillingUsageApiResponse>({
                        path: '/api/v1/protected/billing/usage'
                    }),
                [503],
                null
            ),
            swallowExpected(
                () =>
                    fetchApi<EntitlementsApiResponse>({
                        path: '/api/v1/protected/users/me/entitlements'
                    }),
                [503],
                null
            )
        ]);

        const subscription = subResult.data.data?.subscription ?? null;
        const usageSummary = usageResult?.data.data ?? null;
        const entitlementsData = entResult?.data.data ?? null;

        // Build a {limitKey → currentUsage} index from the usage breakdown so
        // each tile can look up its own usage in O(1).
        const usageByLimit: Record<string, number> = {};
        for (const row of usageSummary?.limits ?? []) {
            usageByLimit[row.limitKey] = row.currentUsage;
        }

        // No active subscription anywhere — render the contextual empty state
        // ("Todavía no tenés un plan…") via the widget.
        if (!subscription) {
            return null;
        }

        // Map subscription status to the StatusWidget variantMap keys.
        // The `/me/subscription` endpoint normalises QZPay statuses to a
        // canonical enum (active / trial / cancelled / expired / past_due /
        // pending / paused). We promote `active` near its renewal to
        // `expiring` so the badge band swaps to amber as a courtesy.
        let status = subscription.status;
        if (status === 'active' && subscription.currentPeriodEnd) {
            const daysUntilExpiry =
                (new Date(subscription.currentPeriodEnd).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24);
            if (daysUntilExpiry <= 7) {
                status = 'expiring';
            }
        }

        // The legacy `usage` sub-block (big bar) is no longer emitted — the
        // per-tile bars below subsume it. Resolver keeps the field undefined.
        const usageBlock = undefined;

        // Trial subscriptions surface their countdown ("Quedan N días"); active
        // ones surface the next-charge date instead. Cancelled / expired plans
        // expose neither so the card collapses to the badge.
        const trialEndsAt =
            subscription.status === 'trial'
                ? (subscription.trialEndsAt ?? subscription.currentPeriodEnd ?? undefined)
                : undefined;
        const nextChargeDate =
            status === 'active' || status === 'expiring'
                ? (subscription.currentPeriodEnd ?? undefined)
                : undefined;

        // Plan quotas (HOST card B redesign) — surface only the curated set so
        // we don't dump every internal limit key on the card. Each tile shows
        // the limit key's short label + numeric cap + (when available)
        // current usage from the per-limit usage breakdown.
        const limitMap = entitlementsData?.limits ?? {};
        const limitTiles: Array<{
            key: string;
            label: string;
            value: number;
            used?: number;
        }> = [];
        for (const [key, label] of Object.entries(HOST_LIMIT_LABELS)) {
            const value = limitMap[key];
            if (typeof value !== 'number') continue;
            const tile: { key: string; label: string; value: number; used?: number } = {
                key,
                label,
                value
            };
            if (typeof usageByLimit[key] === 'number') {
                tile.used = usageByLimit[key];
            }
            limitTiles.push(tile);
        }

        // Feature chips (HOST card B redesign) — for each curated entitlement
        // key, surface a chip iff the host's active entitlement set contains
        // it. Preserves the curated ORDER so the most valuable features
        // (stats, promotions, branding) read first.
        const enabledEntitlements = new Set(entitlementsData?.entitlements ?? []);
        const featureChips: Array<{ key: string; label: string }> = [];
        for (const [key, label] of HOST_ENTITLEMENT_LABELS) {
            if (enabledEntitlements.has(key)) {
                featureChips.push({ key, label });
            }
        }

        // Upgrade CTA — prefer the canonical URL emitted by the billing
        // module (`upgradeUrl` on the usage summary); fall back to
        // VITE_SITE_URL + `/es/suscriptores/planes` so admin (a different
        // origin) still links to the public pricing page when billing is
        // unavailable.
        const siteUrl = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '');
        const upgradeHref =
            usageSummary?.upgradeUrl ?? (siteUrl ? `${siteUrl}/es/suscriptores/planes` : undefined);

        return {
            status,
            label: subscription.planName,
            usage: usageBlock,
            nextChargeDate,
            trialEndsAt,
            limitTiles: limitTiles.length > 0 ? limitTiles : undefined,
            featureChips: featureChips.length > 0 ? featureChips : undefined,
            upgradeHref
        };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD C — Consultas: pending inquiries KPI + list
// ============================================================================

/**
 * HOST card C: pending conversations (inquiries) count and top-5 list.
 *
 * Source ID: `'host.conversations.pending'`
 * Scope: `'own'` — filters by the current host's ownerId.
 * Endpoints:
 *   - GET /api/v1/admin/conversations?ownerId={uid}&conversationStatus=PENDING_OWNER&pageSize=1  (count)
 *   - GET /api/v1/admin/conversations?ownerId={uid}&conversationStatus=PENDING_OWNER&pageSize=5&sort=updated_at_desc  (list)
 */
registerDataSource('host.conversations.pending', (ctx) => ({
    queryKey: buildDashboardQueryKey('host.conversations.pending', ctx),
    queryFn: async () => {
        // The admin/conversations list endpoint rejects `sort=updated_at_desc`
        // (400) — its admin-search schema expects the camelCase + colon form
        // (e.g. `updatedAt:desc`). Stick to that.
        const baseParams = ownerParams(ctx, { conversationStatus: 'PENDING_OWNER' });
        const countParams = new URLSearchParams(baseParams);
        countParams.set('pageSize', '1');
        const listParams = new URLSearchParams(baseParams);
        listParams.set('pageSize', '5');
        listParams.set('sort', 'updatedAt:desc');

        // No catch — with the sort fix any remaining failure is a real backend
        // error that should surface as an error state, not be hidden as empty.
        const [countResult, listResult] = await Promise.all([
            fetchApi<ConversationListApiResponse>({
                path: `/api/v1/admin/conversations?${countParams}`
            }),
            fetchApi<ConversationListApiResponse>({
                path: `/api/v1/admin/conversations?${listParams}`
            })
        ]);

        const pendingCount = countResult.data.data?.pagination?.total ?? 0;
        const rawItems = listResult.data.data?.data ?? [];

        // Normalize to ListItem[] shape expected by ListWidget.
        // The widget is type 'list' — return a flat array of items.
        // Surface the pending count as a badge on the first item if present.
        return rawItems.map((item, idx) => ({
            id: item.id,
            label: item.guestName ?? `Consulta ${idx + 1}`,
            meta: item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('es-AR') : undefined,
            badge: idx === 0 && pendingCount > 0 ? String(pendingCount) : undefined
        }));
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD E — Reseñas: latest reviews
// ============================================================================

/**
 * HOST card E: latest reviews received for own accommodations (read-only list).
 *
 * Requires `REVIEW_VIEW_OWN` permission (held by HOST role per seed).
 *
 * Source ID: `'host.reviews.latest'`
 * Scope: `'own'` — scoped to reviews for this host's listings.
 * Endpoint: GET /api/v1/admin/reviews?ownerId={uid}&pageSize=5&sort=created_at_desc
 */
registerDataSource('host.reviews.latest', (ctx) => ({
    queryKey: buildDashboardQueryKey('host.reviews.latest', ctx),
    queryFn: async () => {
        // 404 means the admin/reviews route is not yet registered on this
        // environment — treat as "no reviews" so the contextual empty state
        // surfaces. Other failures re-throw to a real error state.
        const params = ownerParams(ctx, { pageSize: '5', sort: 'createdAt:desc' });
        const result = await swallowExpected(
            () =>
                fetchApi<ReviewListApiResponse>({
                    path: `/api/v1/admin/reviews?${params}`
                }),
            [404],
            null
        );
        const reviews = result?.data.data?.data ?? [];
        // Normalize to ListItem[] shape expected by ListWidget.
        return reviews.map((review) => ({
            id: review.id,
            label: review.comment ? review.comment.slice(0, 80) : 'Reseña sin comentario',
            meta: review.createdAt
                ? new Date(review.createdAt).toLocaleDateString('es-AR')
                : undefined,
            badge: review.rating !== undefined ? String(review.rating) : undefined
        }));
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD G — Estadísticas: favorites breakdown + response rate + ratings
// ============================================================================

/**
 * HOST card G: per-accommodation favorites count breakdown.
 *
 * Uses the protected route scoped to the host (returns only listings owned by
 * the current authenticated user). DB unchanged — `countBookmarksForEntity()`
 * already exists; this is the route that aggregates it per listing.
 *
 * Source ID: `'host.stats.favorites'`
 * Scope: `'own'` — the protected endpoint is implicitly user-scoped.
 * Endpoint: GET /api/v1/protected/accommodation/my/favorites-breakdown
 */
registerDataSource('host.stats.favorites', (ctx) => ({
    queryKey: buildDashboardQueryKey('host.stats.favorites', ctx),
    queryFn: async () => {
        const result = await fetchApi<FavoritesBreakdownApiResponse>({
            path: '/api/v1/protected/accommodation/my/favorites-breakdown'
        });
        return result.data.data ?? [];
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

/**
 * HOST card G: response rate (% answered + average response time).
 *
 * Aggregation over `conversations` using `firstGuestMessageAt`/`firstOwnerReplyAt`.
 * No DB change — the aggregation service and route were added in the Phase 1 backend.
 *
 * Source ID: `'host.stats.response-rate'`
 * Scope: `'own'` — the protected endpoint is implicitly user-scoped.
 * Endpoint: GET /api/v1/protected/conversations/me/response-rate
 */
registerDataSource('host.stats.response-rate', (ctx) => ({
    queryKey: buildDashboardQueryKey('host.stats.response-rate', ctx),
    queryFn: async () => {
        const result = await fetchApi<ResponseRateApiResponse>({
            path: '/api/v1/protected/conversations/me/response-rate'
        });
        return result.data.data ?? null;
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

/**
 * HOST card G: average rating + total reviews from own accommodations.
 *
 * Both fields (`averageRating`, `reviewsCount`) are already persisted on the
 * accommodation row — no aggregation needed. We fetch the host's own listings
 * and return the fields for the renderer to aggregate/display.
 *
 * Source ID: `'host.stats.ratings'`
 * Scope: `'own'` — scoped to the host's own accommodations.
 * Endpoint: GET /api/v1/admin/accommodations?ownerId={uid}&pageSize=50
 */
registerDataSource('host.stats.ratings', (ctx) => ({
    queryKey: buildDashboardQueryKey('host.stats.ratings', ctx),
    queryFn: async () => {
        const params = ownerParams(ctx, { pageSize: '50' });

        // HOST card G — multi-KPI tile fan-out: ratings + favorites + response.
        // We fetch the three companion sources in parallel and return a single
        // multi-KPI KpiData so the widget can render everything in one card.
        // Primary listings call re-throws on failure (it drives the whole card);
        // companion endpoints swallow 404 only (route may not be wired yet) so
        // partial data still renders meaningful tiles.
        const [listingsResult, favoritesResult, responseResult] = await Promise.all([
            fetchApi<AccommodationListApiResponse>({
                path: `/api/v1/admin/accommodations?${params}`
            }),
            swallowExpected(
                () =>
                    fetchApi<FavoritesBreakdownApiResponse>({
                        path: '/api/v1/protected/accommodation/my/favorites-breakdown'
                    }),
                [404],
                null
            ),
            swallowExpected(
                () =>
                    fetchApi<ResponseRateApiResponse>({
                        path: '/api/v1/protected/conversations/me/response-rate'
                    }),
                [404],
                null
            )
        ]);

        const listings = listingsResult.data.data?.data ?? [];
        const totalReviews = listings.reduce((sum, l) => sum + (l.reviewsCount ?? 0), 0);

        // Weighted average rating across listings (only those with ≥1 review).
        const ratedListings = listings.filter(
            (l) => typeof l.averageRating === 'number' && (l.reviewsCount ?? 0) > 0
        );
        const ratingSum = ratedListings.reduce(
            (sum, l) => sum + (l.averageRating ?? 0) * (l.reviewsCount ?? 0),
            0
        );
        const avgRating = totalReviews > 0 ? ratingSum / totalReviews : 0;
        const avgRatingRounded = Math.round(avgRating * 10) / 10;

        // Favorites — total + per-accommodation breakdown for the companion list.
        const favorites = favoritesResult?.data.data ?? [];
        const totalFavorites = favorites.reduce((sum, f) => sum + (f.count ?? 0), 0);

        // Response stats — fall back to undefined when the endpoint is unavailable.
        const responseStats = responseResult?.data.data ?? null;
        const responseRatePct =
            typeof responseStats?.responseRatePercent === 'number'
                ? Math.round(responseStats.responseRatePercent)
                : null;

        // Companion list — top 3 accommodations by favorites count.
        const companionItems = [...favorites]
            .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
            .slice(0, 3)
            .map((f) => ({
                key: f.accommodationId,
                label: f.accommodationName ?? `Alojamiento ${f.accommodationId.slice(0, 6)}`,
                badge: f.count
            }));

        // Extra response stats already in the same payload — surface them so
        // the host can see context for the response-rate tile (a 50% rate
        // over 200 inquiries reads very differently from 50% over 4).
        const avgResponseHours =
            typeof responseStats?.averageResponseTimeHours === 'number'
                ? Math.round(responseStats.averageResponseTimeHours * 10) / 10
                : null;
        const totalInquiries =
            typeof responseStats?.totalInquiries === 'number' ? responseStats.totalInquiries : 0;

        return {
            kpis: [
                {
                    key: 'rating',
                    label: { es: 'Rating', en: 'Rating', pt: 'Rating' },
                    value: avgRatingRounded,
                    accent: 'terracotta',
                    icon: 'star',
                    unitSuffix: ` (${totalReviews})`
                },
                {
                    key: 'favorites',
                    label: { es: 'Favoritos', en: 'Favorites', pt: 'Favoritos' },
                    value: totalFavorites,
                    accent: 'rose',
                    icon: 'star'
                },
                {
                    key: 'response',
                    label: {
                        es: 'Tasa de respuesta',
                        en: 'Response rate',
                        pt: 'Taxa de resposta'
                    },
                    value: responseRatePct ?? 0,
                    accent: 'sky',
                    icon: 'chat',
                    unitSuffix: '%'
                },
                {
                    key: 'response-time',
                    label: {
                        es: 'Tiempo de respuesta',
                        en: 'Response time',
                        pt: 'Tempo de resposta'
                    },
                    value: avgResponseHours ?? 0,
                    accent: 'teal',
                    icon: 'clock',
                    unitSuffix: ' h'
                },
                {
                    key: 'inquiries-total',
                    label: {
                        es: 'Consultas recibidas',
                        en: 'Inquiries received',
                        pt: 'Consultas recebidas'
                    },
                    value: totalInquiries,
                    accent: 'accent',
                    icon: 'chat'
                }
            ],
            companionLabel: companionItems.length > 0 ? 'Más favoritos' : undefined,
            companionItems
        };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD D — Estado de mi alojamiento: full accommodation entities
// ============================================================================

/**
 * Minimal shape of the admin accommodation full record needed for the
 * accommodation-health checklist (photos / description / amenities /
 * price / location / contact).
 */
interface AccommodationFullApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly data?: ReadonlyArray<{
            readonly id: string;
            readonly name: string;
            readonly photos?: ReadonlyArray<unknown>;
            readonly description?: string | null;
            readonly amenities?: ReadonlyArray<unknown>;
            readonly price?: number | null;
            readonly latitude?: number | null;
            readonly longitude?: number | null;
            readonly contactPhone?: string | null;
            readonly contactEmail?: string | null;
        }>;
    };
}

/**
 * HOST card D: full accommodation records for the completeness checklist.
 *
 * The ChecklistWidget consumes an array of `AccommodationEntity` objects with
 * the fields it inspects (photos / description / amenities / price / lat-lng /
 * contact). We hit the admin list endpoint scoped to the host's own listings.
 *
 * Source ID: `'host.accommodations.entities'`
 * Scope: `'own'` — requires `ownerId` filter.
 * Endpoint: GET /api/v1/admin/accommodations?ownerId={uid}&pageSize=20
 */
registerDataSource('host.accommodations.entities', (ctx) => ({
    queryKey: buildDashboardQueryKey('host.accommodations.entities', ctx),
    queryFn: async () => {
        const params = ownerParams(ctx, { pageSize: '20' });
        const result = await fetchApi<AccommodationFullApiResponse>({
            path: `/api/v1/admin/accommodations?${params}`
        });
        return result.data.data?.data ?? [];
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD F — Mi perfil: current user record
// ============================================================================

/**
 * Minimal shape of the admin user-by-id response needed for the
 * host-profile-health checklist (full name / avatar / bio / phone / social /
 * verified email).
 */
interface UserGetByIdApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly id: string;
        readonly name?: string;
        readonly displayName?: string;
        readonly avatarUrl?: string;
        readonly bio?: string;
        readonly phone?: string;
        readonly socialLink?: string;
        readonly emailVerified?: boolean;
    };
}

/**
 * HOST card F: current host's user record for the profile-health checklist.
 *
 * The ChecklistWidget computes profile completeness over the fields the
 * `host-profile-health` checkset expects (name / avatar / bio / phone /
 * socialLink / emailVerified). We fetch the authenticated user by id via
 * the PROTECTED tier — `UserService._canView()` allows reading one's own
 * record without `USER_READ_ALL` (which HOST doesn't have).
 *
 * Source ID: `'host.profile.current'`
 * Scope: `'own'` — always fetches the current actor's own user record.
 * Endpoint: GET /api/v1/protected/users/{ctx.userId}
 */
registerDataSource('host.profile.current', (ctx) => ({
    queryKey: buildDashboardQueryKey('host.profile.current', ctx),
    queryFn: async () => {
        const result = await fetchApi<UserGetByIdApiResponse>({
            path: `/api/v1/protected/users/${ctx.userId}`
        });
        const user = result.data.data;
        if (!user) return null;
        // ChecklistWidget reads an entity array — wrap in [user] for the
        // host-profile checkset.
        return [
            {
                id: user.id,
                name: user.displayName ?? user.name ?? '',
                avatarUrl: user.avatarUrl ?? '',
                bio: user.bio ?? '',
                phone: user.phone ?? '',
                socialLink: user.socialLink ?? '',
                emailVerified: user.emailVerified ?? false
            }
        ];
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// CARD H — Próximos pasos: actionable suggestions composed client-side
// ============================================================================

/**
 * One suggestion row surfaced on HOST card H. Each row maps to a single
 * actionable item the host can do RIGHT NOW (respond inquiry, complete a
 * listing, react to a bad review, etc.).
 */
interface SuggestionItem {
    /** Stable row id for React. */
    readonly id: string;
    /** Sort weight (lower = more urgent). */
    readonly priority: number;
    /** Card-facing label. */
    readonly label: string;
    /** Optional secondary text. */
    readonly meta?: string;
    /** Internal route the row navigates to. */
    readonly href: string;
}

/**
 * HOST card H: "Próximos pasos" — a curated, priority-sorted list of
 * actionable items the host should tackle next.
 *
 * Sources composed in parallel:
 *  1. Subscription endpoint    → "Tu plan vence el dd MMM" when ≤ 7 days.
 *  2. Reviews list             → negative reviews (≤3⭐) flagged for reply.
 *  3. Conversations pending    → inquiries older than 24h.
 *  4. Accommodation entities   → listings with completeness < 80%.
 *
 * Each source feeds rows tagged with a priority weight; lower weight = higher
 * urgency. After concatenation we sort + slice to the top 5 so the card never
 * overwhelms the host.
 *
 * Source ID: `'host.suggestions.list'`
 * Scope: `'own'` — all underlying queries are owner-scoped.
 */
registerDataSource('host.suggestions.list', (ctx) => ({
    queryKey: buildDashboardQueryKey('host.suggestions.list', ctx),
    queryFn: async () => {
        const params = ownerParams(ctx, { pageSize: '20' });
        const convoParams = ownerParams(ctx, {
            conversationStatus: 'PENDING_OWNER',
            pageSize: '20',
            sort: 'updatedAt:desc'
        });
        const reviewParams = ownerParams(ctx, { pageSize: '20', sort: 'createdAt:desc' });

        // Fan-out fetches. Reviews / subscription / accommodations / convos
        // all degrade gracefully — a single failed source must not blank the
        // card; the remaining suggestions still surface.
        const [accommodationsResult, conversationsResult, reviewsResult, subResult] =
            await Promise.all([
                fetchApi<AccommodationFullApiResponse>({
                    path: `/api/v1/admin/accommodations?${params}`
                }).catch(() => null),
                fetchApi<ConversationListApiResponse>({
                    path: `/api/v1/admin/conversations?${convoParams}`
                }).catch(() => null),
                swallowExpected(
                    () =>
                        fetchApi<ReviewListApiResponse>({
                            path: `/api/v1/admin/reviews?${reviewParams}`
                        }),
                    [404],
                    null
                ),
                fetchApi<UserSubscriptionApiResponse>({
                    path: '/api/v1/protected/users/me/subscription'
                }).catch(() => null)
            ]);

        const suggestions: SuggestionItem[] = [];
        const nowMs = Date.now();
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;

        // 1. Subscription expiring soon (priority 10 — highest).
        const subscription = subResult?.data.data?.subscription ?? null;
        if (subscription?.currentPeriodEnd && subscription.status === 'active') {
            const expiry = new Date(subscription.currentPeriodEnd).getTime();
            const daysLeft = Math.ceil((expiry - nowMs) / ONE_DAY_MS);
            if (daysLeft > 0 && expiry - nowMs <= SEVEN_DAYS_MS) {
                suggestions.push({
                    id: 'sub-expiry',
                    priority: 10,
                    label:
                        daysLeft === 1
                            ? 'Tu plan vence mañana'
                            : `Tu plan vence en ${daysLeft} días`,
                    meta: 'Renovalo para que tus alojamientos no se pausen.',
                    href: '/billing/subscriptions'
                });
            }
        }

        // 2. Negative reviews (≤ 3★) — priority 20. Reputation damage compounds
        //    every day they sit unanswered.
        const reviews = reviewsResult?.data.data?.data ?? [];
        for (const review of reviews) {
            if (review.rating <= 3) {
                suggestions.push({
                    id: `review-${review.id}`,
                    priority: 20,
                    label: `Reseña baja (${review.rating}★) sin responder`,
                    meta: review.comment ? review.comment.slice(0, 60) : undefined,
                    href: `/reviews/${review.id}`
                });
            }
        }

        // 3. Inquiries older than 24h — priority 30.
        const conversations = conversationsResult?.data.data?.data ?? [];
        for (const convo of conversations) {
            if (!convo.updatedAt) continue;
            const ageMs = nowMs - new Date(convo.updatedAt).getTime();
            if (ageMs > ONE_DAY_MS) {
                const hours = Math.floor(ageMs / (60 * 60 * 1000));
                suggestions.push({
                    id: `convo-${convo.id}`,
                    priority: 30,
                    label: `Respondé a ${convo.guestName ?? 'consulta pendiente'}`,
                    meta: `${hours} h sin respuesta`,
                    href: `/consultas/${convo.id}`
                });
            }
        }

        // 4. Accommodations with completeness < 80% — priority 40. Lazy import
        //    of the same compute function the ChecklistWidget uses so the
        //    suggestion stays in sync with what the card D status reflects.
        const accommodations = accommodationsResult?.data.data?.data ?? [];
        for (const acc of accommodations) {
            const items = computeAccommodationHealth(acc);
            const done = items.filter((i) => i.done).length;
            const total = items.length;
            const pct = total === 0 ? 0 : Math.round((done / total) * 100);
            if (pct < 80) {
                suggestions.push({
                    id: `acc-${acc.id}`,
                    priority: 40,
                    label: `Completá "${acc.name}"`,
                    meta: `${pct}% listo — ${total - done} datos faltantes`,
                    href: `/accommodations/${acc.id}/edit`
                });
            }
        }

        // Sort by priority ascending, cap at 5 so the card stays scannable.
        return suggestions
            .sort((a, b) => a.priority - b.priority)
            .slice(0, 5)
            .map((s) => ({
                id: s.id,
                label: s.label,
                meta: s.meta,
                href: s.href
            }));
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

// ============================================================================
// NOTE — deferred phase-2 slots
// ============================================================================
// Card G — views ('host.stats.views'): PHASE 2. Cross-entity view tracking
//   not yet built (PostHog fires client-side; nothing persisted in our DB).
//   DeferredWidget handles this slot; T-029 sets onMissing: 'hide'.
