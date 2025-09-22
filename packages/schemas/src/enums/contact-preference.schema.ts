import { z } from 'zod';
import { PreferredContactEnum } from './contact-preference.enum.js';

export const PreferredContactEnumSchema = z.nativeEnum(PreferredContactEnum, {
    error: () => ({ message: 'zodError.enums.preferredContact.invalid' })
});
