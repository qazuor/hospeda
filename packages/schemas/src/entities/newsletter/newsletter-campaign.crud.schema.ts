/**
 * @module entities/newsletter/newsletter-campaign.crud.schema
 *
 * Create / Update request body schemas for the newsletter campaign feature (SPEC-101).
 *
 * Covers:
 * - `CreateNewsletterCampaignSchema` — admin creates a new DRAFT campaign
 * - `UpdateNewsletterCampaignSchema` — admin edits a DRAFT campaign (partial)
 */

import { z } from 'zod';
import { NewsletterCampaignLocaleFilterEnum } from '../../enums/newsletter-campaign-locale-filter.enum.js';
import { NewsletterCampaignLocaleFilterEnumSchema } from '../../enums/newsletter-campaign-locale-filter.schema.js';
import { NewsletterContentTypeEnumSchema } from '../../enums/newsletter-content-type.schema.js';
import { TiptapDocumentSchema } from './newsletter-campaign.schema.js';

// ============================================================================
// CreateNewsletterCampaignSchema
// ============================================================================

/**
 * Request body for `POST /api/v1/admin/newsletter/campaigns`.
 *
 * Creates a new campaign in DRAFT status. `localeFilter` defaults to `'all'`
 * (all active subscribers regardless of locale). `.strict()` rejects unknown fields.
 *
 * @example
 * ```ts
 * const body = CreateNewsletterCampaignSchema.parse({
 *   title: 'Mayo 2025',
 *   subject: 'Novedades de Hospeda — mayo',
 *   bodyJson: { type: 'doc', content: [] },
 *   localeFilter: 'es'
 * });
 * ```
 */
export const CreateNewsletterCampaignSchema = z
    .object({
        /** Internal label (1..120 characters) — not shown to subscribers. */
        title: z
            .string()
            .min(1, { message: 'zodError.entity.newsletterCampaign.title.min' })
            .max(120, { message: 'zodError.entity.newsletterCampaign.title.max' }),

        /** Email subject line (1..120 characters) — shown in the recipient's inbox. */
        subject: z
            .string()
            .min(1, { message: 'zodError.entity.newsletterCampaign.subject.min' })
            .max(120, { message: 'zodError.entity.newsletterCampaign.subject.max' }),

        /** TipTap document JSON — rendered to HTML at send time. */
        bodyJson: TiptapDocumentSchema,

        /** Audience locale filter for dispatch. Defaults to `'all'`. */
        localeFilter: NewsletterCampaignLocaleFilterEnumSchema.default(
            NewsletterCampaignLocaleFilterEnum.ALL
        ),

        /**
         * Audience content-type filter for dispatch (optional).
         *
         * When omitted or `null`, the campaign goes to every active subscriber
         * matching the locale filter (legacy behavior). When set, only
         * subscribers with `preferences[contentType] = true` are eligible.
         */
        contentType: NewsletterContentTypeEnumSchema.nullable().optional()
    })
    .strict();

/** TypeScript type inferred from {@link CreateNewsletterCampaignSchema}. */
export type CreateNewsletterCampaign = z.infer<typeof CreateNewsletterCampaignSchema>;

// ============================================================================
// UpdateNewsletterCampaignSchema
// ============================================================================

/**
 * Request body for `PATCH /api/v1/admin/newsletter/campaigns/:id`.
 *
 * Partial update of a DRAFT campaign. Only fields provided will be updated;
 * the service layer enforces that only DRAFT campaigns are editable.
 * `.strict()` rejects unknown fields.
 *
 * @example
 * ```ts
 * const body = UpdateNewsletterCampaignSchema.parse({
 *   subject: 'Novedades de Hospeda — mayo (corregido)'
 * });
 * ```
 */
export const UpdateNewsletterCampaignSchema = z
    .object({
        /** Updated internal label (1..120 characters). */
        title: z
            .string()
            .min(1, { message: 'zodError.entity.newsletterCampaign.title.min' })
            .max(120, { message: 'zodError.entity.newsletterCampaign.title.max' }),

        /** Updated email subject line (1..120 characters). */
        subject: z
            .string()
            .min(1, { message: 'zodError.entity.newsletterCampaign.subject.min' })
            .max(120, { message: 'zodError.entity.newsletterCampaign.subject.max' }),

        /** Updated TipTap document JSON. */
        bodyJson: TiptapDocumentSchema,

        /** Updated audience locale filter. */
        localeFilter: NewsletterCampaignLocaleFilterEnumSchema,

        /**
         * Updated audience content-type filter. `null` clears segmentation;
         * a `NewsletterContentTypeEnum` value enables it.
         */
        contentType: NewsletterContentTypeEnumSchema.nullable()
    })
    .partial()
    .strict();

/** TypeScript type inferred from {@link UpdateNewsletterCampaignSchema}. */
export type UpdateNewsletterCampaign = z.infer<typeof UpdateNewsletterCampaignSchema>;
