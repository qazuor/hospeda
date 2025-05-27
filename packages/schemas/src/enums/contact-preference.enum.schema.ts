import { PreferredContactEnum } from '@repo/types/src/enums/contact-preference.enum';
import { z } from 'zod';

export const PreferredContactEnumSchema = z.enum(
    Object.values(PreferredContactEnum) as [string, ...string[]],
    {
        errorMap: () => ({ message: 'zodError.enums.preferredContact.invalid' })
    }
);
