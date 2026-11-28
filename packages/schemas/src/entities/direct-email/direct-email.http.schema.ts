/**
 * @module entities/direct-email/direct-email.http.schema
 *
 * Request and response schemas of the direct email endpoints (HOS-2685):
 * `/api/v1/admin/direct-emails`, `/direct-email-templates`,
 * `/direct-email-suppressions` and `/api/v1/public/direct-emails/opt-out`.
 */

import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { DirectEmailSuppressionReasonEnumSchema } from '../../enums/direct-email-suppression-reason.schema.js';
import { TiptapDocumentSchema } from '../newsletter/newsletter-campaign.schema.js';
import {
    DirectEmailAddressSchema,
    DirectEmailBodySchema,
    DirectEmailRecipientsSchema,
    DirectEmailSubjectSchema
} from './direct-email.schema.js';

// ----------------------------------------------------------------------------
// Messages
// ----------------------------------------------------------------------------

/** Query of `GET /admin/direct-emails`. */
export const DirectEmailAdminSearchSchema = AdminSearchBaseSchema.pick({
    page: true,
    pageSize: true
}).extend({
    /** Case-insensitive text matched against the subject. */
    search: z.string().trim().max(200).optional()
});

/** TypeScript type inferred from {@link DirectEmailAdminSearchSchema}. */
export type DirectEmailAdminSearch = z.infer<typeof DirectEmailAdminSearchSchema>;

/** Body of `POST /admin/direct-emails` (real send). */
export const SendDirectEmailRequestSchema = z
    .object({
        subject: DirectEmailSubjectSchema,
        bodyJson: DirectEmailBodySchema,
        recipients: DirectEmailRecipientsSchema,
        /** Template the admin started from, kept for the history only. */
        templateId: z.string().uuid().nullish()
    })
    .strict();

/** TypeScript type inferred from {@link SendDirectEmailRequestSchema}. */
export type SendDirectEmailRequest = z.infer<typeof SendDirectEmailRequestSchema>;

/** Outcome of one recipient of a real send. */
export const DirectEmailSendResultSchema = z.object({
    email: z.string(),
    status: z.enum(['sent', 'failed', 'suppressed']),
    /** Provider message id on `sent`. */
    providerMessageId: z.string().nullable(),
    /** Provider error on `failed`. */
    error: z.string().nullable()
});

/** TypeScript type inferred from {@link DirectEmailSendResultSchema}. */
export type DirectEmailSendResult = z.infer<typeof DirectEmailSendResultSchema>;

/** Response of `POST /admin/direct-emails`. */
export const SendDirectEmailResponseSchema = z.object({
    messageId: z.string().uuid(),
    results: z.array(DirectEmailSendResultSchema)
});

/** TypeScript type inferred from {@link SendDirectEmailResponseSchema}. */
export type SendDirectEmailResponse = z.infer<typeof SendDirectEmailResponseSchema>;

/** Body of `POST /admin/direct-emails/preview`. The body may still be empty while composing. */
export const PreviewDirectEmailRequestSchema = z
    .object({
        subject: z.string().trim().max(200),
        bodyJson: TiptapDocumentSchema
    })
    .strict();

/** TypeScript type inferred from {@link PreviewDirectEmailRequestSchema}. */
export type PreviewDirectEmailRequest = z.infer<typeof PreviewDirectEmailRequestSchema>;

/** Response of `POST /admin/direct-emails/preview`. */
export const PreviewDirectEmailResponseSchema = z.object({
    subject: z.string(),
    html: z.string()
});

/** TypeScript type inferred from {@link PreviewDirectEmailResponseSchema}. */
export type PreviewDirectEmailResponse = z.infer<typeof PreviewDirectEmailResponseSchema>;

/** Body of `POST /admin/direct-emails/test-send`. `toEmail` defaults to the admin's own. */
export const TestSendDirectEmailRequestSchema = z
    .object({
        subject: DirectEmailSubjectSchema,
        bodyJson: DirectEmailBodySchema,
        toEmail: DirectEmailAddressSchema.optional()
    })
    .strict();

/** TypeScript type inferred from {@link TestSendDirectEmailRequestSchema}. */
export type TestSendDirectEmailRequest = z.infer<typeof TestSendDirectEmailRequestSchema>;

/** Response of `POST /admin/direct-emails/test-send`. */
export const TestSendDirectEmailResponseSchema = z.object({
    sentTo: z.string().email()
});

/** TypeScript type inferred from {@link TestSendDirectEmailResponseSchema}. */
export type TestSendDirectEmailResponse = z.infer<typeof TestSendDirectEmailResponseSchema>;

/** Body of `POST /admin/direct-emails/check-recipients`. Shape is checked by the service. */
export const CheckDirectEmailRecipientsRequestSchema = z
    .object({
        emails: z.array(z.string().trim().max(254)).min(1).max(50)
    })
    .strict();

/** TypeScript type inferred from {@link CheckDirectEmailRecipientsRequestSchema}. */
export type CheckDirectEmailRecipientsRequest = z.infer<
    typeof CheckDirectEmailRecipientsRequestSchema
>;

/** Response of `POST /admin/direct-emails/check-recipients`. */
export const CheckDirectEmailRecipientsResponseSchema = z.object({
    /** Lowercased addresses of the request that are on the suppression list. */
    suppressed: z.array(z.string())
});

/** TypeScript type inferred from {@link CheckDirectEmailRecipientsResponseSchema}. */
export type CheckDirectEmailRecipientsResponse = z.infer<
    typeof CheckDirectEmailRecipientsResponseSchema
>;

// ----------------------------------------------------------------------------
// Templates
// ----------------------------------------------------------------------------

/** Template name: 1..120 characters, trimmed. */
export const DirectEmailTemplateNameSchema = z
    .string()
    .trim()
    .min(1, { message: 'zodError.entity.directEmailTemplate.name.min' })
    .max(120, { message: 'zodError.entity.directEmailTemplate.name.max' });

/** Query of `GET /admin/direct-email-templates`. */
export const DirectEmailTemplateAdminSearchSchema = DirectEmailAdminSearchSchema;

/** Body of `POST /admin/direct-email-templates`. */
export const CreateDirectEmailTemplateSchema = z
    .object({
        name: DirectEmailTemplateNameSchema,
        subject: DirectEmailSubjectSchema,
        bodyJson: DirectEmailBodySchema
    })
    .strict();

/** TypeScript type inferred from {@link CreateDirectEmailTemplateSchema}. */
export type CreateDirectEmailTemplate = z.infer<typeof CreateDirectEmailTemplateSchema>;

/** Body of `PATCH /admin/direct-email-templates/{id}` (at least one field). */
export const UpdateDirectEmailTemplateSchema = CreateDirectEmailTemplateSchema.partial().refine(
    (value) => Object.keys(value).length > 0,
    { message: 'zodError.entity.directEmailTemplate.update.empty' }
);

/** TypeScript type inferred from {@link UpdateDirectEmailTemplateSchema}. */
export type UpdateDirectEmailTemplate = z.infer<typeof UpdateDirectEmailTemplateSchema>;

// ----------------------------------------------------------------------------
// Suppressions
// ----------------------------------------------------------------------------

/** Query of `GET /admin/direct-email-suppressions`. */
export const DirectEmailSuppressionAdminSearchSchema = DirectEmailAdminSearchSchema.extend({
    reason: DirectEmailSuppressionReasonEnumSchema.optional()
});

/** TypeScript type inferred from {@link DirectEmailSuppressionAdminSearchSchema}. */
export type DirectEmailSuppressionAdminSearch = z.infer<
    typeof DirectEmailSuppressionAdminSearchSchema
>;

/** Body of `POST /admin/direct-email-suppressions` (manual add). */
export const CreateDirectEmailSuppressionSchema = z
    .object({ email: DirectEmailAddressSchema })
    .strict();

/** TypeScript type inferred from {@link CreateDirectEmailSuppressionSchema}. */
export type CreateDirectEmailSuppression = z.infer<typeof CreateDirectEmailSuppressionSchema>;

// ----------------------------------------------------------------------------
// Public opt-out
// ----------------------------------------------------------------------------

/** Longest accepted opt-out token. Real ones are under 400 characters. */
export const DIRECT_EMAIL_OPT_OUT_TOKEN_MAX_LENGTH = 1024;

/** Opt-out token as it arrives in a query string or a body. */
export const DirectEmailOptOutTokenSchema = z
    .string()
    .trim()
    .min(1, { message: 'zodError.entity.directEmail.token.invalid' })
    .max(DIRECT_EMAIL_OPT_OUT_TOKEN_MAX_LENGTH, {
        message: 'zodError.entity.directEmail.token.invalid'
    });

/** Query of `GET /public/direct-emails/opt-out`. */
export const DirectEmailOptOutQuerySchema = z.object({ token: DirectEmailOptOutTokenSchema });

/** Body of `POST /public/direct-emails/opt-out`. */
export const DirectEmailOptOutBodySchema = z.object({ token: DirectEmailOptOutTokenSchema });

/** Response of `GET /public/direct-emails/opt-out`: the masked address, nothing written. */
export const DirectEmailOptOutPreviewSchema = z.object({
    /** Address with the local part masked, for example `j***@example.com`. */
    maskedEmail: z.string()
});

/** TypeScript type inferred from {@link DirectEmailOptOutPreviewSchema}. */
export type DirectEmailOptOutPreview = z.infer<typeof DirectEmailOptOutPreviewSchema>;

/** Response of `POST /public/direct-emails/opt-out`. */
export const DirectEmailOptOutResultSchema = z.object({
    maskedEmail: z.string(),
    suppressed: z.literal(true)
});

/** TypeScript type inferred from {@link DirectEmailOptOutResultSchema}. */
export type DirectEmailOptOutResult = z.infer<typeof DirectEmailOptOutResultSchema>;
