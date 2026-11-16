/**
 * @file listing-services.ts
 * @description The service-core instances the listing tools read through
 * (HOS-2184 T-013/T-014). One instance per vertical, built once per process
 * like the protected routes build theirs, so the tools reuse the exact
 * service methods the HTTP owner routes call and never query the database
 * themselves.
 */

import { VerticalEnum } from '@repo/schemas';
import {
    AccommodationService,
    AmenityService,
    ExperienceService,
    FeatureService,
    VenueService
} from '@repo/service-core';
import { z } from 'zod';
import { apiLogger } from '../../../utils/logger';

/** Accommodation service, as `routes/accommodation/protected/*` uses it. */
export const listingToolAccommodationService = new AccommodationService({ logger: apiLogger });

/** Venue service, as `routes/venue/protected/*` uses it. */
export const listingToolVenueService = new VenueService({ logger: apiLogger });

/** Experience service, as `routes/experience/protected/*` uses it. */
export const listingToolExperienceService = new ExperienceService({ logger: apiLogger });

/** Amenity catalog service, as `routes/amenity/public/list.ts` uses it. */
export const listingToolAmenityService = new AmenityService({ logger: apiLogger });

/** Feature catalog service, as `routes/feature/public/list.ts` uses it. */
export const listingToolFeatureService = new FeatureService({ logger: apiLogger });

/**
 * The verticals an owner manages listings in through the assistant tools.
 * Tourist and partner have no owner listing (spec §6.5).
 */
export const LISTING_TOOL_VERTICALS = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
] as const;

/** One of {@link LISTING_TOOL_VERTICALS}. */
export type ListingToolVertical = (typeof LISTING_TOOL_VERTICALS)[number];

/** Zod schema of {@link ListingToolVertical}, for tool inputs. */
export const ListingToolVerticalSchema = z.enum(LISTING_TOOL_VERTICALS);
