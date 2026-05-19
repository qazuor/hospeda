/**
 * @module entities/newsletter/newsletter-subscriber.admin-search.schema
 *
 * Admin search schema for the newsletter subscriber feature (SPEC-101).
 *
 * Extends {@link AdminSearchBaseSchema} with subscriber-specific optional filters
 * so that admin list endpoints can filter by subscription status, channel,
 * locale, acquisition source, and email substring.
 */

import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { NewsletterChannelEnum } from '../../enums/newsletter-channel.enum.js';
import { NewsletterSourceEnum } from '../../enums/newsletter-source.enum.js';
import { NewsletterSubscriberStatusEnum } from '../../enums/newsletter-subscriber-status.enum.js';
import { LanguageEnumSchema } from '../user/user.settings.schema.js';

/**
 * Admin search schema for newsletter subscribers.
 *
 * Inherits all base admin search fields (page, pageSize, search, sort, status,
 * includeDeleted, createdAfter, createdBefore) and adds subscriber-specific
 * optional filters.
 *
 * Note: the custom `subscriberStatus` field is intentionally named to avoid
 * shadowing the base `status` field which is a `LifecycleStatusEnum` filter.
 *
 * @example
 * ```ts
 * const params = NewsletterSubscriberAdminSearchSchema.parse({
 *   page: 1,
 *   pageSize: 50,
 *   subscriberStatus: NewsletterSubscriberStatusEnum.ACTIVE,
 *   locale: 'es'
 * });
 * ```
 */
export const NewsletterSubscriberAdminSearchSchema = AdminSearchBaseSchema.extend({
    /**
     * Filter by newsletter subscriber lifecycle status.
     * Uses `subscriberStatus` (not `status`) to avoid shadowing the base
     * `LifecycleStatusEnum` filter inherited from {@link AdminSearchBaseSchema}.
     */
    subscriberStatus: z
        .nativeEnum(NewsletterSubscriberStatusEnum)
        .optional()
        .describe('Filter by newsletter subscriber lifecycle status'),

    /** Filter by delivery channel (email | whatsapp). */
    channel: z.nativeEnum(NewsletterChannelEnum).optional().describe('Filter by delivery channel'),

    /** Filter by subscriber locale (es | en | pt). */
    locale: LanguageEnumSchema.optional().describe('Filter by subscriber locale'),

    /** Filter by acquisition source (web_footer | account_preferences | migration). */
    source: z.nativeEnum(NewsletterSourceEnum).optional().describe('Filter by acquisition source'),

    /**
     * Filter by partial email address match (case-insensitive ILIKE).
     * Maximum 255 characters.
     */
    emailSearch: z
        .string()
        .max(255, { message: 'zodError.admin.search.newsletterSubscriber.emailSearch.max' })
        .optional()
        .describe('Filter by partial email address (case-insensitive)')
});

/**
 * TypeScript type inferred from {@link NewsletterSubscriberAdminSearchSchema}.
 * Represents the validated admin search parameters for newsletter subscribers.
 */
export type NewsletterSubscriberAdminSearch = z.infer<typeof NewsletterSubscriberAdminSearchSchema>;
