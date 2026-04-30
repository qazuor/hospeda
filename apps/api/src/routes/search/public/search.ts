/**
 * Public unified search endpoint (SPEC-096 / REQ-096-04).
 *
 * GET /api/v1/public/search?q={query}&limit={n}
 *
 * Returns a cross-entity search result with up to `limit` items per group for
 * accommodations, destinations, events, and posts. Rate-limited at 30 req/min
 * per IP to prevent abuse.
 */
import { events, accommodations, destinations, getDb, posts, safeIlike } from '@repo/db';
import { PublicSearchQuerySchema, PublicSearchResponseSchema } from '@repo/schemas';
import { count, or } from 'drizzle-orm';
import { createPerRouteRateLimitMiddleware } from '../../../middlewares/rate-limit';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

/** Rate limit: 30 requests per minute per IP (REQ-096-04). */
const searchRateLimit = createPerRouteRateLimitMiddleware({
    requests: 30,
    windowMs: 60_000
});

/**
 * Extracts the URL of the featured (cover) image from the JSONB `media` column.
 * Returns `undefined` when no media or no featured image exists.
 */
function extractCoverImageUrl(
    media: { featuredImage?: { url?: string } } | null | undefined
): string | undefined {
    return media?.featuredImage?.url ?? undefined;
}

/**
 * GET /api/v1/public/search
 *
 * Unified cross-entity search. Runs 4 parallel Drizzle queries (one per entity
 * group) using `safeIlike` to prevent SQL injection via LIKE metacharacters.
 *
 * @returns PublicSearchResponse with `{ accommodations, destinations, events, posts }`
 */
export const publicSearchRoute = createPublicRoute({
    method: 'get',
    path: '/',
    summary: 'Unified public search',
    description:
        'Search across accommodations, destinations, events, and posts. ' +
        'Returns up to `limit` results per group. Rate-limited at 30 req/min.',
    tags: ['Search'],
    requestQuery: {
        q: PublicSearchQuerySchema.shape.q,
        limit: PublicSearchQuerySchema.shape.limit
    },
    responseSchema: PublicSearchResponseSchema,
    handler: async (_ctx, _params, _body, query) => {
        const { q, limit } = PublicSearchQuerySchema.parse(query);
        const db = getDb();

        apiLogger.debug({ q, limit }, '[search] running unified public search');

        // ── 4 parallel queries ────────────────────────────────────────────────
        const [
            accommodationRows,
            accommodationCount,
            destinationRows,
            destinationCount,
            eventRows,
            eventCount,
            postRows,
            postCount
        ] = await Promise.all([
            // Accommodations
            db
                .select({
                    id: accommodations.id,
                    slug: accommodations.slug,
                    name: accommodations.name,
                    media: accommodations.media,
                    type: accommodations.type
                })
                .from(accommodations)
                .where(or(safeIlike(accommodations.name, q), safeIlike(accommodations.slug, q)))
                .limit(limit),

            db
                .select({ total: count() })
                .from(accommodations)
                .where(or(safeIlike(accommodations.name, q), safeIlike(accommodations.slug, q))),

            // Destinations
            db
                .select({
                    id: destinations.id,
                    slug: destinations.slug,
                    name: destinations.name,
                    media: destinations.media,
                    destinationType: destinations.destinationType
                })
                .from(destinations)
                .where(or(safeIlike(destinations.name, q), safeIlike(destinations.slug, q)))
                .limit(limit),

            db
                .select({ total: count() })
                .from(destinations)
                .where(or(safeIlike(destinations.name, q), safeIlike(destinations.slug, q))),

            // Events
            db
                .select({
                    id: events.id,
                    slug: events.slug,
                    name: events.name,
                    media: events.media,
                    category: events.category
                })
                .from(events)
                .where(or(safeIlike(events.name, q), safeIlike(events.slug, q)))
                .limit(limit),

            db
                .select({ total: count() })
                .from(events)
                .where(or(safeIlike(events.name, q), safeIlike(events.slug, q))),

            // Posts (title is the display name; category is the classification)
            db
                .select({
                    id: posts.id,
                    slug: posts.slug,
                    title: posts.title,
                    media: posts.media,
                    category: posts.category
                })
                .from(posts)
                .where(or(safeIlike(posts.title, q), safeIlike(posts.slug, q)))
                .limit(limit),

            db
                .select({ total: count() })
                .from(posts)
                .where(or(safeIlike(posts.title, q), safeIlike(posts.slug, q)))
        ]);

        // ── Project to PublicSearchResultItem shape ────────────────────────────
        return {
            accommodations: {
                items: accommodationRows.map((row) => ({
                    id: row.id,
                    slug: row.slug,
                    name: row.name,
                    coverImage: extractCoverImageUrl(
                        row.media as { featuredImage?: { url?: string } } | null
                    ),
                    type: row.type,
                    category: 'accommodation'
                })),
                total: accommodationCount[0]?.total ?? 0
            },
            destinations: {
                items: destinationRows.map((row) => ({
                    id: row.id,
                    slug: row.slug,
                    name: row.name,
                    coverImage: extractCoverImageUrl(
                        row.media as { featuredImage?: { url?: string } } | null
                    ),
                    category: row.destinationType
                })),
                total: destinationCount[0]?.total ?? 0
            },
            events: {
                items: eventRows.map((row) => ({
                    id: row.id,
                    slug: row.slug,
                    name: row.name,
                    coverImage: extractCoverImageUrl(
                        row.media as { featuredImage?: { url?: string } } | null
                    ),
                    category: row.category
                })),
                total: eventCount[0]?.total ?? 0
            },
            posts: {
                items: postRows.map((row) => ({
                    id: row.id,
                    slug: row.slug,
                    name: row.title,
                    coverImage: extractCoverImageUrl(
                        row.media as { featuredImage?: { url?: string } } | null
                    ),
                    category: row.category
                })),
                total: postCount[0]?.total ?? 0
            }
        };
    },
    options: {
        middlewares: [searchRateLimit]
    }
});
