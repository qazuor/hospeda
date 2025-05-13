import { z } from 'zod';

/**
 * Zod schema for destination rating.
 */
export const DestinationRatingSchema = z.object({
    // Natural beauty and landscapes
    landscape: z
        .number({ required_error: 'error:destination.rating.landscape.required' })
        .min(0, { message: 'error:destination.rating.landscape.min_value' })
        .max(5, { message: 'error:destination.rating.landscape.max_value' }),
    // Quality and variety of tourist attractions
    attractions: z
        .number({ required_error: 'error:destination.rating.attractions.required' })
        .min(0, { message: 'error:destination.rating.attractions.min_value' })
        .max(5, { message: 'error:destination.rating.attractions.max_value' }),
    // Ease of access and transportation options
    accessibility: z
        .number({ required_error: 'error:destination.rating.accessibility.required' })
        .min(0, { message: 'error:destination.rating.accessibility.min_value' })
        .max(5, { message: 'error:destination.rating.accessibility.max_value' }),
    // Perceived safety of the area
    safety: z
        .number({ required_error: 'error:destination.rating.safety.required' })
        .min(0, { message: 'error:destination.rating.safety.min_value' })
        .max(5, { message: 'error:destination.rating.safety.max_value' }),
    // General cleanliness of public spaces
    cleanliness: z
        .number({ required_error: 'error:destination.rating.cleanliness.required' })
        .min(0, { message: 'error:destination.rating.cleanliness.min_value' })
        .max(5, { message: 'error:destination.rating.cleanliness.max_value' }),
    // Friendliness and warmth of locals
    hospitality: z
        .number({ required_error: 'error:destination.rating.hospitality.required' })
        .min(0, { message: 'error:destination.rating.hospitality.min_value' })
        .max(5, { message: 'error:destination.rating.hospitality.max_value' }),
    // Cultural events, museums, and local traditions
    culturalOffer: z
        .number({ required_error: 'error:destination.rating.culturalOffer.required' })
        .min(0, { message: 'error:destination.rating.culturalOffer.min_value' })
        .max(5, { message: 'error:destination.rating.culturalOffer.max_value' }),
    // Local cuisine and food options
    gastronomy: z
        .number({ required_error: 'error:destination.rating.gastronomy.required' })
        .min(0, { message: 'error:destination.rating.gastronomy.min_value' })
        .max(5, { message: 'error:destination.rating.gastronomy.max_value' }),
    // Value for money (e.g. food, attractions)
    affordability: z
        .number({ required_error: 'error:destination.rating.affordability.required' })
        .min(0, { message: 'error:destination.rating.affordability.min_value' })
        .max(5, { message: 'error:destination.rating.affordability.max_value' }),
    // Entertainment and night-time activities
    nightlife: z
        .number({ required_error: 'error:destination.rating.nightlife.required' })
        .min(0, { message: 'error:destination.rating.nightlife.min_value' })
        .max(5, { message: 'error:destination.rating.nightlife.max_value' }),
    // Roads, signage, public services condition
    infrastructure: z
        .number({ required_error: 'error:destination.rating.infrastructure.required' })
        .min(0, { message: 'error:destination.rating.infrastructure.min_value' })
        .max(5, { message: 'error:destination.rating.infrastructure.max_value' }),
    // Environmental awareness and sustainability
    environmentalCare: z
        .number({ required_error: 'error:destination.rating.environmentalCare.required' })
        .min(0, { message: 'error:destination.rating.environmentalCare.min_value' })
        .max(5, { message: 'error:destination.rating.environmentalCare.max_value' }),
    // Internet access quality and availability
    wifiAvailability: z
        .number({ required_error: 'error:destination.rating.wifiAvailability.required' })
        .min(0, { message: 'error:destination.rating.wifiAvailability.min_value' })
        .max(5, { message: 'error:destination.rating.wifiAvailability.max_value' }),
    // Variety and quality of local shops
    shopping: z
        .number({ required_error: 'error:destination.rating.shopping.required' })
        .min(0, { message: 'error:destination.rating.shopping.min_value' })
        .max(5, { message: 'error:destination.rating.shopping.max_value' }),
    // Quality and cleanliness of beaches
    beaches: z
        .number({ required_error: 'error:destination.rating.beaches.required' })
        .min(0, { message: 'error:destination.rating.beaches.min_value' })
        .max(5, { message: 'error:destination.rating.beaches.max_value' }),
    // Availability and condition of parks and green areas
    greenSpaces: z
        .number({ required_error: 'error:destination.rating.greenSpaces.required' })
        .min(0, { message: 'error:destination.rating.greenSpaces.min_value' })
        .max(5, { message: 'error:destination.rating.greenSpaces.max_value' }),
    // Local events such as festivals, fairs, parades
    localEvents: z
        .number({ required_error: 'error:destination.rating.localEvents.required' })
        .min(0, { message: 'error:destination.rating.localEvents.min_value' })
        .max(5, { message: 'error:destination.rating.localEvents.max_value' }),
    // Weather experience during the visit
    weatherSatisfaction: z
        .number({ required_error: 'error:destination.rating.weatherSatisfaction.required' })
        .min(0, { message: 'error:destination.rating.weatherSatisfaction.min_value' })
        .max(5, { message: 'error:destination.rating.weatherSatisfaction.max_value' })
});

export type DestinationRatingInput = z.infer<typeof DestinationRatingSchema>;
