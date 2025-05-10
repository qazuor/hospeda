import { z } from 'zod';
import { AdminInfoSchema, BaseEntitySchema } from '../common.schema';
import { EmailTemplateTypeEnumSchema } from '../enums.schema';

/**
 * Schema for a reusable email template.
 */
export const EmailTemplateSchema = BaseEntitySchema.extend({
    /**
     * Internal template identifier or label.
     */
    name: z.string().min(1, {
        message: 'error:emailTemplate.nameRequired'
    }),

    /**
     * Subject line for the email.
     */
    subject: z.string().min(1, {
        message: 'error:emailTemplate.subjectRequired'
    }),

    /**
     * HTML body content.
     */
    bodyHtml: z.string().min(1, {
        message: 'error:emailTemplate.htmlRequired'
    }),

    /**
     * Optional plain text fallback.
     */
    bodyText: z.string().optional(),

    /**
     * Optional tags for categorization or filtering.
     */
    tags: z.array(z.string()).optional(),

    /**
     * Type of template (e.g., WELCOME, PASSWORD_RESET).
     */
    type: EmailTemplateTypeEnumSchema,

    /**
     * Marks system-owned templates (non-editable).
     */
    isSystem: z.boolean(),

    /**
     * Optional reference to the user that owns this template.
     */
    owner: z.string().uuid().optional(),

    /**
     * Administrative metadata.
     */
    adminInfo: AdminInfoSchema.optional()
});
