/**
 * @module entities/newsletter/newsletter-campaign.admin-search.schema
 *
 * Admin search schema for the newsletter campaign feature (SPEC-101).
 *
 * Extends {@link AdminSearchBaseSchema} with campaign-specific optional filters.
 *
 * Note: `newsletter-campaign.query.schema.ts` is intentionally omitted.
 * Campaigns are admin-only; there is no protected-tier or public query
 * endpoint for campaigns, so a separate query schema file would be dead code.
 */

import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { NewsletterCampaignLocaleFilterEnum } from '../../enums/newsletter-campaign-locale-filter.enum.js';
import { NewsletterCampaignStatusEnum } from '../../enums/newsletter-campaign-status.enum.js';

/**
 * Admin search schema for newsletter campaigns.
 *
 * Inherits all base admin search fields (page, pageSize, search, sort, status,
 * includeDeleted, createdAfter, createdBefore) and adds campaign-specific
 * optional filters.
 *
 * Note: `campaignStatus` is named to avoid shadowing the base `status` field
 * (a `LifecycleStatusEnum` filter) inherited from {@link AdminSearchBaseSchema}.
 *
 * @example
 * ```ts
 * const params = NewsletterCampaignAdminSearchSchema.parse({
 *   page: 1,
 *   pageSize: 20,
 *   campaignStatus: NewsletterCampaignStatusEnum.DRAFT
 * });
 * ```
 */
export const NewsletterCampaignAdminSearchSchema = AdminSearchBaseSchema.extend({
    /**
     * Filter by campaign lifecycle status.
     * Uses `campaignStatus` to avoid shadowing the base `LifecycleStatusEnum` filter.
     */
    campaignStatus: z
        .nativeEnum(NewsletterCampaignStatusEnum)
        .optional()
        .describe('Filter by campaign lifecycle status'),

    /** Filter by audience locale filter configured on the campaign. */
    localeFilter: z
        .nativeEnum(NewsletterCampaignLocaleFilterEnum)
        .optional()
        .describe('Filter by audience locale filter'),

    /**
     * Filter by partial title match (case-insensitive ILIKE).
     * Matches against the campaign's internal title field.
     */
    titleSearch: z
        .string()
        .max(120, { message: 'zodError.admin.search.newsletterCampaign.titleSearch.max' })
        .optional()
        .describe('Filter by partial campaign title (case-insensitive)')
});

/**
 * TypeScript type inferred from {@link NewsletterCampaignAdminSearchSchema}.
 * Represents the validated admin search parameters for newsletter campaigns.
 */
export type NewsletterCampaignAdminSearch = z.infer<typeof NewsletterCampaignAdminSearchSchema>;
