import { z } from 'zod';
import { CommerceEntityTypeEnum } from './commerce-entity-type.enum.js';

/**
 * Zod schema for {@link CommerceEntityTypeEnum} validation.
 * Accepts 'gastronomy' or 'experience'.
 */
export const CommerceEntityTypeEnumSchema = z.nativeEnum(CommerceEntityTypeEnum, {
    error: () => ({ message: 'zodError.enums.commerceEntityType.invalid' })
});
export type CommerceEntityType = z.infer<typeof CommerceEntityTypeEnumSchema>;
