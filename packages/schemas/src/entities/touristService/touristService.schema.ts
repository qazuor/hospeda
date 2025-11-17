import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { ClientIdSchema, TouristServiceIdSchema } from '../../common/id.schema.js';
import { TouristServiceCategorySchema } from '../../enums/tourist-service-category.schema.js';

/**
 * Difficulty Level Enum Schema
 */
export const ServiceDifficultySchema = z.enum(['easy', 'moderate', 'hard'], {
    message: 'zodError.touristService.difficulty.invalid'
});

export type ServiceDifficulty = z.infer<typeof ServiceDifficultySchema>;

/**
 * Seasonality Schema
 */
export const SeasonalitySchema = z.object({
    startMonth: z
        .number()
        .int()
        .min(1, { message: 'zodError.touristService.seasonality.startMonth.min' })
        .max(12, { message: 'zodError.touristService.seasonality.startMonth.max' })
        .optional(),
    endMonth: z
        .number()
        .int()
        .min(1, { message: 'zodError.touristService.seasonality.endMonth.min' })
        .max(12, { message: 'zodError.touristService.seasonality.endMonth.max' })
        .optional()
});

export type Seasonality = z.infer<typeof SeasonalitySchema>;

/**
 * Tourist Service Details Schema
 * Comprehensive information about the service characteristics and requirements
 */
export const TouristServiceDetailsSchema = z
    .object({
        duration: z
            .string()
            .max(100, { message: 'zodError.touristService.details.duration.max' })
            .optional(),
        maxParticipants: z
            .number()
            .int()
            .positive({ message: 'zodError.touristService.details.maxParticipants.positive' })
            .optional(),
        minAge: z
            .number()
            .int()
            .nonnegative({ message: 'zodError.touristService.details.minAge.nonnegative' })
            .optional(),
        maxAge: z
            .number()
            .int()
            .positive({ message: 'zodError.touristService.details.maxAge.positive' })
            .optional(),
        difficulty: ServiceDifficultySchema.optional(),
        languages: z
            .array(
                z
                    .string()
                    .min(2, { message: 'zodError.touristService.details.languages.min' })
                    .max(50, { message: 'zodError.touristService.details.languages.max' })
            )
            .optional(),
        included: z
            .array(
                z
                    .string()
                    .min(1, { message: 'zodError.touristService.details.included.min' })
                    .max(200, { message: 'zodError.touristService.details.included.max' })
            )
            .optional(),
        excluded: z
            .array(
                z
                    .string()
                    .min(1, { message: 'zodError.touristService.details.excluded.min' })
                    .max(200, { message: 'zodError.touristService.details.excluded.max' })
            )
            .optional(),
        requirements: z
            .array(
                z
                    .string()
                    .min(1, { message: 'zodError.touristService.details.requirements.min' })
                    .max(200, { message: 'zodError.touristService.details.requirements.max' })
            )
            .optional(),
        meetingPoint: z
            .string()
            .max(500, { message: 'zodError.touristService.details.meetingPoint.max' })
            .optional(),
        pickupAvailable: z.boolean().optional(),
        cancelationPolicy: z
            .string()
            .max(1000, { message: 'zodError.touristService.details.cancelationPolicy.max' })
            .optional(),
        operatingDays: z
            .array(
                z
                    .string()
                    .min(1, { message: 'zodError.touristService.details.operatingDays.min' })
                    .max(20, { message: 'zodError.touristService.details.operatingDays.max' })
            )
            .optional(),
        operatingHours: z
            .string()
            .max(100, { message: 'zodError.touristService.details.operatingHours.max' })
            .optional(),
        seasonality: SeasonalitySchema.optional()
    })
    .optional();

export type TouristServiceDetails = z.infer<typeof TouristServiceDetailsSchema>;

/**
 * TouristService Schema - Tourist services offered by clients
 *
 * Represents tours, activities, experiences, and services offered to tourists
 * such as city tours, adventure activities, cultural experiences, etc.
 */
export const TouristServiceSchema = z.object({
    // Base fields
    id: TouristServiceIdSchema,
    ...BaseAuditFields,

    // Owner relationship
    clientId: ClientIdSchema,

    // Service information
    name: z
        .string({ message: 'zodError.touristService.name.required' })
        .min(1, { message: 'zodError.touristService.name.min' })
        .max(255, { message: 'zodError.touristService.name.max' }),

    category: TouristServiceCategorySchema,

    description: z
        .string()
        .max(2000, { message: 'zodError.touristService.description.max' })
        .optional(),

    // Service details
    serviceDetails: TouristServiceDetailsSchema,

    // Contact and location
    contactInfo: z
        .string()
        .max(500, { message: 'zodError.touristService.contactInfo.max' })
        .optional(),

    location: z.string().max(500, { message: 'zodError.touristService.location.max' }).optional(),

    // Admin metadata
    ...BaseAdminFields
});

export type TouristService = z.infer<typeof TouristServiceSchema>;
