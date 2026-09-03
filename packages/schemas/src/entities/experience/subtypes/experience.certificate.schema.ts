/**
 * The certificate an experience provider issues to a person who did the
 * experience (HOS-1057).
 *
 * ---
 * WHY THE MODEL IS THIS SMALL
 *
 * The issue asks for "a quién, de qué experiencia, cuándo" and nothing more,
 * and that restraint is the design rather than a first cut. A certificate is a
 * souvenir, not a booking: it does not need a price, a party size, a guide, or
 * a state machine. Every column here answers one of those three questions or
 * is audit.
 *
 * ## `recipientName` is hostile input, and it is treated as such
 *
 * The provider TYPES the name — there is no account behind it, because the
 * person who went fishing for an afternoon is usually not a Hospeda user. That
 * string is then drawn into a PDF the provider hands to a stranger, so it is
 * bounded here (1..120 characters, no control characters) rather than at the
 * renderer. `toDrawableText` in `apps/api` is the second line and not the
 * first: it substitutes what a standard PDF face cannot encode, which is a
 * typography concern, not a validation one.
 *
 * ## There is no share token, on purpose
 *
 * A certificate is readable by its issuing owner and by nobody else — see the
 * module doc of
 * `apps/api/src/services/experience-certificate/certificate-response.ts` for
 * the decision and its reasoning. So this schema has no `code`, no `token` and
 * no public URL column: the artifact that travels is the PDF file, and the only
 * link it carries is a QR back to the experience's own public page. Adding a
 * token later is an additive migration; removing one that leaked is not.
 *
 * @module entities/experience/subtypes/experience.certificate.schema
 */

import { z } from 'zod';
import { WithAuditSchema } from '../../../common/helpers.schema.js';

/**
 * Longest name a certificate may carry.
 *
 * Generous enough for a full legal name with two surnames and an accent-heavy
 * spelling, short enough that the PDF's single-line recipient field cannot be
 * turned into a paragraph of injected copy.
 */
export const EXPERIENCE_CERTIFICATE_NAME_MAX_LENGTH = 120;

/**
 * The recipient's name, validated once here for every caller.
 *
 * Rejects control characters outright rather than stripping them: a name
 * carrying `\r\n` is either a mistake or an attempt at header injection on the
 * `Content-Disposition` the PDF route writes, and silently repairing it would
 * hide both.
 */
export const ExperienceCertificateRecipientNameSchema = z
    .string()
    .trim()
    .min(1, { message: 'zodError.experienceCertificate.recipientName.required' })
    .max(EXPERIENCE_CERTIFICATE_NAME_MAX_LENGTH, {
        message: 'zodError.experienceCertificate.recipientName.tooLong'
    })
    // Tested by code point rather than by a regex character class: the class
    // would need literal control characters in the source, which Biome's
    // `noControlCharactersInRegex` refuses and a reviewer cannot see anyway.
    .refine(
        (value) =>
            ![...value].some((char) => {
                const code = char.codePointAt(0) ?? 0;
                return code < 0x20 || code === 0x7f;
            }),
        { message: 'zodError.experienceCertificate.recipientName.invalidCharacters' }
    );

/** The day the person actually did the experience, as `YYYY-MM-DD`. */
export const ExperienceCertificateCompletedAtSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'zodError.experienceCertificate.completedAt.format'
});

/** One issued certificate, as the database stores it. */
export const ExperienceCertificateSchema = WithAuditSchema.extend({
    /** Certificate id (UUID). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    /** The experience the certificate attests to. */
    experienceId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    /** Who it was issued to, as the provider typed it. */
    recipientName: ExperienceCertificateRecipientNameSchema,

    /** The day they did it. */
    completedAt: ExperienceCertificateCompletedAtSchema,

    /** When the provider pressed the button. Server-decided, never client-sent. */
    issuedAt: z.date()
});

/** TypeScript type for {@link ExperienceCertificateSchema}. */
export type ExperienceCertificate = z.infer<typeof ExperienceCertificateSchema>;

/**
 * What a client may send to issue one.
 *
 * Spelled out rather than derived with `.omit()`, deliberately. An `.omit()`
 * accepts everything it does not name, so a column added to the base schema
 * later would become client-writable by silence — and two of this entity's five
 * columns (`experienceId`, `issuedAt`) are server-decided precisely because
 * letting a client choose them is how a provider issues a certificate for
 * somebody else's experience, backdated.
 */
export const ExperienceCertificateCreateInputSchema = z
    .object({
        recipientName: ExperienceCertificateRecipientNameSchema,
        completedAt: ExperienceCertificateCompletedAtSchema
    })
    .strict();

/** TypeScript type for {@link ExperienceCertificateCreateInputSchema}. */
export type ExperienceCertificateCreateInput = z.infer<
    typeof ExperienceCertificateCreateInputSchema
>;

/**
 * What may be corrected after the fact.
 *
 * A mistyped name is the one realistic edit, so both fields stay editable and
 * nothing else is. Same `.strict()` spelling as the create input, for the same
 * reason.
 */
export const ExperienceCertificateUpdateInputSchema = z
    .object({
        recipientName: ExperienceCertificateRecipientNameSchema.optional(),
        completedAt: ExperienceCertificateCompletedAtSchema.optional()
    })
    .strict();

/** TypeScript type for {@link ExperienceCertificateUpdateInputSchema}. */
export type ExperienceCertificateUpdateInput = z.infer<
    typeof ExperienceCertificateUpdateInputSchema
>;

/**
 * What the service layer receives to issue one.
 *
 * The client payload ({@link ExperienceCertificateCreateInputSchema}) plus the
 * listing, which the ROUTE supplies from the path after establishing that the
 * listing is the caller's. Keeping `experienceId` out of the body and in the
 * path is what makes "issue a certificate on somebody else's listing"
 * unspellable rather than merely refused.
 */
export const ExperienceCertificateIssueInputSchema = z.object({
    experienceId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    recipientName: ExperienceCertificateRecipientNameSchema,
    completedAt: ExperienceCertificateCompletedAtSchema
});

/** TypeScript type for {@link ExperienceCertificateIssueInputSchema}. */
export type ExperienceCertificateIssueInput = z.infer<typeof ExperienceCertificateIssueInputSchema>;

/** What the service layer receives to list a listing's certificates. */
export const ExperienceCertificateListInputSchema = z.object({
    experienceId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20)
});

/** TypeScript type for {@link ExperienceCertificateListInputSchema}. */
export type ExperienceCertificateListInput = z.infer<typeof ExperienceCertificateListInputSchema>;

/**
 * What the service layer receives to read ONE certificate.
 *
 * Carries the listing as well as the certificate, and the pair is checked
 * together: a certificate id that exists but belongs to another listing answers
 * NOT_FOUND, so this endpoint cannot be used to confirm that an id exists.
 */
export const ExperienceCertificateGetInputSchema = z.object({
    experienceId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    certificateId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

/** TypeScript type for {@link ExperienceCertificateGetInputSchema}. */
export type ExperienceCertificateGetInput = z.infer<typeof ExperienceCertificateGetInputSchema>;

/**
 * Admin/service search filters.
 *
 * `experienceId` is the only filter, because the only question anyone asks of
 * this table is "what has this listing issued".
 */
export const ExperienceCertificateSearchSchema = z.object({
    experienceId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }).optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20)
});

/** TypeScript type for {@link ExperienceCertificateSearchSchema}. */
export type ExperienceCertificateSearch = z.infer<typeof ExperienceCertificateSearchSchema>;

/** One certificate as an API response renders it — audit columns dropped. */
export const ExperienceCertificateOutputSchema = z.object({
    id: z.string().uuid(),
    experienceId: z.string().uuid(),
    recipientName: z.string(),
    completedAt: z.string(),
    issuedAt: z.string()
});

/** TypeScript type for {@link ExperienceCertificateOutputSchema}. */
export type ExperienceCertificateOutput = z.infer<typeof ExperienceCertificateOutputSchema>;

/** The list payload of `GET /experiences/{id}/certificates`. */
export const ExperienceCertificateListOutputSchema = z.object({
    certificates: z.array(ExperienceCertificateOutputSchema),
    total: z.number().int().min(0)
});

/** TypeScript type for {@link ExperienceCertificateListOutputSchema}. */
export type ExperienceCertificateListOutput = z.infer<typeof ExperienceCertificateListOutputSchema>;
