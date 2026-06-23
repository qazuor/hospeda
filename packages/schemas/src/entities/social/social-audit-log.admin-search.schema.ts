import { z } from 'zod';

/**
 * Admin search schema for social audit log.
 * Used by GET /api/v1/admin/social/audit-log.
 *
 * @example
 * ```ts
 * const params = SocialAuditLogAdminSearchSchema.parse({
 *   page: 1,
 *   eventType: 'POST_APPROVED'
 * });
 * ```
 */
export const SocialAuditLogAdminSearchSchema = z.object({
    /** Page number (1-based). */
    page: z.coerce
        .number()
        .int()
        .positive({ message: 'zodError.admin.search.page.positive' })
        .default(1),

    /** Items per page (1-100). */
    pageSize: z.coerce
        .number()
        .int()
        .positive({ message: 'zodError.admin.search.pageSize.positive' })
        .max(100, { message: 'zodError.admin.search.pageSize.max' })
        .default(20),

    /** Filter by audited entity type (e.g. "social_post", "social_post_target"). */
    entityType: z.string().optional().describe('Filter by entity type'),

    /** Filter by audited entity UUID. */
    entityId: z.string().optional().describe('Filter by entity UUID'),

    /** Filter by semantic event type (e.g. "POST_APPROVED", "POST_REJECTED"). */
    eventType: z.string().optional().describe('Filter by event type'),

    /** Filter by acting user UUID. */
    actorId: z
        .string()
        .uuid({ message: 'zodError.socialAuditLog.actorId.uuid' })
        .optional()
        .describe('Filter by actor UUID'),

    /** Inclusive lower bound on createdAt. */
    createdAtFrom: z.coerce.date().optional().describe('Inclusive lower bound on createdAt'),

    /** Inclusive upper bound on createdAt. */
    createdAtTo: z.coerce.date().optional().describe('Inclusive upper bound on createdAt')
});

/** TypeScript type inferred from {@link SocialAuditLogAdminSearchSchema}. */
export type SocialAuditLogAdminSearch = z.infer<typeof SocialAuditLogAdminSearchSchema>;
