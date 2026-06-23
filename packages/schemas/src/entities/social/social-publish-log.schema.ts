import { z } from 'zod';
import { SocialPlatformEnumSchema } from '../../enums/social-platform.schema.js';
import { SocialPublishFormatEnumSchema } from '../../enums/social-publish-format.schema.js';
import { SocialPublishResultStatusEnumSchema } from '../../enums/social-publish-result-status.schema.js';

/**
 * SocialPublishLog entity schema.
 * Append-only event log for every dispatch attempt and Make.com callback.
 *
 * NO soft-delete columns and NO audit FKs by design — this is a permanent
 * operational log. Rows are never deleted by application code.
 */
export const SocialPublishLogSchema = z.object({
    id: z.string().uuid({ message: 'zodError.socialPublishLog.id.uuid' }),
    socialPostId: z.string().uuid({ message: 'zodError.socialPublishLog.socialPostId.uuid' }),
    /** Nullable — absent when logging a post-level event (not target-specific) */
    socialPostTargetId: z
        .string()
        .uuid({ message: 'zodError.socialPublishLog.socialPostTargetId.uuid' })
        .optional(),
    /** Platform at the time of this log entry. Nullable for post-level events. */
    platform: SocialPlatformEnumSchema.optional(),
    /** Publish format at the time of this log entry. Nullable for post-level events. */
    publishFormat: SocialPublishFormatEnumSchema.optional(),
    status: SocialPublishResultStatusEnumSchema,
    /** Human-readable message describing the event */
    message: z.string().optional(),
    /** Outbound payload sent to Make.com */
    requestPayloadJson: z.record(z.string(), z.unknown()).optional(),
    /** Response received from Make.com or error detail */
    responsePayloadJson: z.record(z.string(), z.unknown()).optional(),
    /** Platform's native post ID on success */
    externalPostId: z.string().optional(),
    /** Platform's native post URL on success */
    externalPostUrl: z
        .string()
        .url({ message: 'zodError.socialPublishLog.externalPostUrl.url' })
        .optional(),
    /** Make.com run identifier for correlation */
    makeRunId: z.string().optional(),
    createdAt: z.coerce.date({ message: 'zodError.common.createdAt.required' })
});

/** TypeScript type inferred from {@link SocialPublishLogSchema}. */
export type SocialPublishLog = z.infer<typeof SocialPublishLogSchema>;
