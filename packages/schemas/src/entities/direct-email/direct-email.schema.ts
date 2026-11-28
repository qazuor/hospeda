/**
 * @module entities/direct-email/direct-email.schema
 *
 * Base Zod schemas for the direct email module (HOS-2685): messages, per-recipient
 * rows, templates and the suppression list. Mirrors the `direct_email_*` tables.
 */

import { z } from 'zod';
import { DirectEmailRecipientStatusEnumSchema } from '../../enums/direct-email-recipient-status.schema.js';
import { DirectEmailSuppressionReasonEnumSchema } from '../../enums/direct-email-suppression-reason.schema.js';
import { TiptapDocumentSchema } from '../newsletter/newsletter-campaign.schema.js';

/** Maximum recipients of one direct email send. */
export const DIRECT_EMAIL_MAX_RECIPIENTS = 20;

/** Maximum subject length (characters). */
export const DIRECT_EMAIL_SUBJECT_MAX_LENGTH = 200;

/** Block node types that count as content even without text. */
const CONTENT_LEAF_TYPES: ReadonlySet<string> = new Set(['image', 'horizontalRule']);

/** Loose shape of a TipTap node, enough to walk the tree. */
interface TiptapNodeLike {
    readonly type?: unknown;
    readonly text?: unknown;
    readonly content?: unknown;
}

/**
 * Whether a TipTap document has anything to render: a non-blank text node, an
 * image or a horizontal rule. An empty document, or one with only empty
 * paragraphs and headings, has none.
 *
 * @param doc - The TipTap document, or any node of it
 * @returns `true` when the document carries visible content
 */
export function hasTiptapContent(doc: unknown): boolean {
    if (!doc || typeof doc !== 'object') return false;
    const node = doc as TiptapNodeLike;
    if (typeof node.text === 'string' && node.text.trim().length > 0) return true;
    if (typeof node.type === 'string' && CONTENT_LEAF_TYPES.has(node.type)) return true;
    return Array.isArray(node.content) && node.content.some((child) => hasTiptapContent(child));
}

/** Email subject: 1..200 characters, trimmed. */
export const DirectEmailSubjectSchema = z
    .string()
    .trim()
    .min(1, { message: 'zodError.entity.directEmail.subject.min' })
    .max(DIRECT_EMAIL_SUBJECT_MAX_LENGTH, { message: 'zodError.entity.directEmail.subject.max' });

/** TipTap body with at least one visible node. */
export const DirectEmailBodySchema = TiptapDocumentSchema.refine(hasTiptapContent, {
    message: 'zodError.entity.directEmail.body.empty'
});

/** One email address, trimmed and lowercased. */
export const DirectEmailAddressSchema = z
    .string()
    .trim()
    .toLowerCase()
    .pipe(
        z
            .email({ message: 'zodError.entity.directEmail.email.invalid' })
            .max(254, { message: 'zodError.entity.directEmail.email.invalid' })
    );

/** Recipient list: 1..20 valid addresses, duplicates (case-insensitive) rejected. */
export const DirectEmailRecipientsSchema = z
    .array(DirectEmailAddressSchema)
    .min(1, { message: 'zodError.entity.directEmail.recipients.min' })
    .max(DIRECT_EMAIL_MAX_RECIPIENTS, { message: 'zodError.entity.directEmail.recipients.max' })
    .refine((emails) => new Set(emails).size === emails.length, {
        message: 'zodError.entity.directEmail.recipients.duplicate'
    });

/** Per-recipient row of a sent direct email. */
export const DirectEmailRecipientSchema = z.object({
    id: z.string().uuid(),
    messageId: z.string().uuid(),
    email: z.string(),
    status: DirectEmailRecipientStatusEnumSchema,
    providerMessageId: z.string().nullable(),
    errorMessage: z.string().nullable(),
    sentAt: z.coerce.date().nullable(),
    deliveredAt: z.coerce.date().nullable(),
    openedAt: z.coerce.date().nullable(),
    bouncedAt: z.coerce.date().nullable()
});

/** TypeScript type inferred from {@link DirectEmailRecipientSchema}. */
export type DirectEmailRecipient = z.infer<typeof DirectEmailRecipientSchema>;

/** A sent direct email (history row). */
export const DirectEmailMessageSchema = z.object({
    id: z.string().uuid(),
    subject: z.string(),
    bodyJson: TiptapDocumentSchema,
    templateId: z.string().uuid().nullable(),
    sentBy: z.string().uuid(),
    fromEmail: z.string(),
    replyToEmail: z.string(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date()
});

/** TypeScript type inferred from {@link DirectEmailMessageSchema}. */
export type DirectEmailMessage = z.infer<typeof DirectEmailMessageSchema>;

/** A message with its recipients (detail page). */
export const DirectEmailMessageDetailSchema = DirectEmailMessageSchema.extend({
    recipients: z.array(DirectEmailRecipientSchema)
});

/** TypeScript type inferred from {@link DirectEmailMessageDetailSchema}. */
export type DirectEmailMessageDetail = z.infer<typeof DirectEmailMessageDetailSchema>;

/** A message row of the history list: message plus its recipient count. */
export const DirectEmailMessageListItemSchema = DirectEmailMessageSchema.extend({
    recipientCount: z.number().int().min(0)
});

/** TypeScript type inferred from {@link DirectEmailMessageListItemSchema}. */
export type DirectEmailMessageListItem = z.infer<typeof DirectEmailMessageListItemSchema>;

/** A reusable starting point for a direct email. */
export const DirectEmailTemplateSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    subject: z.string(),
    bodyJson: TiptapDocumentSchema,
    createdBy: z.string().uuid(),
    updatedBy: z.string().uuid().nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    deletedAt: z.coerce.date().nullable()
});

/** TypeScript type inferred from {@link DirectEmailTemplateSchema}. */
export type DirectEmailTemplate = z.infer<typeof DirectEmailTemplateSchema>;

/** An address the admin can no longer send direct emails to. */
export const DirectEmailSuppressionSchema = z.object({
    id: z.string().uuid(),
    email: z.string(),
    reason: DirectEmailSuppressionReasonEnumSchema,
    createdAt: z.coerce.date(),
    createdBy: z.string().uuid().nullable()
});

/** TypeScript type inferred from {@link DirectEmailSuppressionSchema}. */
export type DirectEmailSuppression = z.infer<typeof DirectEmailSuppressionSchema>;
