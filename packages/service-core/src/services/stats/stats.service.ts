import { accommodationReviews, getDb, users } from '@repo/db';
import { and, avg, desc, eq, isNull, max } from 'drizzle-orm';
import type { ServiceConfig, ServiceLogger } from '../../types/index.js';

/**
 * Stats Service
 *
 * Aggregate read-only service producing platform-wide metrics not natively
 * surfaced by the per-entity services. Used by public marketing surfaces
 * (footer trust signals, landing hero stats).
 *
 * Not a CRUD service — does not extend `BaseCrudService` because it owns no
 * single entity, performs no writes, and intentionally requires no actor or
 * permission gating: the data is public.
 */
export class StatsService {
    static readonly SERVICE_NAME = 'stats';

    private readonly logger?: ServiceLogger;

    constructor(ctx: ServiceConfig = {}) {
        this.logger = ctx.logger;
    }

    /**
     * Returns the global average of accommodation review ratings on a 0-5
     * scale, rounded to 2 decimals (matching the `numeric(3, 2)` storage
     * precision). Considers only non-deleted, ACTIVE reviews. Returns 0 when
     * there are no reviews.
     */
    async getGlobalAccommodationAverageRating(): Promise<number> {
        const db = getDb();

        const [row] = await db
            .select({ avg: avg(accommodationReviews.averageRating) })
            .from(accommodationReviews)
            .where(
                and(
                    eq(accommodationReviews.lifecycleState, 'ACTIVE'),
                    isNull(accommodationReviews.deletedAt)
                )
            );

        const raw = row?.avg;
        const value = raw !== null && raw !== undefined ? Number(raw) : 0;
        const clamped = clampRating(value);

        this.logger?.info?.(
            { averageRating: clamped },
            '[stats] getGlobalAccommodationAverageRating'
        );

        return clamped;
    }

    /**
     * Returns up to `limit` avatar URLs of the most recent active accommodation
     * reviewers. Used by the public hero "social proof" overlay so the avatar
     * row reflects real users instead of placeholders.
     *
     * Implementation notes:
     * - Joins `accommodation_reviews` with `users` (one row per distinct user,
     *   ordered by their most recent review) and reads both the dedicated
     *   `users.image` column and the legacy `profile.avatar` (the same
     *   precedence used by the public review list endpoint, where seeded
     *   accounts only carry `profile.avatar` and social-login users carry
     *   `image`).
     * - Filters out empty strings and deleted users so the UI never renders an
     *   `<img src="">`.
     * - Over-fetches by a small factor (`limit * 3`, capped at 30) before the
     *   in-JS filter so the final list almost always reaches `limit` even when
     *   recent reviewers happen to lack avatars.
     */
    async getRecentReviewerAvatars(input: { limit: number }): Promise<readonly string[]> {
        const safeLimit = Math.max(0, Math.floor(input.limit));
        if (safeLimit === 0) return [];

        const db = getDb();
        const fetchSize = Math.min(safeLimit * 3, 30);

        const rows = await db
            .select({
                image: users.image,
                profile: users.profile,
                lastReviewAt: max(accommodationReviews.createdAt)
            })
            .from(accommodationReviews)
            .innerJoin(users, eq(users.id, accommodationReviews.userId))
            .where(
                and(
                    eq(accommodationReviews.lifecycleState, 'ACTIVE'),
                    isNull(accommodationReviews.deletedAt),
                    isNull(users.deletedAt)
                )
            )
            .groupBy(users.id, users.image, users.profile)
            .orderBy(desc(max(accommodationReviews.createdAt)))
            .limit(fetchSize);

        const avatars: string[] = [];
        for (const row of rows) {
            const profileAvatar =
                (row.profile as { avatar?: string | null } | null)?.avatar ?? null;
            const candidate = row.image || profileAvatar;
            if (typeof candidate === 'string' && candidate.length > 0) {
                avatars.push(candidate);
                if (avatars.length >= safeLimit) break;
            }
        }

        this.logger?.info?.(
            { count: avatars.length, limit: safeLimit },
            '[stats] getRecentReviewerAvatars'
        );

        return avatars;
    }
}

/**
 * Clamps an average rating into the 0-5 range, returning 0 for non-finite
 * inputs (NaN guards against the case where AVG returns null on an empty set
 * but the caller's coercion produced NaN). Rounds to 2 decimals to match the
 * `numeric(3, 2)` storage precision.
 */
function clampRating(value: number): number {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 5) return 5;
    return Math.round(value * 100) / 100;
}
