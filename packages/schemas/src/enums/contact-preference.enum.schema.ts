import { PreferredContactEnum } from '@repo/types';
import { z } from 'zod';

export const PreferredContactEnumSchema = z.nativeEnum(PreferredContactEnum, {
    error: () => ({ message: 'zodError.enums.preferredContact.invalid' })
});
