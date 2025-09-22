import { z } from 'zod';
import { VisibilityEnum } from './visibility.enum.js';

export const VisibilityEnumSchema = z.nativeEnum(VisibilityEnum, {
    error: () => ({ message: 'zodError.enums.visibility.invalid' })
});
export type Visibility = z.infer<typeof VisibilityEnumSchema>;
