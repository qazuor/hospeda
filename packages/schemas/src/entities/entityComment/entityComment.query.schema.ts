import { z } from 'zod';

/**
 * EntityComment query schemas (SPEC-165 §5.2 / §5.4).
 *
 * The public thread and the admin recent-feed use small, purpose-built query
 * schemas with their own pageSize ceilings. The full admin list query lives in
 * `entityComment.admin-search.schema.ts` (it extends `AdminSearchBaseSchema`).
 */

/** Public thread default page size and ceiling (SPEC-165 §5.2). */
export const PUBLIC_THREAD_DEFAULT_PAGE_SIZE = 20;
export const PUBLIC_THREAD_MAX_PAGE_SIZE = 50;

/**
 * Public comment-thread query params for
 * `GET /public/{posts|events}/:id/comments`. Coerces string query values.
 */
export const PublicCommentThreadQuerySchema = z.object({
    page: z.coerce
        .number()
        .int()
        .positive({ message: 'zodError.entityComment.page.positive' })
        .default(1),
    pageSize: z.coerce
        .number()
        .int()
        .positive({ message: 'zodError.entityComment.pageSize.positive' })
        .max(PUBLIC_THREAD_MAX_PAGE_SIZE, { message: 'zodError.entityComment.pageSize.max' })
        .default(PUBLIC_THREAD_DEFAULT_PAGE_SIZE)
});
export type PublicCommentThreadQuery = z.infer<typeof PublicCommentThreadQuerySchema>;

/** Recent-feed default page size and ceiling (SPEC-165 §5.4). */
export const RECENT_FEED_DEFAULT_PAGE_SIZE = 10;
export const RECENT_FEED_MAX_PAGE_SIZE = 50;

/**
 * Recent-comments feed query for `GET /admin/comments/recent`. Single page only,
 * capped at `pageSize` — no deeper pagination (SPEC-165 §5.4).
 */
export const RecentCommentsQuerySchema = z.object({
    pageSize: z.coerce
        .number()
        .int()
        .positive({ message: 'zodError.entityComment.pageSize.positive' })
        .max(RECENT_FEED_MAX_PAGE_SIZE, { message: 'zodError.entityComment.pageSize.max' })
        .default(RECENT_FEED_DEFAULT_PAGE_SIZE)
});
export type RecentCommentsQuery = z.infer<typeof RecentCommentsQuerySchema>;
