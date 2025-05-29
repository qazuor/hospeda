import { PreferredContactEnum } from '@repo/types';
import { z } from 'zod';

export const PreferredContactEnumSchema = z.enum(
    Object.values(PreferredContactEnum) as [string, ...string[]],
    {
        errorMap: () => ({ message: 'zodError.enums.preferredContact.invalid' })
    }
);
