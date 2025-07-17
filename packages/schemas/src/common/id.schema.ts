import type {
    AccommodationFaqId,
    AccommodationIaDataId,
    AccommodationId,
    AccommodationReviewId,
    AmenityId,
    AttractionId,
    DestinationId,
    DestinationReviewId,
    EventId,
    EventLocationId,
    EventOrganizerId,
    FeatureId,
    PostId,
    PostSponsorId,
    PostSponsorshipId,
    TagId,
    UserBookmarkId,
    UserId
} from '@repo/types';
import { z } from 'zod';

const BaseIdSchema = z
    .string({
        required_error: 'zodError.common.id.required',
        invalid_type_error: 'zodError.common.id.invalidType'
    })
    .uuid({ message: 'zodError.common.id.invalidUuid' });

export const IdSchema = BaseIdSchema;

export const UserIdSchema = BaseIdSchema.transform((val) => val as UserId);
export const UserBookmarkIdSchema = BaseIdSchema.transform((val) => val as UserBookmarkId);

export const TagIdSchema = BaseIdSchema.transform((val) => val as TagId);

export const AccommodationIdSchema = BaseIdSchema.transform((val) => val as AccommodationId);
export const AmenityIdSchema = BaseIdSchema.transform((val) => val as AmenityId);
export const FeatureIdSchema = BaseIdSchema.transform((val) => val as FeatureId);
export const AccommodationFaqIdSchema = BaseIdSchema.transform((val) => val as AccommodationFaqId);
export const AccommodationIaDataIdSchema = BaseIdSchema.transform(
    (val) => val as AccommodationIaDataId
);
export const AccommodationReviewIdSchema = BaseIdSchema.transform(
    (val) => val as AccommodationReviewId
);

export const DestinationIdSchema = BaseIdSchema.transform((val) => val as DestinationId);
export const AttractionIdSchema = BaseIdSchema.transform((val) => val as AttractionId);
export const DestinationReviewIdSchema = BaseIdSchema.transform(
    (val) => val as DestinationReviewId
);

export const EventIdSchema = BaseIdSchema.transform((val) => val as EventId);
export const EventLocationIdSchema = BaseIdSchema.transform((val) => val as EventLocationId);
export const EventOrganizerIdSchema = BaseIdSchema.transform((val) => val as EventOrganizerId);

export const PostIdSchema = BaseIdSchema.transform((val) => val as PostId);
export const PostSponsorIdSchema = BaseIdSchema.transform((val) => val as PostSponsorId);
export const PostSponsorshipIdSchema = BaseIdSchema.transform((val) => val as PostSponsorshipId);
