import { z } from 'zod';
import { isValidLatitude, isValidLongitude } from '../utils/utils.js';

/**
 * Approximate Location Schema
 * Privacy-aware obfuscated coordinates for public exposure of accommodation
 * locations. Computed deterministically server-side from exact coordinates and
 * a secret salt; the real coordinates are never exposed alongside this object.
 *
 * The frontend renders a circle of `radiusMeters` centered on `(lat, lng)`
 * instead of a precise pin. See `obfuscateCoordinates` in
 * `@repo/service-core/utils/location-obfuscation` for the algorithm.
 */
export const ApproximateLocationSchema = z.object({
    lat: z
        .number({ message: 'zodError.common.approximateLocation.lat.required' })
        .min(-90, { message: 'zodError.common.approximateLocation.lat.min' })
        .max(90, { message: 'zodError.common.approximateLocation.lat.max' }),
    lng: z
        .number({ message: 'zodError.common.approximateLocation.lng.required' })
        .min(-180, { message: 'zodError.common.approximateLocation.lng.min' })
        .max(180, { message: 'zodError.common.approximateLocation.lng.max' }),
    radiusMeters: z
        .number({
            message: 'zodError.common.approximateLocation.radiusMeters.required'
        })
        .int({ message: 'zodError.common.approximateLocation.radiusMeters.int' })
        .positive({
            message: 'zodError.common.approximateLocation.radiusMeters.positive'
        })
});
export type ApproximateLocationType = z.infer<typeof ApproximateLocationSchema>;

/**
 * Coordinates Schema
 * Represents geographic coordinates with latitude and longitude
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
export type CoordinatesType = z.infer<typeof CoordinatesSchema>;

/**
 * Base Location Schema
 * Represents basic location information without full address details
 */
export const BaseLocationSchema = z.object({
    state: z
        .string({
            message: 'zodError.common.location.state.required'
        })
        .min(2, { message: 'zodError.common.location.state.min' })
        .max(50, { message: 'zodError.common.location.state.max' })
        .nullable()
        .optional(),
    zipCode: z
        .string({
            message: 'zodError.common.location.zipCode.required'
        })
        .min(1, { message: 'zodError.common.location.zipCode.min' })
        .max(20, { message: 'zodError.common.location.zipCode.max' })
        .nullable()
        .optional(),
    country: z
        .string({
            message: 'zodError.common.location.country.required'
        })
        .min(2, { message: 'zodError.common.location.country.min' })
        .max(50, { message: 'zodError.common.location.country.max' })
        .nullable()
        .optional(),
    coordinates: CoordinatesSchema.optional()
});
export type BaseLocationType = z.infer<typeof BaseLocationSchema>;

/**
 * Full Location Schema
 * Represents complete location information with full address details
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
export type FullLocationType = z.infer<typeof FullLocationSchema>;

/**
 * Base location fields (using BaseLocationSchema structure)
 */
export const BaseLocationFields = {
    location: BaseLocationSchema.optional()
} as const;
export type BaseLocationFieldsType = typeof BaseLocationFields;

/**
 * Full location fields (using FullLocationSchema structure)
 */
export const FullLocationFields = {
    location: FullLocationSchema.nullish()
} as const;
export type FullLocationFieldsType = typeof FullLocationFields;
