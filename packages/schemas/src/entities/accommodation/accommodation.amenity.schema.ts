import { z } from 'zod';
import { AdminInfoSchema } from '../../common/admin.schema.js';
import { PriceSchema } from '../../common/price.schema.js';
import { ModerationStatusEnumSchema } from '../../enums/index.js';
import { AmenitySchema } from './amenity.schema.js';

/**
 * Note: This schema is defined by explicitly listing all properties instead of merging
 * helper schemas. This approach is a deliberate architectural choice to prevent
 * circular dependency issues that can arise in testing frameworks like Vitest.
 */
export const AccommodationAmenitySchema = z.object({
    // From WithModerationStatusSchema
    moderationState: ModerationStatusEnumSchema,
    // From WithAdminInfoSchema
    adminInfo: AdminInfoSchema.optional(),

    // Own Properties
    /** Accommodation ID this amenity belongs to */
    accommodationId: z.string({
        required_error: 'zodError.accommodation.amenity.accommodationId.required',
        invalid_type_error: 'zodError.accommodation.amenity.accommodationId.invalidType'
    }),
    /** Amenity ID */
    amenityId: z.string({
        required_error: 'zodError.accommodation.amenity.amenityId.required',
        invalid_type_error: 'zodError.accommodation.amenity.amenityId.invalidType'
    }),
    /** Whether the amenity is optional for the guest */
    isOptional: z.boolean({
        required_error: 'zodError.accommodation.amenity.isOptional.required',
        invalid_type_error: 'zodError.accommodation.amenity.isOptional.invalidType'
    }),
    /** Additional cost for this amenity, optional */
    additionalCost: PriceSchema.optional(),
    /** Additional cost as a percent, optional (0-100) */
    additionalCostPercent: z
        .number({
            required_error: 'zodError.accommodation.amenity.additionalCostPercent.required',
            invalid_type_error: 'zodError.accommodation.amenity.additionalCostPercent.invalidType'
        })
        .min(0, { message: 'zodError.accommodation.amenity.additionalCostPercent.min' })
        .max(100, { message: 'zodError.accommodation.amenity.additionalCostPercent.max' })
        .optional(),
    /** Amenity object, optional */
    amenity: AmenitySchema.optional()
});
