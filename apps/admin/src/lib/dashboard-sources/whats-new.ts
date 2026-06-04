/**
 * What's New Dashboard Data-Source Registration — SPEC-175 T-016
 *
 * Registers the `whats-new.recent` source that backs the "Últimas novedades"
 * list widget on ALL FOUR role dashboards (HOST, EDITOR, ADMIN, SUPER_ADMIN).
 *
 * This source is centralised here rather than duplicated across the four
 * per-role source files because `registerDataSource` throws on duplicate
 * source IDs in DEV mode. All four role files point here (via a comment) and
 * the barrel `index.ts` imports this module as a side effect.
 *
 * ## Source ID: `'whats-new.recent'`
 *
 * ## Endpoint: GET /api/v1/protected/whats-new
 *
 * Returns the authenticated user's role-filtered, locale-resolved What's New
 * entries sorted newest-first. `unseenCount` is included but unused here —
 * the source maps only to the `ListItem[]` shape expected by `ListWidget`.
 *
 * ## Query key: `['dashboard', 'whats-new.recent', role, userId, scope]`
 *
 * Distinct from `useWhatsNew()`'s `['whats-new', userId]` key so both caches
 * are independent. The mark-seen mutation in `use-whats-new.ts` also
 * invalidates this key (see `onSettled`) so the dashboard card refreshes after
 * marking an entry as seen — keeping the badge count and card in sync.
 *
 * ## Mapping
 *
 * | WhatsNewItem field | ListItem field      | Notes                              |
 * |--------------------|---------------------|------------------------------------|
 * | `id`               | `id`                | Stable; used for onItemClick       |
 * | `title`            | `label`             | Locale-resolved by the server      |
 * | `publishedAt`      | `meta`              | Formatted dd/mm/yyyy (local TZ)    |
 * | `seen === false`   | `statusBadge`       | `{ label: 'Nuevo', variant: 'success' }` |
 * | `seen === true`    | `statusBadge`       | `undefined` (no badge shown)       |
 *
 * @module dashboard-sources/whats-new
 * @see apps/admin/src/lib/dashboard-sources.ts — registry API
 * @see apps/admin/src/hooks/use-whats-new.ts  — badge/panel/modal hook
 * @see SPEC-175 T-016
 */

import { fetchApi } from '@/lib/api/client';
import {
    DASHBOARD_STALE_TIME_MS,
    buildDashboardQueryKey,
    registerDataSource
} from '@/lib/dashboard-sources';

// ============================================================================
// RESPONSE TYPE
// ============================================================================

/**
 * Minimal envelope for GET /api/v1/protected/whats-new.
 *
 * We only need `id`, `publishedAt`, `title`, and `seen` for the card mapping.
 * The full schema is defined in `@repo/schemas` as `WhatsNewGetResponse` but
 * importing it here would couple the dashboard source to the schema package —
 * acceptable, but the local interface keeps the dependency graph flatter.
 */
interface WhatsNewApiEnvelope {
    readonly success: boolean;
    readonly data: {
        readonly items: ReadonlyArray<{
            /** Stable kebab-case entry identifier. */
            readonly id: string;
            /** ISO 8601 datetime string. */
            readonly publishedAt: string;
            /** Locale-resolved title string. */
            readonly title: string;
            /** Whether the entry has been seen by the authenticated user. */
            readonly seen: boolean;
        }>;
        /** Count of items where `seen === false`. */
        readonly unseenCount: number;
    };
}

// ============================================================================
// HELPER
// ============================================================================

/**
 * Formats a `publishedAt` ISO string to a short local date.
 *
 * Uses `es-AR` locale (dd/mm/yyyy) — the dashboard admin default.
 * Falls back to the raw ISO string if `Date` parsing fails.
 *
 * @param iso - An ISO 8601 datetime string (e.g. `'2026-06-01T00:00:00Z'`).
 * @returns A formatted date string such as `'01/06/2026'`.
 */
function formatPublishedAt(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return iso;
    }
}

// ============================================================================
// REGISTRATION
// ============================================================================

/**
 * "Últimas novedades" list widget source — shared by all four role dashboards.
 *
 * Fetches applicable What's New entries and maps them to the `ListItem[]` shape
 * expected by `ListWidget`. Unseen entries receive a `'Nuevo'` / success badge;
 * seen entries carry no badge.
 *
 * Source ID: `'whats-new.recent'`
 * Scope: works with `'all'`, `'own'`, or `'protected'` — the endpoint is
 *   session-authenticated regardless of scope. The config in `dashboards.ts`
 *   uses `scope: 'protected'`.
 * Endpoint: GET /api/v1/protected/whats-new
 */
registerDataSource('whats-new.recent', (ctx) => ({
    queryKey: buildDashboardQueryKey('whats-new.recent', ctx),
    queryFn: async () => {
        const result = await fetchApi<WhatsNewApiEnvelope>({
            path: '/api/v1/protected/whats-new'
        });
        const items = result.data.data?.items ?? [];

        return items.map((item) => ({
            id: item.id,
            label: item.title,
            meta: formatPublishedAt(item.publishedAt),
            // Unseen entries get a 'Nuevo' / success pill; seen ones carry no badge.
            statusBadge: item.seen ? undefined : ({ label: 'Nuevo', variant: 'success' } as const)
        }));
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));
