import { z } from 'zod';
import { SocialRecurrenceTypeEnum } from './social-recurrence-type.enum.js';

/**
 * Zod schema for {@link SocialRecurrenceTypeEnum} validation.
 * Accepts all 4 recurrence cadence values.
 */
export const SocialRecurrenceTypeEnumSchema = z.nativeEnum(SocialRecurrenceTypeEnum, {
    error: () => ({ message: 'zodError.enums.socialRecurrenceType.invalid' })
});

/** TypeScript type inferred from {@link SocialRecurrenceTypeEnumSchema}. */
export type SocialRecurrenceType = z.infer<typeof SocialRecurrenceTypeEnumSchema>;
