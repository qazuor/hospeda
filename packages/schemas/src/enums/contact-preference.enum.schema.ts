import { PreferredContactEnum } from '@repo/types';
import { z } from 'zod';

export const PreferredContactEnumSchema = z.nativeEnum(PreferredContactEnum, {
    errorMap: () => ({ message: 'zodError.enums.preferredContact.invalid' })
});
