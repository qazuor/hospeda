import { z } from 'zod';

/**
 * Destination Rating schema definition using Zod for validation.
 * Represents the rating breakdown for a destination (e.g., cleanliness, hospitality, etc.).
 */
export const DestinationRatingSchema = z.object({
    landscape: z
        .number()
        .min(0, { message: 'error:destination.rating.landscape.min' })
        .max(5, { message: 'error:destination.rating.landscape.max' }),
    attractions: z
        .number()
        .min(0, { message: 'error:destination.rating.attractions.min' })
        .max(5, { message: 'error:destination.rating.attractions.max' }),
    accessibility: z
        .number()
        .min(0, { message: 'error:destination.rating.accessibility.min' })
        .max(5, { message: 'error:destination.rating.accessibility.max' }),
    safety: z
        .number()
        .min(0, { message: 'error:destination.rating.safety.min' })
        .max(5, { message: 'error:destination.rating.safety.max' }),
    cleanliness: z
        .number()
        .min(0, { message: 'error:destination.rating.cleanliness.min' })
        .max(5, { message: 'error:destination.rating.cleanliness.max' }),
    hospitality: z
        .number()
        .min(0, { message: 'error:destination.rating.hospitality.min' })
        .max(5, { message: 'error:destination.rating.hospitality.max' }),
    culturalOffer: z
        .number()
        .min(0, { message: 'error:destination.rating.culturalOffer.min' })
        .max(5, { message: 'error:destination.rating.culturalOffer.max' }),
    gastronomy: z
        .number()
        .min(0, { message: 'error:destination.rating.gastronomy.min' })
        .max(5, { message: 'error:destination.rating.gastronomy.max' }),
    affordability: z
        .number()
        .min(0, { message: 'error:destination.rating.affordability.min' })
        .max(5, { message: 'error:destination.rating.affordability.max' }),
    nightlife: z
        .number()
        .min(0, { message: 'error:destination.rating.nightlife.min' })
        .max(5, { message: 'error:destination.rating.nightlife.max' }),
    infrastructure: z
        .number()
        .min(0, { message: 'error:destination.rating.infrastructure.min' })
        .max(5, { message: 'error:destination.rating.infrastructure.max' }),
    environmentalCare: z
        .number()
        .min(0, { message: 'error:destination.rating.environmentalCare.min' })
        .max(5, { message: 'error:destination.rating.environmentalCare.max' }),
    wifiAvailability: z
        .number()
        .min(0, { message: 'error:destination.rating.wifiAvailability.min' })
        .max(5, { message: 'error:destination.rating.wifiAvailability.max' }),
    shopping: z
        .number()
        .min(0, { message: 'error:destination.rating.shopping.min' })
        .max(5, { message: 'error:destination.rating.shopping.max' }),
    beaches: z
        .number()
        .min(0, { message: 'error:destination.rating.beaches.min' })
        .max(5, { message: 'error:destination.rating.beaches.max' }),
    greenSpaces: z
        .number()
        .min(0, { message: 'error:destination.rating.greenSpaces.min' })
        .max(5, { message: 'error:destination.rating.greenSpaces.max' }),
    localEvents: z
        .number()
        .min(0, { message: 'error:destination.rating.localEvents.min' })
        .max(5, { message: 'error:destination.rating.localEvents.max' }),
    weatherSatisfaction: z
        .number()
        .min(0, { message: 'error:destination.rating.weatherSatisfaction.min' })
        .max(5, { message: 'error:destination.rating.weatherSatisfaction.max' })
});

export type DestinationRatingInput = z.infer<typeof DestinationRatingSchema>;
