import type { User, UserAdminStats } from '@repo/schemas';
import { and, asc, count, desc, eq, isNull, or, type SQL, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { userRole } from '../../schemas/user/r_user_role.dbschema.ts';
import { users } from '../../schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { buildOrderByClause, buildWhereClause, safeIlike } from '../../utils/drizzle-helpers.ts';

/**
 * One row of {@link UserModel.listPublicAuthors} — everything a sitemap entry
 * needs and nothing else.
 *
 * `updatedAt` becomes the entry's `<lastmod>`. It is the user row's timestamp,
 * not the newest post's: what the URL renders is the profile plus two lists, so
 * a profile edit is a real change to that page.
 */
export type PublicAuthorListItem = {
    readonly slug: string;
    readonly updatedAt: Date;
};

export type UserWithCounts = User & {
    accommodationsCount: number;
    gastronomiesCount: number;
    experiencesCount: number;
    eventsCount: number;
    postsCount: number;
    currentPlanSlug: string | null;
};

export class UserModel extends BaseModelImpl<User> {
    protected table = users;
    public entityName = 'users';

    protected getTableName(): string {
        return 'users';
    }

    /**
     * Override findAll to handle text search with 'q' parameter.
     * Merges additionalConditions (e.g. from adminList search filters) into the WHERE clause
     * for both the main query and the count query to keep pagination consistent.
     *
     * @param where - Filter object, may include a 'q' key for text search
     * @param options - Optional pagination and sorting parameters
     * @param additionalConditions - Optional extra SQL conditions to combine with the where clause
     * @param tx - Optional transaction client
     * @returns Paginated result with items and total count
     */
    async findAll(
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
        additionalConditions?: SQL[],
        tx?: DrizzleClient
    ): Promise<{ items: User[]; total: number }> {
        const db = this.getClient(tx);
        const { q, ...otherFilters } = where;
        const page = options?.page;
        const pageSize = options?.pageSize;
        const isPaginated = page !== undefined && pageSize !== undefined;

        // Build base where clause for non-search filters
        const baseWhereClause = buildWhereClause(otherFilters, this.table);

        // Build search clause for 'q' parameter
        let searchClause: SQL | undefined;
        if (q && typeof q === 'string' && q.trim()) {
            const trimmed = q.trim();
            searchClause = or(
                safeIlike(users.displayName, trimmed),
                safeIlike(users.firstName, trimmed),
                safeIlike(users.lastName, trimmed)
            );
        }

        // Combine base where, search clause, and additionalConditions
        const allConditions: SQL[] = [];
        if (baseWhereClause) allConditions.push(baseWhereClause);
        if (searchClause) allConditions.push(searchClause);
        if (additionalConditions) allConditions.push(...additionalConditions);

        const finalWhereClause =
            allConditions.length === 0
                ? undefined
                : allConditions.length === 1
                  ? allConditions[0]
                  : and(...allConditions);

        if (isPaginated) {
            const offset = (page - 1) * pageSize;
            const [items, totalResult] = await Promise.all([
                db.select().from(this.table).where(finalWhereClause).limit(pageSize).offset(offset),
                db.select({ count: count() }).from(this.table).where(finalWhereClause)
            ]);

            const total = totalResult[0]?.count ?? 0;

            // DRIZZLE-LIMITATION: Drizzle's select() row type uses branded pgEnum (role, status) and JSONB columns; User entity uses domain enum unions and Zod-validated JSON shapes.
            return { items: items as unknown as User[], total };
        }

        // Safety cap: even when pagination is not explicitly requested, limit results
        // to prevent unbounded queries returning all users
        const SAFETY_LIMIT = 100;
        const items =
            (await db.select().from(this.table).where(finalWhereClause).limit(SAFETY_LIMIT)) || [];
        // DRIZZLE-LIMITATION: Drizzle's select() row type uses branded pgEnum (role, status) and JSONB columns; User entity uses domain enum unions identical at runtime.
        return { items: items as unknown as User[], total: items.length };
    }

    /**
     * Override count to handle text search with 'q' parameter.
     * Merges additionalConditions into the WHERE clause so that counts remain
     * consistent with findAll results when admin search filters are applied.
     *
     * @param where - Filter object, may include a 'q' key for text search
     * @param options - Optional config: additionalConditions for extra SQL, tx for transaction
     * @returns Promise resolving to the count
     */
    async count(
        where: Record<string, unknown>,
        options?: { additionalConditions?: SQL[]; tx?: DrizzleClient }
    ): Promise<number> {
        // If no 'q' parameter, use parent implementation (which already handles additionalConditions)
        if (!where.q) {
            return super.count(where, options);
        }

        const { additionalConditions = [], tx } = options ?? {};
        const db = this.getClient(tx);
        const { q, ...otherFilters } = where;

        // Build base where clause for non-search filters
        const baseWhereClause = buildWhereClause(otherFilters, this.table);

        // Build search clause for 'q' parameter
        let searchClause: SQL | undefined;
        if (q && typeof q === 'string' && q.trim()) {
            const trimmed = q.trim();
            searchClause = or(
                safeIlike(users.displayName, trimmed),
                safeIlike(users.firstName, trimmed),
                safeIlike(users.lastName, trimmed)
            );
        }

        // Combine base where, search clause, and additionalConditions
        const allConditions: SQL[] = [];
        if (baseWhereClause) allConditions.push(baseWhereClause);
        if (searchClause) allConditions.push(searchClause);
        if (additionalConditions.length > 0) allConditions.push(...additionalConditions);

        const finalWhereClause =
            allConditions.length === 0
                ? undefined
                : allConditions.length === 1
                  ? allConditions[0]
                  : and(...allConditions);

        const result = await db.select({ count: count() }).from(this.table).where(finalWhereClause);
        return result[0]?.count ?? 0;
    }

    /**
     * Find all users with relationship counts (accommodations, events, posts).
     * Merges additionalConditions into the WHERE clause for both the main query
     * and the count query to keep pagination consistent with admin search filters.
     *
     * @param where - Filter object, may include a 'q' key for text search
     * @param options - Optional pagination parameters
     * @param additionalConditions - Optional extra SQL conditions to combine with the where clause
     * @param tx - Optional transaction client
     * @returns Paginated result with items (including relationship counts) and total count
     */
    async findAllWithCounts(
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
        additionalConditions?: SQL[],
        tx?: DrizzleClient
    ): Promise<{ items: UserWithCounts[]; total: number }> {
        const db = this.getClient(tx);
        const { q, ...otherFilters } = where;
        const page = options?.page;
        const pageSize = options?.pageSize;
        const isPaginated = page !== undefined && pageSize !== undefined;

        // Build base where clause for non-search filters
        const baseWhereClause = buildWhereClause(otherFilters, this.table);

        // Build search clause for text search
        let searchClause: SQL | undefined;
        if (q && typeof q === 'string' && q.trim() !== '') {
            const trimmed = q.trim();
            searchClause = or(
                safeIlike(users.displayName, trimmed),
                safeIlike(users.firstName, trimmed),
                safeIlike(users.lastName, trimmed)
            );
        }

        // Combine base where, search clause, and additionalConditions
        const allConditions: SQL[] = [];
        if (baseWhereClause) allConditions.push(baseWhereClause);
        if (searchClause) allConditions.push(searchClause);
        if (additionalConditions) allConditions.push(...additionalConditions);

        const finalWhereClause =
            allConditions.length === 0
                ? undefined
                : allConditions.length === 1
                  ? allConditions[0]
                  : and(...allConditions);

        const outerUserId = sql.raw('"users"."id"');
        const outerUserIdText = sql.raw('"users"."id"::text');

        // Use correlated subqueries to get counts in a single query instead of N+1
        const accommodationsCountSq = sql<number>`(
            SELECT count(*)::int
            FROM "accommodations" AS a
            WHERE a."owner_id" = ${outerUserId}
              AND a."deleted_at" IS NULL
        )`.as('accommodations_count');

        const gastronomiesCountSq = sql<number>`(
            SELECT count(*)::int
            FROM "gastronomies" AS g
            WHERE g."owner_id" = ${outerUserId}
              AND g."deleted_at" IS NULL
        )`.as('gastronomies_count');

        const experiencesCountSq = sql<number>`(
            SELECT count(*)::int
            FROM "experiences" AS e
            WHERE e."owner_id" = ${outerUserId}
              AND e."deleted_at" IS NULL
        )`.as('experiences_count');

        const eventsCountSq = sql<number>`(
            SELECT count(*)::int
            FROM "events" AS e
            WHERE e."author_id" = ${outerUserId}
              AND e."deleted_at" IS NULL
        )`.as('events_count');

        const postsCountSq = sql<number>`(
            SELECT count(*)::int
            FROM "posts" AS p
            WHERE p."author_id" = ${outerUserId}
              AND p."deleted_at" IS NULL
        )`.as('posts_count');

        const currentPlanSlugSq = sql<string | null>`(
            SELECT bp."name"
            FROM "billing_subscriptions" AS bs
            INNER JOIN "billing_customers" AS bc
                ON bc."id" = bs."customer_id"
            INNER JOIN "billing_plans" AS bp
                ON (bp."id"::text = bs."plan_id" OR bp."name" = bs."plan_id")
            WHERE bc."external_id" = ${outerUserIdText}
              AND bc."deleted_at" IS NULL
              AND bs."deleted_at" IS NULL
              AND bp."deleted_at" IS NULL
              AND bs."status" IN ('active', 'trialing', 'comp')
              AND (bs."product_domain" IS NULL OR bs."product_domain" = 'accommodation')
            LIMIT 1
        )`.as('current_plan_slug');

        const orderByClause = options?.sortBy
            ? buildOrderByClause(options.sortBy, this.table, options.sortOrder ?? 'asc')
            : undefined;

        let baseQuery = db
            .select({
                user: users,
                accommodationsCount: accommodationsCountSq,
                gastronomiesCount: gastronomiesCountSq,
                experiencesCount: experiencesCountSq,
                eventsCount: eventsCountSq,
                postsCount: postsCountSq,
                currentPlanSlug: currentPlanSlugSq
            })
            .from(users)
            .where(finalWhereClause)
            .$dynamic();

        if (orderByClause) {
            baseQuery = baseQuery.orderBy(orderByClause);
        }

        let rows: Array<{
            user: typeof users.$inferSelect;
            accommodationsCount: number;
            gastronomiesCount: number;
            experiencesCount: number;
            eventsCount: number;
            postsCount: number;
            currentPlanSlug: string | null;
        }>;

        // Safety cap for non-paginated path to prevent unbounded queries
        const SAFETY_LIMIT = 100;
        if (isPaginated) {
            const safePageSize = Math.min(pageSize, SAFETY_LIMIT);
            const offset = (page - 1) * safePageSize;
            rows = await baseQuery.limit(safePageSize).offset(offset);
        } else {
            rows = await baseQuery.limit(SAFETY_LIMIT);
        }

        const itemsWithCounts: UserWithCounts[] = rows.map((row) => ({
            // DRIZZLE-LIMITATION: select with leftJoin projects row.user as Drizzle's full users-table row type with branded enums; User domain entity uses unbranded enum unions.
            ...(row.user as unknown as User),
            accommodationsCount: row.accommodationsCount ?? 0,
            gastronomiesCount: row.gastronomiesCount ?? 0,
            experiencesCount: row.experiencesCount ?? 0,
            eventsCount: row.eventsCount ?? 0,
            postsCount: row.postsCount ?? 0,
            currentPlanSlug: row.currentPlanSlug ?? null
        }));

        // Get total count for pagination
        let total = itemsWithCounts.length;
        if (isPaginated) {
            const countResult = await db
                .select({ count: count(users.id) })
                .from(users)
                .where(finalWhereClause);

            total = countResult[0]?.count ?? 0;
        }

        return { items: itemsWithCounts, total };
    }

    /**
     * Returns admin-level aggregated user statistics.
     *
     * Runs two independent queries in parallel:
     *  1. COUNT(*) GROUP BY role over `user_role`, joined to `users` to exclude
     *     soft-deleted accounts. HOS-296 dropped `users.role`, so this can no
     *     longer be a single-table `GROUP BY`. **Note for the UI**: with
     *     multi-role, a user contributes to one bucket PER held hat, so
     *     `Σ byRole >= totalUsers` is now correct rather than a bug — the
     *     dashboard has to say so or the number reads as broken (spec OQ-5).
     *  2. Monthly new-user trend for the last 12 complete months (current
     *     calendar month included), derived from `created_at`. Months with
     *     zero registrations are included as explicit zero buckets so the
     *     caller always receives a fixed-length series.
     *
     * @param tx - Optional Drizzle transaction client (for test isolation).
     * @returns Aggregated stats shaped as `UserAdminStats`.
     */
    async getAdminStats(tx?: DrizzleClient): Promise<UserAdminStats> {
        const db = this.getClient(tx);

        // ---- byRole aggregation ------------------------------------------
        // Only count non-deleted users (deletedAt IS NULL). The join to `users`
        // is what enforces that now that the roles live in their own table.
        const roleCountsQuery = db
            .select({
                role: userRole.role,
                total: count(userRole.userId)
            })
            .from(userRole)
            .innerJoin(users, eq(users.id, userRole.userId))
            .where(isNull(users.deletedAt))
            .groupBy(userRole.role);

        // ---- newUsersTrend aggregation ------------------------------------
        // Extract YYYY-MM from created_at using to_char for deterministic
        // formatting, covering the last 12 months (oldest first).
        // The CTE `months` materialises the 12-month window; the LEFT JOIN
        // ensures months with no registrations appear as 0.
        const trendQuery = db.execute<{ month: string; count: string }>(sql`
            WITH months AS (
                SELECT to_char(
                    date_trunc('month', now()) - (gs.n * interval '1 month'),
                    'YYYY-MM'
                ) AS month
                FROM generate_series(11, 0, -1) AS gs(n)
            )
            SELECT
                m.month,
                COALESCE(COUNT(u.id), 0)::int AS count
            FROM months m
            LEFT JOIN users u
                ON to_char(date_trunc('month', u.created_at), 'YYYY-MM') = m.month
                AND u.deleted_at IS NULL
            GROUP BY m.month
            ORDER BY m.month ASC
        `);

        const [roleCounts, trendRows] = await Promise.all([roleCountsQuery, trendQuery]);

        const byRole: Record<string, number> = {};
        for (const row of roleCounts) {
            if (row.role) {
                byRole[row.role] = row.total;
            }
        }

        const newUsersTrend = trendRows.rows.map((row) => ({
            month: row.month,
            count: Number(row.count)
        }));

        return { byRole, newUsersTrend };
    }

    /**
     * Lists the users who qualify for a PUBLIC, INDEXABLE author page.
     *
     * Backs `GET /api/v1/public/authors`, which exists to feed the dynamic
     * sitemap (HOS-375 §6.6). It is a deliberately narrow projection —
     * `{ slug, updatedAt }`, exactly what a sitemap entry needs — and it must
     * never be widened into "list all users": it is a public, unauthenticated
     * surface, and the only thing that keeps it from being a user-enumeration
     * endpoint is that every row it returns is already published to Google.
     *
     * The predicate mirrors the four row-level conditions of §6.5, in the same
     * order the web helper `evaluateAuthorIndexability` evaluates them:
     *
     * 1. **Not a system account.** `is_system_account = false`. This is content
     *    curation, NOT authorization — there is no permission meaning "deserves
     *    a public author page", so the repo's "always use `PermissionEnum`" rule
     *    does not apply. Do not convert it into a permission check, and do not
     *    "improve" it into a live role check: role is mutable, this is not, and
     *    reading the role here would make an indexed URL appear or vanish as a
     *    side effect of a permissions change (§6.10.1, R-9).
     * 2. **At least one published post or event**, as an `EXISTS` per table so
     *    Postgres can stop at the first hit instead of counting every row.
     * 3. **Non-empty `bio`** and 4. **non-empty `avatar`** — read as JSONB paths
     *    off `profile`. There are no `bio`/`avatar` columns on `users` (§12), and
     *    `users.image` is a DIFFERENT field the author page does not render.
     *
     * "Published" here means `visibility = 'PUBLIC' AND lifecycle_state =
     * 'ACTIVE' AND deleted_at IS NULL`. That is deliberately CONSERVATIVE: the
     * public post list currently applies no visibility filter of its own, so the
     * page can count content this query does not. The divergence is one-way by
     * design — a page may be indexable without being listed in the sitemap, but
     * the sitemap can never advertise a URL the page then serves as `noindex`,
     * which is the failure §6.6 exists to prevent.
     *
     * Ordering is `updated_at DESC, slug ASC`. The slug tiebreak is not
     * cosmetic: `updated_at` is not unique, and without it a row could appear on
     * two pages of a paginated crawl, or on none.
     *
     * @param options - `page` and `pageSize` (1-based page).
     * @param tx - Optional transaction client.
     * @returns The page of qualifying authors and the total across all pages.
     */
    async listPublicAuthors(
        options: { page: number; pageSize: number },
        tx?: DrizzleClient
    ): Promise<{ items: PublicAuthorListItem[]; total: number }> {
        const db = this.getClient(tx);
        const { page, pageSize } = options;

        const outerUserId = sql.raw('"users"."id"');

        // EXISTS rather than a count: the question is "any?", and Postgres can
        // short-circuit on the first matching row.
        const hasPublishedPost = sql`EXISTS (
            SELECT 1
            FROM "posts" AS p
            WHERE p."author_id" = ${outerUserId}
              AND p."deleted_at" IS NULL
              AND p."visibility" = 'PUBLIC'
              AND p."lifecycle_state" = 'ACTIVE'
        )`;

        const hasPublishedEvent = sql`EXISTS (
            SELECT 1
            FROM "events" AS e
            WHERE e."author_id" = ${outerUserId}
              AND e."deleted_at" IS NULL
              AND e."visibility" = 'PUBLIC'
              AND e."lifecycle_state" = 'ACTIVE'
        )`;

        // `trim(coalesce(...))` collapses the three ways a profile field can be
        // absent — key missing, SQL NULL, whitespace only — into one test, so a
        // profile holding `{"bio": "   "}` is treated as empty, exactly as the
        // web predicate treats it.
        const hasBio = sql`trim(coalesce(${users.profile}->>'bio', '')) <> ''`;
        const hasAvatar = sql`trim(coalesce(${users.profile}->>'avatar', '')) <> ''`;

        // ONE condition list, used by both the page query and the count query.
        // Building them separately is how a `total` silently stops matching the
        // rows it is supposed to count.
        const whereClause = and(
            isNull(users.deletedAt),
            eq(users.isSystemAccount, false),
            hasBio,
            hasAvatar,
            or(hasPublishedPost, hasPublishedEvent)
        );

        const offset = (page - 1) * pageSize;

        const [rows, countResult] = await Promise.all([
            db
                .select({ slug: users.slug, updatedAt: users.updatedAt })
                .from(users)
                .where(whereClause)
                .orderBy(desc(users.updatedAt), asc(users.slug))
                .limit(pageSize)
                .offset(offset),
            db
                .select({ count: count(users.id) })
                .from(users)
                .where(whereClause)
        ]);

        return {
            items: rows.map((row) => ({ slug: row.slug, updatedAt: row.updatedAt })),
            total: countResult[0]?.count ?? 0
        };
    }
}

/** Singleton instance of UserModel for use across the application. */
export const userModel = new UserModel();
