import { z } from 'zod';
import { AmenityScopeEnum } from './amenity-scope.enum.js';

/** Zod schema for {@link AmenityScopeEnum} (HOS-2058). */
export const AmenityScopeEnumSchema = z.nativeEnum(AmenityScopeEnum, {
    error: () => ({ message: 'zodError.enums.amenityScope.invalid' })
});
/** Inferred type of {@link AmenityScopeEnumSchema}. */
export type AmenityScopeSchema = z.infer<typeof AmenityScopeEnumSchema>;
