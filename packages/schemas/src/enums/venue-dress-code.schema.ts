import { z } from 'zod';
import { VenueDressCodeEnum } from './venue-dress-code.enum.js';

/**
 * Zod schema for {@link VenueDressCodeEnum} validation.
 * Accepts only the four declared dress-code values.
 */
export const VenueDressCodeEnumSchema = z.nativeEnum(VenueDressCodeEnum, {
    error: () => ({ message: 'zodError.enums.venueDressCode.invalid' })
});
export type VenueDressCode = z.infer<typeof VenueDressCodeEnumSchema>;
