/**
 * @module entities/newsletter/newsletter-campaign.schema
 *
 * Base Zod schema for the `newsletter_campaigns` entity (SPEC-101).
 */

import { z } from 'zod';
import { NewsletterCampaignLocaleFilterEnum } from '../../enums/newsletter-campaign-locale-filter.enum.js';
import { NewsletterCampaignStatusEnum } from '../../enums/newsletter-campaign-status.enum.js';
import { NewsletterContentTypeEnum } from '../../enums/newsletter-content-type.enum.js';

// ============================================================================
// TiptapDocumentSchema
// ============================================================================

/**
 * Loose Zod schema for a TipTap document JSON object.
 *
 * TipTap's internal document format is a ProseMirror-compatible nested tree.
 * The root node is always `{ type: 'doc', content: [...] }` but the `content`
 * array can contain deeply nested marks and nodes of arbitrary shape — their
 * exact structure is controlled by the editor's schema extension set, which
 * varies at runtime. Using `z.any()` for individual content nodes is therefore
 * intentional and unavoidable: validating the full ProseMirror AST in Zod would
 * require replicating the entire extension registry in schema form, which is
 * both impractical and brittle. The `passthrough()` call preserves unknown
 * TipTap-version-specific fields that may appear on the root doc node.
 *
 * @example
 * ```ts
 * const doc = TiptapDocumentSchema.parse(editorJson);
 * ```
 */
export const TiptapDocumentSchema = z
    .object({
        type: z.literal('doc'),
        // z.any() is intentional here — TipTap content nodes are a
        // dynamically-typed ProseMirror AST and cannot be exhaustively typed
        // without replicating the full extension registry in Zod.
        content: z.array(z.any()).optional()
    })
    .passthrough();

/** TypeScript type inferred from {@link TiptapDocumentSchema}. */
export type TiptapDocument = z.infer<typeof TiptapDocumentSchema>;

// ============================================================================
// NewsletterCampaignSchema
// ============================================================================

/**
 * Core newsletter campaign schema — mirrors the `newsletter_campaigns` DB table.
 *
 * A campaign is an admin-authored newsletter edition. `bodyJson` holds the raw
 * TipTap document JSON; the rendered HTML is computed at send time.
 *
 * @example
 * ```ts
 * const campaign = NewsletterCampaignSchema.parse(row);
 * ```
 */
export const NewsletterCampaignSchema = z.object({
    id: z.string().uuid(),

    /** Internal label — never shown to subscribers. */
    title: z
        .string()
        .min(1, { message: 'zodError.entity.newsletterCampaign.title.min' })
        .max(120, { message: 'zodError.entity.newsletterCampaign.title.max' }),

    /** Email subject line — shown in the recipient's inbox. */
    subject: z
        .string()
        .min(1, { message: 'zodError.entity.newsletterCampaign.subject.min' })
        .max(120, { message: 'zodError.entity.newsletterCampaign.subject.max' }),

    /** TipTap document JSON. Rendered to HTML at send time. */
    bodyJson: TiptapDocumentSchema,

    /** Lifecycle state. */
    status: z.nativeEnum(NewsletterCampaignStatusEnum),

    /** Audience locale filter applied at dispatch time. */
    localeFilter: z.nativeEnum(NewsletterCampaignLocaleFilterEnum),

    /**
     * Audience content-type filter applied at dispatch time.
     *
     * - `null` → no segmentation, send to every active subscriber matching the
     *   locale filter (legacy behavior, kept as the default for backward compat).
     * - `NewsletterContentTypeEnum.OFFERS | EVENTS | GUIDES | PRODUCT_NEWS` →
     *   only include subscribers whose `preferences[contentType]` is `true`
     *   (or absent — defensive default; the column default in
     *   `newsletter_subscribers.preferences` is all-true).
     *
     * KEEP IN SYNC with the `content_type` column on `newsletter_campaigns`
     * (migration 0028) and the `contentType` filter consumed by
     * `NewsletterSubscriberService.getEligibleForCampaign`.
     */
    contentType: z.nativeEnum(NewsletterContentTypeEnum).nullable(),

    /**
     * Number of subscribers enqueued for delivery.
     * Set at dispatch time (status → SENDING). NULL while in DRAFT.
     */
    totalRecipients: z.number().int().min(0).nullable(),

    /**
     * Number of subscribers excluded by the soft-cap window.
     * Always present (defaults to 0 at the DB level).
     */
    totalSoftcapped: z.number().int().min(0),

    /** When the admin triggered dispatch. NULL while in DRAFT. */
    sentAt: z.union([z.string().datetime(), z.date()]).nullable(),

    /** Reserved for V2 scheduled sends. Unused in MVP. */
    scheduledFor: z.union([z.string().datetime(), z.date()]).nullable(),

    /** FK → users.id. Admin who created the campaign. */
    createdBy: z.string().uuid(),

    // ---- Audit columns ----

    createdAt: z.union([z.string().datetime(), z.date()]),
    updatedAt: z.union([z.string().datetime(), z.date()]),

    /** Soft delete — only DRAFT campaigns may be deleted (enforced at the service layer). */
    deletedAt: z.union([z.string().datetime(), z.date()]).nullable()
});

/** TypeScript type inferred from {@link NewsletterCampaignSchema}. */
export type NewsletterCampaign = z.infer<typeof NewsletterCampaignSchema>;
