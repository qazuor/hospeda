import { z } from 'zod';

const isValidLatitude = (val: string) => {
    const n = Number(val);
    return !Number.isNaN(n) && n >= -90 && n <= 90;
};
const isValidLongitude = (val: string) => {
    const n = Number(val);
    return !Number.isNaN(n) && n >= -180 && n <= 180;
};

const CoordinatesSchema = z.object({
    lat: z
        .string({
            required_error: 'zodError.common.location.coordinates.lat.required',
            invalid_type_error: 'zodError.common.location.coordinates.lat.invalidType'
        })
        .refine(isValidLatitude, {
            message: 'zodError.common.location.coordinates.lat.invalidValue'
        }),
    long: z
        .string({
            required_error: 'zodError.common.location.coordinates.long.required',
            invalid_type_error: 'zodError.common.location.coordinates.long.invalidType'
        })
        .refine(isValidLongitude, {
            message: 'zodError.common.location.coordinates.long.invalidValue'
        })
});

export const LocationSchema = z.object({
    state: z
        .string({
            required_error: 'zodError.common.location.state.required',
            invalid_type_error: 'zodError.common.location.state.invalidType'
        })
        .min(2, { message: 'zodError.common.location.state.min' })
        .max(50, { message: 'zodError.common.location.state.max' }),
    zipCode: z
        .string({
            required_error: 'zodError.common.location.zipCode.required',
            invalid_type_error: 'zodError.common.location.zipCode.invalidType'
        })
        .min(1, { message: 'zodError.common.location.zipCode.min' })
        .max(20, { message: 'zodError.common.location.zipCode.max' }),
    country: z
        .string({
            required_error: 'zodError.common.location.country.required',
            invalid_type_error: 'zodError.common.location.country.invalidType'
        })
        .min(2, { message: 'zodError.common.location.country.min' })
        .max(50, { message: 'zodError.common.location.country.max' }),
    coordinates: CoordinatesSchema.optional(),
    street: z
        .string({
            required_error: 'zodError.common.location.street.required',
            invalid_type_error: 'zodError.common.location.street.invalidType'
        })
        .min(2, { message: 'zodError.common.location.street.min' })
        .max(50, { message: 'zodError.common.location.street.max' }),
    number: z
        .string({
            required_error: 'zodError.common.location.number.required',
            invalid_type_error: 'zodError.common.location.number.invalidType'
        })
        .min(1, { message: 'zodError.common.location.number.min' })
        .max(10, { message: 'zodError.common.location.number.max' }),
    floor: z
        .string({
            required_error: 'zodError.common.location.floor.required',
            invalid_type_error: 'zodError.common.location.floor.invalidType'
        })
        .min(1, { message: 'zodError.common.location.floor.min' })
        .max(10, { message: 'zodError.common.location.floor.max' })
        .optional(),
    apartment: z
        .string({
            required_error: 'zodError.common.location.apartment.required',
            invalid_type_error: 'zodError.common.location.apartment.invalidType'
        })
        .min(1, { message: 'zodError.common.location.apartment.min' })
        .max(10, { message: 'zodError.common.location.apartment.max' })
        .optional(),
    neighborhood: z
        .string({
            required_error: 'zodError.common.location.neighborhood.required',
            invalid_type_error: 'zodError.common.location.neighborhood.invalidType'
        })
        .min(2, { message: 'zodError.common.location.neighborhood.min' })
        .max(50, { message: 'zodError.common.location.neighborhood.max' })
        .optional(),
    city: z
        .string({
            required_error: 'zodError.common.location.city.required',
            invalid_type_error: 'zodError.common.location.city.invalidType'
        })
        .min(2, { message: 'zodError.common.location.city.min' })
        .max(50, { message: 'zodError.common.location.city.max' }),
    department: z
        .string({
            required_error: 'zodError.common.location.department.required',
            invalid_type_error: 'zodError.common.location.department.invalidType'
        })
        .min(2, { message: 'zodError.common.location.department.min' })
        .max(50, { message: 'zodError.common.location.department.max' })
        .optional()
});
