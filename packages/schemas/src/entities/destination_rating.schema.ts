import type { DestinationRatingType } from '@repo/types';
import { z } from 'zod';

/**
 * Zod schema for destination rating categories.
 * All values must be between 0 and 5 inclusive.
 */
export const DestinationRatingSchema: z.ZodType<DestinationRatingType> = z.object({
    landscape: z
        .number({ required_error: 'error:destination.rating.landscapeRequired' })
        .min(0, { message: 'error:destination.rating.landscapeMin' })
        .max(5, { message: 'error:destination.rating.landscapeMax' }),
    attractions: z
        .number({ required_error: 'error:destination.rating.attractionsRequired' })
        .min(0, { message: 'error:destination.rating.attractionsMin' })
        .max(5, { message: 'error:destination.rating.attractionsMax' }),
    accessibility: z
        .number({ required_error: 'error:destination.rating.accessibilityRequired' })
        .min(0, { message: 'error:destination.rating.accessibilityMin' })
        .max(5, { message: 'error:destination.rating.accessibilityMax' }),
    safety: z
        .number({ required_error: 'error:destination.rating.safetyRequired' })
        .min(0, { message: 'error:destination.rating.safetyMin' })
        .max(5, { message: 'error:destination.rating.safetyMax' }),
    cleanliness: z
        .number({ required_error: 'error:destination.rating.cleanlinessRequired' })
        .min(0, { message: 'error:destination.rating.cleanlinessMin' })
        .max(5, { message: 'error:destination.rating.cleanlinessMax' }),
    hospitality: z
        .number({ required_error: 'error:destination.rating.hospitalityRequired' })
        .min(0, { message: 'error:destination.rating.hospitalityMin' })
        .max(5, { message: 'error:destination.rating.hospitalityMax' }),
    culturalOffer: z
        .number({ required_error: 'error:destination.rating.culturalOfferRequired' })
        .min(0, { message: 'error:destination.rating.culturalOfferMin' })
        .max(5, { message: 'error:destination.rating.culturalOfferMax' }),
    gastronomy: z
        .number({ required_error: 'error:destination.rating.gastronomyRequired' })
        .min(0, { message: 'error:destination.rating.gastronomyMin' })
        .max(5, { message: 'error:destination.rating.gastronomyMax' }),
    affordability: z
        .number({ required_error: 'error:destination.rating.affordabilityRequired' })
        .min(0, { message: 'error:destination.rating.affordabilityMin' })
        .max(5, { message: 'error:destination.rating.affordabilityMax' }),
    nightlife: z
        .number({ required_error: 'error:destination.rating.nightlifeRequired' })
        .min(0, { message: 'error:destination.rating.nightlifeMin' })
        .max(5, { message: 'error:destination.rating.nightlifeMax' }),
    infrastructure: z
        .number({ required_error: 'error:destination.rating.infrastructureRequired' })
        .min(0, { message: 'error:destination.rating.infrastructureMin' })
        .max(5, { message: 'error:destination.rating.infrastructureMax' }),
    environmentalCare: z
        .number({ required_error: 'error:destination.rating.environmentalCareRequired' })
        .min(0, { message: 'error:destination.rating.environmentalCareMin' })
        .max(5, { message: 'error:destination.rating.environmentalCareMax' }),
    wifiAvailability: z
        .number({ required_error: 'error:destination.rating.wifiAvailabilityRequired' })
        .min(0, { message: 'error:destination.rating.wifiAvailabilityMin' })
        .max(5, { message: 'error:destination.rating.wifiAvailabilityMax' }),
    shopping: z
        .number({ required_error: 'error:destination.rating.shoppingRequired' })
        .min(0, { message: 'error:destination.rating.shoppingMin' })
        .max(5, { message: 'error:destination.rating.shoppingMax' }),
    beaches: z
        .number({ required_error: 'error:destination.rating.beachesRequired' })
        .min(0, { message: 'error:destination.rating.beachesMin' })
        .max(5, { message: 'error:destination.rating.beachesMax' }),
    greenSpaces: z
        .number({ required_error: 'error:destination.rating.greenSpacesRequired' })
        .min(0, { message: 'error:destination.rating.greenSpacesMin' })
        .max(5, { message: 'error:destination.rating.greenSpacesMax' }),
    localEvents: z
        .number({ required_error: 'error:destination.rating.localEventsRequired' })
        .min(0, { message: 'error:destination.rating.localEventsMin' })
        .max(5, { message: 'error:destination.rating.localEventsMax' }),
    weatherSatisfaction: z
        .number({ required_error: 'error:destination.rating.weatherSatisfactionRequired' })
        .min(0, { message: 'error:destination.rating.weatherSatisfactionMin' })
        .max(5, { message: 'error:destination.rating.weatherSatisfactionMax' })
});
