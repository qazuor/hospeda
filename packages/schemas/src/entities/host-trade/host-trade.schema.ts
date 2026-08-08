import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    HOST_TRADE_BENEFIT_TEXT_MAX,
    HostTradeBenefitFieldsSchema,
    HostTradeBenefitReviewStateEnumSchema,
    HostTradeBenefitValueSchema
} from '../../common/host-trade-benefit.schema.js';
import { DestinationIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { BaseReviewFields } from '../../common/review.schema.js';
import { HostTradeBenefitTypeEnumSchema } from '../../enums/host-trade-benefit-type.schema.js';
import { HostTradeCategoryEnumSchema } from '../../enums/host-trade-category.schema.js';

/**
 * HostTradeSchema — base entity schema for the host-trades directory.
 *
 * Represents an admin-curated entry for a local tradesperson or service provider
 * that hosts can contact when they need maintenance, cleaning, or other services.
 * Each entry is scoped to a destination (city / locality).
 */
export const HostTradeSchema = z.object({
    /** Unique identifier for this host-trade entry (UUID v4) */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    /** URL-safe slug derived from name (auto-generated server-side if omitted on create) */
    slug: z.string().min(1, { message: 'zodError.hostTrade.slug.min' }),

    /** Display name of the tradesperson or business */
    name: z.string().min(1, { message: 'zodError.hostTrade.name.min' }),

    /** Service category (e.g. PLOMERIA, ELECTRICIDAD) */
    category: HostTradeCategoryEnumSchema,

    /**
     * Contact information for the tradesperson.
     * Plain text — may be a phone number or a wa.me deep-link.
     * No format validation is applied; admin is responsible for accuracy.
     */
    contact: z.string().min(1, { message: 'zodError.hostTrade.contact.min' }),

    /**
     * FINE PRINT of the benefit: conditions, exclusions, validity.
     *
     * Was the whole benefit until HOS-278 §6.4 gave it a structured shape
     * ({@link HostTradeSchema.shape.benefitType} / `benefitValue`). Rows created
     * before that still carry their entire offer here as prose, which is why
     * the field is neither renamed nor removed.
     *
     * The `.min(1)` it used to carry was relaxed: an applicant whose offer has
     * no conditions legitimately has no fine print, and requiring a character
     * would only produce a placeholder. Relaxing a rule is additive under the
     * schema compatibility policy — every value that parsed before still parses.
     */
    benefit: z.string(),

    /**
     * Structured benefit (HOS-278 §6.4). Nullish on every listing created
     * before the columns existed, whose offer lives in {@link benefit}.
     *
     * Consumers must render THIS pair, not {@link benefit} — reading the prose
     * as the benefit is exactly what the structure exists to stop.
     */
    ...HostTradeBenefitFieldsSchema.pick({ benefitType: true, benefitValue: true }).shape,

    /**
     * A benefit edit awaiting admin review (AC-8), held beside the live values
     * rather than replacing them.
     *
     * The public directory never reads these. The benefit is the provider's
     * consideration for being listed, so an edit must not take the vetted offer
     * off the directory while it waits.
     */
    pendingBenefitType: HostTradeBenefitTypeEnumSchema.nullish(),
    /** Pending counterpart of `benefitValue`. */
    pendingBenefitValue: HostTradeBenefitValueSchema.nullish(),
    /** Pending counterpart of {@link benefit} (the fine print). */
    pendingBenefitText: z
        .string()
        .max(HOST_TRADE_BENEFIT_TEXT_MAX, { message: 'zodError.hostTrade.benefitText.max' })
        .nullish(),
    /**
     * `'pending'` when a benefit edit is awaiting review, null otherwise.
     *
     * An explicit marker rather than inferring from the pending columns: an
     * edit that only rewrites the fine print leaves `pendingBenefitType` null,
     * and inferring would read that as "nothing to review".
     */
    benefitReviewState: HostTradeBenefitReviewStateEnumSchema.nullish(),

    /** Destination this trade entry is associated with */
    destinationId: DestinationIdSchema,

    /**
     * The account that owns this listing and may edit its operational fields
     * from `/mi-cuenta` (HOS-278 AC-7).
     *
     * Nullish for admin-curated listings that predate HOS-278 and for an
     * approved application whose applicant never confirmed their email. A null
     * owner is what makes the ownership filter fail CLOSED.
     */
    ownerUserId: UserIdSchema.nullish(),

    /**
     * When this listing was revoked (R-4), or null.
     *
     * Revoking sets `isActive` false and fills this trio while KEEPING the row:
     * a revoked listing stays visible to admins, unlike a soft-deleted one, and
     * the provider's history of having been approved is itself worth keeping.
     */
    revokedAt: z.coerce.date().nullish(),
    /** Admin who revoked the listing. */
    revokedById: UserIdSchema.nullish(),
    /** Why it was revoked. Surfaced to the provider in the notification. */
    revokeReason: z
        .string()
        .max(1000, { message: 'zodError.hostTrade.revokeReason.max' })
        .nullish(),

    /** Whether this tradesperson is available 24 hours a day */
    is24h: z.boolean().default(false),

    /**
     * Human-readable schedule text when not 24h
     * (e.g. "Lunes a Viernes 8:00–18:00").
     * Optional and nullable.
     */
    scheduleText: z.string().nullish(),

    /** Whether this entry is currently active and visible to hosts */
    isActive: z.boolean().default(true),

    // ------------------------------------------------------------------
    // Denormalised counters (HOS-376 §7.2)
    //
    // Recomputed by `recalculateHostTradeAggregates`, never written by a
    // client — they are named in `HOST_TRADE_DOMAIN_MANAGED_FIELDS` and the
    // guard keeps them out of every write shape.
    //
    // Optional rather than required, even though the columns are NOT NULL:
    // the compat policy is additive-only, and a required field would reject
    // every shape written before these columns existed.
    // ------------------------------------------------------------------

    /** CONFIRMED, non-deleted benefit usages. */
    confirmedUsesCount: z.number().int().min(0).default(0).optional(),

    /**
     * Distinct hosts among those usages — the anti-collusion signal (§6.5).
     *
     * Shown next to {@link confirmedUsesCount} precisely so the pair can be
     * read against each other: "40 usos · 2 anfitriones" delata solo.
     */
    distinctHostsCount: z.number().int().min(0).default(0).optional(),

    /** APPROVED reviews with `respectedBenefit = true`. */
    benefitRespectedCount: z.number().int().min(0).default(0).optional(),

    // `reviewsCount` + `averageRating`, shared with the other reviewed
    // entities so the directory card and an accommodation card cannot drift
    // apart on how a rating is shaped.
    ...BaseReviewFields,

    // ------------------------------------------------------------------
    // Declaration suspension (HOS-376 §6.5)
    // ------------------------------------------------------------------

    /** When declaration was suspended for this provider. Null = not suspended. */
    declarationSuspendedAt: z.coerce.date().nullish(),

    /**
     * Who suspended it.
     *
     * Null does NOT mean "not suspended" — it means the rejection-threshold
     * cron applied it automatically. An admin id means a person acted
     * (AC-11 / AC-12), which is why the two cases need separate columns.
     */
    declarationSuspendedById: UserIdSchema.nullish(),

    /** Why. Surfaced to the provider, never to the directory. */
    declarationSuspendReason: z.string().nullish(),

    // Shared audit + soft-delete fields
    ...BaseAuditFields
});

/**
 * Inferred TypeScript type for a full HostTrade entity record.
 */
export type HostTrade = z.infer<typeof HostTradeSchema>;
