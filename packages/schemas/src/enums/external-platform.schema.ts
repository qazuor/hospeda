import { z } from 'zod';
import { ExternalPlatformEnum } from './external-platform.enum.js';

/**
 * Zod schema for {@link ExternalPlatformEnum} validation.
 * Accepts GOOGLE, BOOKING, AIRBNB, or OTHER.
 */
export const ExternalPlatformEnumSchema = z.nativeEnum(ExternalPlatformEnum, {
    error: () => ({ message: 'zodError.enums.externalPlatform.invalid' })
});
export type ExternalPlatform = z.infer<typeof ExternalPlatformEnumSchema>;
