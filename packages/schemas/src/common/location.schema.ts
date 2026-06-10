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
 * User Location Schema
 *
 * Dedicated, fully-optional location shape for the **user profile** surface
 * (onboarding "complete profile" + `/mi-cuenta/editar` + admin profile).
 *
 * Why a separate schema instead of {@link FullLocationSchema}: a user profile
 * is a lightweight, free-text postal address. `FullLocationSchema` requires
 * `street` and `number` (designed for accommodations/events), so validating a
 * user PATCH against it rejected every profile-location edit with a 400 even
 * for valid data (BETA-34).
 *
 * Field names match what is **actually stored and submitted** for users:
 *   - the onboarding flow persists `{ country, region, city }`
 *     (see `BriefLocationSchema` in `user.profile-completion.schema.ts`);
 *   - the web edit form additionally submits `addressLine1` and `postalCode`.
 *
 * The `users.location` column is a free-form JSONB typed as this shape, so no
 * data migration is required — existing onboarding rows (`country/region/city`)
 * remain valid, and the two extra postal fields are additive.
 *
 * All fields are optional: a profile may carry any subset (or none) of them.
 */
export const UserLocationSchema = z.object({
    country: z
        .string({ message: 'zodError.common.location.country.required' })
        .min(2, { message: 'zodError.common.location.country.min' })
        .max(100, { message: 'zodError.common.location.country.max' })
        .optional(),
    region: z
        .string({ message: 'zodError.common.location.region.required' })
        .min(1, { message: 'zodError.common.location.region.min' })
        .max(100, { message: 'zodError.common.location.region.max' })
        .optional(),
    city: z
        .string({ message: 'zodError.common.location.city.required' })
        .min(1, { message: 'zodError.common.location.city.min' })
        .max(100, { message: 'zodError.common.location.city.max' })
        .optional(),
    addressLine1: z
        .string({ message: 'zodError.common.location.addressLine1.required' })
        .max(200, { message: 'zodError.common.location.addressLine1.max' })
        .optional(),
    postalCode: z
        .string({ message: 'zodError.common.location.postalCode.required' })
        .max(20, { message: 'zodError.common.location.postalCode.max' })
        .optional()
});
export type UserLocationType = z.infer<typeof UserLocationSchema>;

/**
 * User location field (using UserLocationSchema structure).
 *
 * `nullish()` so an edit-mode form rehydrating from a row whose `location`
 * column is `NULL` does not fail Zod validation.
 */
export const UserLocationFields = {
    location: UserLocationSchema.nullish()
} as const;
export type UserLocationFieldsType = typeof UserLocationFields;

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
