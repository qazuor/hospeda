import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { UserIdSchema } from '../../common/id.schema.js';
import { ModerationStatusEnumSchema } from '../../enums/moderation-status.schema.js';

/** Minimum characters of a host's reply to a review. */
export const ACCOMMODATION_REVIEW_REPLY_MIN = 1;
/** Maximum characters of a host's reply to a review. */
export const ACCOMMODATION_REVIEW_REPLY_MAX = 1000;

/** Body text of a host's reply. Trimmed, then bounded on both ends. */
export const AccommodationReviewReplyContentSchema = z
    .string()
    .trim()
    .min(ACCOMMODATION_REVIEW_REPLY_MIN, {
        message: 'zodError.accommodationReviewReply.content.min'
    })
    .max(ACCOMMODATION_REVIEW_REPLY_MAX, {
        message: 'zodError.accommodationReviewReply.content.max'
    });

/**
 * AccommodationReviewReplySchema: the host's single, editable answer to a
 * review of their accommodation (HOS-2199).
 *
 * One LIVE reply per review. A soft-deleted reply frees the slot.
 */
export const AccommodationReviewReplySchema = z.object({
    /** Unique identifier of the reply (UUID). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** The review being answered. */
    reviewId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** The owner who wrote it, frozen at writing time. */
    authorUserId: UserIdSchema,
    /** The reply text. */
    content: AccommodationReviewReplyContentSchema,
    /** Moderation state. Born APPROVED unless the content filter flags it. */
    moderationState: ModerationStatusEnumSchema,
    moderatedById: UserIdSchema.nullish(),
    moderatedAt: z.coerce.date().nullish(),
    moderationReason: z.string().nullish(),
    /** Set once the reply has been edited; null while as first written. */
    editedAt: z.coerce.date().nullish(),
    ...BaseAuditFields
});

/** Full reply entity. */
export type AccommodationReviewReply = z.infer<typeof AccommodationReviewReplySchema>;

/** Request body to write or edit a reply. */
export const AccommodationReviewReplyBodySchema = z.object({
    content: AccommodationReviewReplyContentSchema
});
export type AccommodationReviewReplyBody = z.infer<typeof AccommodationReviewReplyBodySchema>;

/** The reply as the public listing page shows it. No author, no moderation data. */
export const AccommodationReviewReplyPublicSchema = z.object({
    content: z.string(),
    createdAt: z.coerce.date(),
    /** Non-null once edited, so the page can label it. */
    editedAt: z.coerce.date().nullable()
});
export type AccommodationReviewReplyPublic = z.infer<typeof AccommodationReviewReplyPublicSchema>;

/** The reply as its own author sees it (adds the moderation state). */
export const AccommodationReviewReplyOwnerSchema = AccommodationReviewReplyPublicSchema.extend({
    id: z.string().uuid(),
    reviewId: z.string().uuid(),
    /** PENDING means the filter flagged it: the author sees it, the public does not. */
    moderationState: ModerationStatusEnumSchema
});
export type AccommodationReviewReplyOwner = z.infer<typeof AccommodationReviewReplyOwnerSchema>;

/** Query of the owner's received-reviews list. */
export const OwnerReceivedReviewsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
    /** Only reviews with no live reply. */
    // Accepts the raw query string AND an already-transformed boolean: the route
    // factory validates the query once, and the handler must be able to parse again.
    unanswered: z
        .union([z.boolean(), z.enum(['true', 'false'])])
        .optional()
        .transform((v) => v === true || v === 'true'),
    /** Narrow to one of the owner's accommodations. */
    accommodationId: z.string().uuid().optional()
});
export type OwnerReceivedReviewsQuery = z.infer<typeof OwnerReceivedReviewsQuerySchema>;

/** One review received on an accommodation the actor owns. */
export const OwnerReceivedReviewSchema = z.object({
    id: z.string().uuid(),
    accommodationId: z.string().uuid(),
    accommodationName: z.string(),
    accommodationSlug: z.string(),
    title: z.string().nullable(),
    content: z.string().nullable(),
    averageRating: z.number(),
    createdAt: z.coerce.date(),
    reviewerName: z.string().nullable(),
    /** The live reply, when one exists. */
    reply: AccommodationReviewReplyOwnerSchema.nullable()
});
export type OwnerReceivedReview = z.infer<typeof OwnerReceivedReviewSchema>;
