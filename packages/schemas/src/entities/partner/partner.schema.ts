import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { ContactInfoSchema } from '../../common/contact.schema.js';
import { UserIdSchema } from '../../common/id.schema.js';
import { SocialNetworkSchema } from '../../common/social.schema.js';
import { LifecycleStatusEnumSchema } from '../../enums/lifecycle-state.schema.js';
import { PartnerContentReviewStateEnumSchema } from '../../enums/partner-content-review-state.schema.js';
import { PartnerSubscriptionStatusEnumSchema } from '../../enums/partner-subscription-status.schema.js';
import { PartnerTierEnumSchema } from '../../enums/partner-tier.schema.js';
import { PartnerTypeEnumSchema } from '../../enums/partner-type.schema.js';

/**
 * Partner analytics JSONB structure
 */
export const partnerAnalyticsSchema = z.object({
    impressions: z.number().int().min(0).optional(),
    clicks: z.number().int().min(0).optional()
});

export type PartnerAnalytics = z.infer<typeof partnerAnalyticsSchema>;

/**
 * Base partner schema
 * Core entity structure with all fields
 */
export const partnerSchema = z.object({
    id: z.string().uuid(),
    slug: z
        .string()
        .min(1)
        .max(255)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().min(1).max(255),
    type: PartnerTypeEnumSchema,
    tier: PartnerTierEnumSchema,
    logoUrl: z.string().url().nullable().optional(),
    websiteUrl: z.string().url().nullable().optional(),
    description: z.string().max(5000).nullable().optional(),
    /**
     * How to reach the partner, and where they are (HOS-278 D3).
     *
     * OPERATIONAL: the partner edits these and they apply immediately, unlike
     * the reviewed content trio. A phone number is the kind of fact that goes
     * stale and that only the partner can keep current, so an admin queue would
     * make the directory less accurate rather than more.
     *
     * Read with the LENIENT overlay on read paths — the stored value predates
     * nothing here, but the same rule that protects users applies: a read must
     * never 500 on data already in the column.
     */
    contactInfo: ContactInfoSchema.nullish(),
    /** Operational counterpart of {@link partnerSchema.shape.contactInfo}. */
    socialNetworks: SocialNetworkSchema.nullish(),
    subscriptionStatus: PartnerSubscriptionStatusEnumSchema,
    lifecycleState: LifecycleStatusEnumSchema,
    analytics: partnerAnalyticsSchema.default({}),
    planId: z.string().uuid().nullable().optional(),
    subscriptionId: z.string().uuid().nullable().optional(),
    /**
     * The account that owns this partner listing.
     *
     * Null for curated partners the admin created by hand, and for a
     * provisioned partner whose anonymous applicant has not redeemed their
     * claim token yet. Ownership queries must therefore fail CLOSED on null.
     */
    ownerUserId: UserIdSchema.nullish(),
    /**
     * When the alliance began — null until it actually does.
     *
     * Relaxed from required (HOS-278 D1): provisioning creates the row before
     * any payment, so a DRAFT partner genuinely has no start date and must not
     * be forced to invent one. Written for real when the subscription
     * activates.
     */
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    /**
     * Logo the partner submitted and an admin has not resolved yet.
     *
     * The pending trio below is deliberately SEPARATE from the live
     * `logoUrl` / `description` / `websiteUrl` rather than a review flag on
     * the row itself, for the reason `host_trades` split its benefit the same
     * way: once a partner is paying and published, an edit must not pull the
     * vetted listing off the carousel while it waits for someone to look at
     * it. The public read path never touches these.
     *
     * `null` means "nothing pending", not "no logo".
     */
    pendingLogoUrl: z.string().url().nullish(),
    /** Pending counterpart of {@link partnerSchema.shape.description}. */
    pendingDescription: z.string().max(5000).nullish(),
    /** Pending counterpart of {@link partnerSchema.shape.websiteUrl}. */
    pendingWebsiteUrl: z.string().url().nullish(),
    /**
     * State of the current submission, or null when there has never been one.
     *
     * An explicit marker rather than something inferred from the pending
     * columns: a partner who submits only a description leaves
     * {@link partnerSchema.shape.pendingLogoUrl} null, and inferring would read
     * that as "nothing to review".
     */
    contentReviewState: PartnerContentReviewStateEnumSchema.nullish(),
    /** Why an admin rejected the submission. Null unless the state is `rejected`. */
    contentReviewNote: z.string().max(1000).nullish(),
    /**
     * When this partner's content FIRST cleared review — the payment gate
     * itself (AC-11).
     *
     * Null means no admin has ever accepted this partner's content, and no
     * payment may be initiated for it. Once set it is never cleared: a later
     * edit moves {@link partnerSchema.shape.contentReviewState} back to
     * `pending` but the live content is still the approved one, so the partner
     * keeps both their listing and their ability to pay for it.
     */
    contentApprovedAt: z.coerce.date().nullish(),
    /** Admin who accepted the content. */
    contentApprovedById: UserIdSchema.nullish(),
    ...BaseAuditFields
});

export type Partner = z.infer<typeof partnerSchema>;

/**
 * The content-review columns, as an `.omit()` mask (HOS-278 D2).
 *
 * Every one of these is written by the review flow alone — the partner's own
 * submission fills the pending trio, the admin's decision resolves it — so
 * none of them may arrive through the admin create or update schemas. Same
 * criterion as `ownerUserId`: a field whose whole purpose is to record who
 * decided what, and when, must not be settable as an ordinary field edit.
 * An admin who could PATCH `contentApprovedAt` would be approving content
 * without ever looking at it, which is the exact check AC-11 asks for.
 *
 * Declared once and spread into both schemas so the two can never drift.
 */
export const PARTNER_REVIEW_MANAGED_FIELDS = {
    pendingLogoUrl: true,
    pendingDescription: true,
    pendingWebsiteUrl: true,
    contentReviewState: true,
    contentReviewNote: true,
    contentApprovedAt: true,
    contentApprovedById: true
} as const;
