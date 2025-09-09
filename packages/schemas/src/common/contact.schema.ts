import { z } from 'zod';
import { PreferredContactEnumSchema } from '../enums/index.js';
import { InternationalPhoneRegex } from '../utils/utils.js';

export const ContactInfoSchema = z.object({
    personalEmail: z
        .string()
        .email({ message: 'zodError.common.contact.personalEmail.invalid' })
        .optional(),
    workEmail: z
        .string()
        .email({ message: 'zodError.common.contact.workEmail.invalid' })
        .optional(),
    homePhone: z
        .string()
        .regex(InternationalPhoneRegex, {
            message: 'zodError.common.contact.homePhone.international'
        })
        .optional(),
    workPhone: z
        .string()
        .regex(InternationalPhoneRegex, {
            message: 'zodError.common.contact.workPhone.international'
        })
        .optional(),
    mobilePhone: z.string().regex(InternationalPhoneRegex, {
        message: 'zodError.common.contact.mobilePhone.international'
    }),
    website: z.string().url({ message: 'zodError.common.contact.website.invalid' }).optional(),
    preferredEmail: PreferredContactEnumSchema.optional(),
    preferredPhone: PreferredContactEnumSchema.optional()
});

/**
 * Base contact fields (using complete ContactInfoSchema structure)
 */
export const BaseContactFields = {
    contactInfo: ContactInfoSchema.optional()
} as const;

/**
 * Type exports for contact schemas
 */
export type BaseContactFieldsType = typeof BaseContactFields;
export type ContactInfo = z.infer<typeof ContactInfoSchema>;
