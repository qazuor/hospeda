import { z } from 'zod';
import { isValidLatitude, isValidLongitude } from '../utils/utils.js';

/**
 * Coordinates Schema
 * Represents geographic coordinates with latitude and longitude
 * Matches CoordinatesType from @repo/types
 */
export const CoordinatesSchema = z.object({
    lat: z
        .string({
            message: 'zodError.common.location.coordinates.lat.required'
        })
        .refine(isValidLatitude, {
            message: 'zodError.common.location.coordinates.lat.invalidValue'
        }),
    long: z
        .string({
            message: 'zodError.common.location.coordinates.long.required'
        })
        .refine(isValidLongitude, {
            message: 'zodError.common.location.coordinates.long.invalidValue'
        })
});

/**
 * Base Location Schema
 * Represents basic location information without full address details
 * Matches BaseLocationType from @repo/types
 */
export const BaseLocationSchema = z.object({
    state: z
        .string({
            message: 'zodError.common.location.state.required'
        })
        .min(2, { message: 'zodError.common.location.state.min' })
        .max(50, { message: 'zodError.common.location.state.max' }),
    zipCode: z
        .string({
            message: 'zodError.common.location.zipCode.required'
        })
        .min(1, { message: 'zodError.common.location.zipCode.min' })
        .max(20, { message: 'zodError.common.location.zipCode.max' }),
    country: z
        .string({
            message: 'zodError.common.location.country.required'
        })
        .min(2, { message: 'zodError.common.location.country.min' })
        .max(50, { message: 'zodError.common.location.country.max' }),
    coordinates: CoordinatesSchema.optional()
});

/**
 * Full Location Schema
 * Represents complete location information with full address details
 * Matches FullLocationType from @repo/types
 */
export const FullLocationSchema = BaseLocationSchema.extend({
    street: z
        .string({
            message: 'zodError.common.location.street.required'
        })
        .min(2, { message: 'zodError.common.location.street.min' })
        .max(50, { message: 'zodError.common.location.street.max' }),
    number: z
        .string({
            message: 'zodError.common.location.number.required'
        })
        .min(1, { message: 'zodError.common.location.number.min' })
        .max(10, { message: 'zodError.common.location.number.max' }),
    floor: z
        .string({
            message: 'zodError.common.location.floor.required'
        })
        .min(1, { message: 'zodError.common.location.floor.min' })
        .max(10, { message: 'zodError.common.location.floor.max' })
        .optional(),
    apartment: z
        .string({
            message: 'zodError.common.location.apartment.required'
        })
        .min(1, { message: 'zodError.common.location.apartment.min' })
        .max(10, { message: 'zodError.common.location.apartment.max' })
        .optional(),
    neighborhood: z
        .string({
            message: 'zodError.common.location.neighborhood.required'
        })
        .min(2, { message: 'zodError.common.location.neighborhood.min' })
        .max(50, { message: 'zodError.common.location.neighborhood.max' })
        .optional(),
    city: z
        .string({
            message: 'zodError.common.location.city.required'
        })
        .min(2, { message: 'zodError.common.location.city.min' })
        .max(50, { message: 'zodError.common.location.city.max' }),
    department: z
        .string({
            message: 'zodError.common.location.department.required'
        })
        .min(2, { message: 'zodError.common.location.department.min' })
        .max(50, { message: 'zodError.common.location.department.max' })
        .optional()
});

/**
 * Base location fields (using BaseLocationSchema structure)
 */
export const BaseLocationFields = {
    location: BaseLocationSchema.optional()
} as const;

/**
 * Full location fields (using FullLocationSchema structure)
 */
export const FullLocationFields = {
    location: FullLocationSchema.optional()
} as const;

/**
 * Type exports for location schemas
 */
export type BaseLocationFieldsType = typeof BaseLocationFields;
export type FullLocationFieldsType = typeof FullLocationFields;
export type Coordinates = z.infer<typeof CoordinatesSchema>;
export type BaseLocation = z.infer<typeof BaseLocationSchema>;
export type FullLocation = z.infer<typeof FullLocationSchema>;
