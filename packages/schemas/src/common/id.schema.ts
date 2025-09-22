import { z } from 'zod';

const BaseIdSchema = z
    .string({
        message: 'zodError.common.id.required'
    })
    .uuid({ message: 'zodError.common.id.invalidUuid' });

export const IdSchema = BaseIdSchema;
export type IdType = z.infer<typeof IdSchema>;

/**
 * Base ID fields - Using UUID as agreed
 */
export const BaseIdFields = {
    id: z.string().uuid({
        message: 'zodError.common.id.invalid'
    })
} as const;

// Specific ID schemas for each entity
export const UserIdSchema = BaseIdSchema;
export type UserIdType = z.infer<typeof UserIdSchema>;

export const UserBookmarkIdSchema = BaseIdSchema;
export type UserBookmarkIdType = z.infer<typeof UserBookmarkIdSchema>;

export const TagIdSchema = BaseIdSchema;
export type TagIdType = z.infer<typeof TagIdSchema>;

export const AccommodationIdSchema = BaseIdSchema;
export type AccommodationIdType = z.infer<typeof AccommodationIdSchema>;

export const AccommodationFaqIdSchema = BaseIdSchema;
export type AccommodationFaqIdType = z.infer<typeof AccommodationFaqIdSchema>;

export const AccommodationIaDataIdSchema = BaseIdSchema;
export type AccommodationIaDataIdType = z.infer<typeof AccommodationIaDataIdSchema>;

export const AccommodationReviewIdSchema = BaseIdSchema;
export type AccommodationReviewIdType = z.infer<typeof AccommodationReviewIdSchema>;

export const AmenityIdSchema = BaseIdSchema;
export type AmenityIdType = z.infer<typeof AmenityIdSchema>;

export const FeatureIdSchema = BaseIdSchema;
export type FeatureIdType = z.infer<typeof FeatureIdSchema>;

export const AttractionIdSchema = BaseIdSchema;
export type AttractionIdType = z.infer<typeof AttractionIdSchema>;

export const DestinationIdSchema = BaseIdSchema;
export type DestinationIdType = z.infer<typeof DestinationIdSchema>;

export const DestinationReviewIdSchema = BaseIdSchema;
export type DestinationReviewIdType = z.infer<typeof DestinationReviewIdSchema>;

export const EventIdSchema = BaseIdSchema;
export type EventIdType = z.infer<typeof EventIdSchema>;

export const EventLocationIdSchema = BaseIdSchema;
export type EventLocationIdType = z.infer<typeof EventLocationIdSchema>;

export const EventOrganizerIdSchema = BaseIdSchema;
export type EventOrganizerIdType = z.infer<typeof EventOrganizerIdSchema>;

export const PostIdSchema = BaseIdSchema;
export type PostIdType = z.infer<typeof PostIdSchema>;

export const PostSponsorIdSchema = BaseIdSchema;
export type PostSponsorIdType = z.infer<typeof PostSponsorIdSchema>;

export const PostSponsorshipIdSchema = BaseIdSchema;
export type PostSponsorshipIdType = z.infer<typeof PostSponsorshipIdSchema>;

export const PaymentIdSchema = BaseIdSchema;
export type PaymentIdType = z.infer<typeof PaymentIdSchema>;

export const PaymentPlanIdSchema = BaseIdSchema;
export type PaymentPlanIdType = z.infer<typeof PaymentPlanIdSchema>;

export const SubscriptionIdSchema = BaseIdSchema;
export type SubscriptionIdType = z.infer<typeof SubscriptionIdSchema>;
