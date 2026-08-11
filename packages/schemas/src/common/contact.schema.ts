import { z } from 'zod';
import { PreferredContactEnumSchema } from '../enums/index.js';
import { InternationalPhoneRegex } from '../utils/utils.js';

/**
 * Strict WRITE shape for the shared `contactInfo` JSONB column.
 *
 * Every field is `.nullish()` rather than `.optional()`, and that is
 * load-bearing rather than cosmetic (HOS-375). `contactInfo` is a MERGEABLE
 * JSONB column on both `UserModel` and `AccommodationModel`, so a PATCH that
 * omits a key now LEAVES that key's stored value alone — which is what stops
 * the web profile form (which models only `mobilePhone`) from deleting the
 * other eight keys, `contactInfo.website` among them. The price of that merge
 * is that clearing a field can no longer be expressed by omission: it is an
 * explicit `null`. If these fields rejected `null`, every "I deleted my phone"
 * save would 400 and the field would be permanently un-clearable.
 *
 * Widening `string | undefined` to `string | null | undefined` is ADDITIVE, so
 * it is allowed under the package's compatibility policy
 * (`docs/guides/schema-compat-policy.md`): no payload that validated before
 * stops validating. The bounds themselves are untouched — a non-null
 * `mobilePhone` still has to satisfy {@link InternationalPhoneRegex}, and a
 * non-null `website` still has to be a URL.
 *
 * `preferredEmail` / `preferredPhone` are enums, not free strings, and they are
 * widened by exactly one value for the same reason: they are keys of the SAME
 * merged object, so "no preference" has to be expressible as a patch. `null`
 * and absent both mean "the user has not chosen one" — the enum has no member
 * standing for that, and no consumer distinguishes the two — so the widening
 * adds a clear path without adding a new meaning. Every real enum member stays
 * exactly as validated as before.
 */
export const ContactInfoSchema = z.object({
    personalEmail: z
        .string()
        .email({ message: 'zodError.common.contact.personalEmail.invalid' })
        .nullish(),
    workEmail: z.string().email({ message: 'zodError.common.contact.workEmail.invalid' }).nullish(),
    homePhone: z
        .string()
        .regex(InternationalPhoneRegex, {
            message: 'zodError.common.contact.homePhone.international'
        })
        .nullish(),
    workPhone: z
        .string()
        .regex(InternationalPhoneRegex, {
            message: 'zodError.common.contact.workPhone.international'
        })
        .nullish(),
    mobilePhone: z
        .string()
        .regex(InternationalPhoneRegex, {
            message: 'zodError.common.contact.mobilePhone.international'
        })
        .nullish(),
    whatsapp: z
        .string()
        .regex(InternationalPhoneRegex, {
            message: 'zodError.common.contact.whatsapp.international'
        })
        .nullish(),
    website: z.string().url({ message: 'zodError.common.contact.website.invalid' }).nullish(),
    preferredEmail: PreferredContactEnumSchema.nullish(),
    preferredPhone: PreferredContactEnumSchema.nullish()
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
 * This mirrors accommodation's `AccommodationContactInfoReadSchema` — promoted
 * here to a shared source of truth so every entity read schema can use the same
 * lenient shape. HOS-302 deleted the last duplicate (a module-private copy in
 * `user.access.schema.ts`); the user access AND query families both import this.
 *
 * The fields are `.nullish()` for a reason the WRITE shape only half explains
 * (HOS-375): once a cleared field is persisted as an explicit `null` inside the
 * merged JSONB, that JSON null is what comes BACK on every subsequent read. The
 * strip described above FAIL-CLOSES to HTTP 500 on a mismatch — so a read shape
 * that still said `string | undefined` would turn "this user once deleted their
 * phone" into a permanent 500 on their own profile GET, locking them out of
 * editing every other field. Read ⊇ write is not optional here.
 */
export const ContactInfoReadSchema = z.object({
    personalEmail: z.string().nullish(),
    workEmail: z.string().nullish(),
    homePhone: z.string().nullish(),
    workPhone: z.string().nullish(),
    mobilePhone: z.string().nullish(),
    whatsapp: z.string().nullish(),
    website: z.string().nullish(),
    preferredEmail: PreferredContactEnumSchema.nullish(),
    preferredPhone: PreferredContactEnumSchema.nullish()
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
