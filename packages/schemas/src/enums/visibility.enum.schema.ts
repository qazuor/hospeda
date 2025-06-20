import { VisibilityEnum } from '@repo/types';
import { z } from 'zod';

export const VisibilityEnumSchema = z.nativeEnum(VisibilityEnum, {
    errorMap: () => ({ message: 'zodError.enums.visibility.invalid' })
});
