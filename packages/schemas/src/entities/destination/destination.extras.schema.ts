import { z } from 'zod';
import { LocationSchema } from '../../common/location.schema';
import { MediaSchema } from '../../common/media.schema';
import { TagSchema } from '../../common/tag.schema';
import { AccommodationSchema } from '../accommodation/accommodation.schema';
import { DestinationAttractionSchema } from './attraction.schema';
import { DestinationReviewSchema } from './review.schema';

/**
 * Destination Extras schema definition using Zod for validation.
 * Represents additional information for a destination.
 */

// DestinationSummary: Pick<DestinationType, 'id' | 'slug' | 'name' | 'summary' | 'media' | 'averageRating' | 'reviewsCount'>
export const DestinationSummarySchema = z.object({
    id: z.string({ message: 'error:destination.summary.id.required' }),
    slug: z.string({ message: 'error:destination.summary.slug.required' }),
    name: z.string({ message: 'error:destination.summary.name.required' }),
    summary: z.string({ message: 'error:destination.summary.summary.required' }),
    media: MediaSchema,
    averageRating: z.number().optional(),
    reviewsCount: z.number().optional()
});

// DestinationWithRelations: DestinationType & { accommodations?: AccommodationType[]; reviews?: DestinationReviewType[]; tags?: TagType[]; attractions?: DestinationAttractionType[]; }
export const DestinationWithRelationsSchema = z.object({
    // Basic fields from DestinationType
    id: z.string({ message: 'error:destination.id.required' }),
    slug: z.string({ message: 'error:destination.slug.required' }),
    name: z.string({ message: 'error:destination.name.required' }),
    summary: z.string({ message: 'error:destination.summary.required' }),
    description: z.string({ message: 'error:destination.description.required' }),
    location: LocationSchema,
    media: MediaSchema,
    isFeatured: z.boolean().optional(),
    visibility: z.string({ message: 'error:destination.visibility.required' }),
    reviewsCount: z.number().optional(),
    averageRating: z.number().optional(),
    accommodationsCount: z.number().optional(),
    // Relations
    accommodations: z.array(AccommodationSchema).optional(),
    reviews: z.array(DestinationReviewSchema).optional(),
    tags: z.array(TagSchema).optional(),
    attractions: z.array(DestinationAttractionSchema).optional()
});
