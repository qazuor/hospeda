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
    mobilePhone: z
        .string()
        .regex(InternationalPhoneRegex, {
            message: 'zodError.common.contact.mobilePhone.international'
        })
        .optional(),
    whatsapp: z
        .string()
        .regex(InternationalPhoneRegex, {
            message: 'zodError.common.contact.whatsapp.international'
        })
        .optional(),
    website: z.string().url({ message: 'zodError.common.contact.website.invalid' }).optional(),
    preferredEmail: PreferredContactEnumSchema.optional(),
    preferredPhone: PreferredContactEnumSchema.optional()
});
export type ContactInfo = z.infer<typeof ContactInfoSchema>;

/**
 * Lenient READ overlay for `contactInfo` (HOS-190).
 *
 * API responses are stripped against their declared schema by `stripWithSchema`
 * (`apps/api/src/utils/response-helpers.ts`), which FAIL-CLOSES to HTTP 500 when
 * a stored row does not satisfy the schema. `contact_info` is an unbounded JSONB
 * column shallow-merged at the DB layer (`jsonb-merge.ts`), so a legacy/imported/
 * partially-edited row can legitimately hold a phone in a format the strict WRITE
 * regex rejects (an AR local `0223-155-1234`, a bare `+54`, embedded spaces) — or
 * omit `mobilePhone` entirely. Reading such a row must NEVER 500, so response
 * schemas assert TYPE + PRESENCE only for the free-form contact fields; the phone
 * format stays enforced on the WRITE path via {@link ContactInfoSchema}.
 *
 * This mirrors accommodation's `AccommodationContactInfoReadSchema` and user's
 * local `ContactInfoReadSchema` — promoted here to a shared source of truth so
 * every entity read schema can use the same lenient shape.
 */
export const ContactInfoReadSchema = z.object({
    personalEmail: z.string().optional(),
    workEmail: z.string().optional(),
    homePhone: z.string().optional(),
    workPhone: z.string().optional(),
    mobilePhone: z.string().optional(),
    whatsapp: z.string().optional(),
    website: z.string().optional(),
    preferredEmail: PreferredContactEnumSchema.optional(),
    preferredPhone: PreferredContactEnumSchema.optional()
});
export type ContactInfoRead = z.infer<typeof ContactInfoReadSchema>;

/**
 * Base contact fields (using complete ContactInfoSchema structure).
 *
 * WRITE-side shape: derived entity CREATE/UPDATE schemas inherit the strict
 * `ContactInfoSchema` (phone/URL format enforced). Read schemas override
 * `contactInfo` with {@link ContactInfoReadSchema} so persisted data never 500s.
 */
export const BaseContactFields = {
    contactInfo: ContactInfoSchema.nullish()
} as const;
export type BaseContactFieldsType = typeof BaseContactFields;
