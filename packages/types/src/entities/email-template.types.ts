import type { AdminInfoType, BaseEntityType } from '../common.types';
import type { EmailTemplateTypeEnum } from '../enums.types';

/**
 * Defines an email template used for system notifications or campaigns.
 */
export interface EmailTemplateType extends BaseEntityType {
    /**
     * Internal name of the template (for selection/use in UI).
     */
    name: string;

    /**
     * Subject line of the email.
     */
    subject: string;

    /**
     * HTML body of the email (supports formatting, layout, branding).
     */
    bodyHtml: string;

    /**
     * Optional plain-text fallback body (for non-HTML clients).
     */
    bodyText?: string;

    /**
     * Tags to classify or filter templates (e.g., onboarding, transactional).
     */
    tags?: string[];

    /**
     * Type/category of the template (e.g., promo, password reset).
     */
    type: EmailTemplateTypeEnum;

    /**
     * Whether the template is used by the system and cannot be deleted.
     */
    isSystem: boolean;

    /**
     * Optional reference to the user who owns or created the template.
     */
    owner?: string; // userId (UUID)

    /**
     * Admin metadata and notes.
     */
    adminInfo?: AdminInfoType;
}
