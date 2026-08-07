import { z } from 'zod';
import {
    HOST_TRADE_BENEFIT_TEXT_MAX,
    HostTradeBenefitValueSchema,
    refineHostTradeBenefit
} from '../../common/host-trade-benefit.schema.js';
import { HostTradeBenefitTypeEnumSchema } from '../../enums/host-trade-benefit-type.schema.js';
import { HostTradeSchema } from './host-trade.schema.js';

/**
 * @file host-trade.owner.schema.ts
 * @description What a service provider may change on their OWN directory
 * listing from `/mi-cuenta` (HOS-278 AC-8, AC-9).
 *
 * Follows SPEC-249's commerce-owner precedent: the identity fields are not
 * "validated as forbidden", they are ABSENT FROM THE SCHEMA. Zod strips keys an
 * object schema does not declare, so a payload carrying `name`, `slug`,
 * `category`, `destinationId` or `isActive` loses them at parse time and the
 * update never sees them. A field the owner cannot edit is one this file does
 * not mention — that is the whole mechanism, and it fails closed by
 * construction rather than by remembering to add a check.
 */

/**
 * The operational fields a provider owns outright.
 *
 * These apply IMMEDIATELY. They describe how to reach the provider and when,
 * which is exactly the information that goes stale and that nobody but the
 * provider can keep current — routing it through an admin queue would make the
 * directory less accurate, not more.
 */
export const HostTradeOwnerOperationalSchema = HostTradeSchema.pick({
    contact: true,
    scheduleText: true,
    is24h: true
}).partial();

/**
 * The benefit fields, which do NOT apply immediately.
 *
 * The benefit is the provider's consideration for being listed, so a change to
 * it is reviewed before the public sees it (AC-8). The service writes these to
 * the pending columns; the live ones stay untouched until an admin approves.
 */
export const HostTradeOwnerBenefitSchema = z
    .object({
        benefitType: HostTradeBenefitTypeEnumSchema.optional(),
        benefitValue: HostTradeBenefitValueSchema.nullable().optional(),
        benefitText: z
            .string()
            .max(HOST_TRADE_BENEFIT_TEXT_MAX, { message: 'zodError.hostTrade.benefitText.max' })
            .optional()
    })
    .partial();

/**
 * Full payload a provider may PATCH onto their own listing.
 *
 * The benefit refinement runs here too, so a provider cannot submit a
 * `PERCENTAGE` with no value for review — an invalid benefit should be rejected
 * at the door, not discovered by an admin days later in the review queue.
 */
export const HostTradeOwnerUpdateSchema = HostTradeOwnerOperationalSchema.merge(
    HostTradeOwnerBenefitSchema
).superRefine(refineHostTradeBenefit);

/** Inferred type for {@link HostTradeOwnerUpdateSchema}. */
export type HostTradeOwnerUpdate = z.infer<typeof HostTradeOwnerUpdateSchema>;

/**
 * The identity fields a provider may NEVER change, named explicitly.
 *
 * Exported so a guard test can assert they are absent from
 * {@link HostTradeOwnerUpdateSchema} rather than trusting that nobody widens it
 * by accident. Adding one of these to the owner schema would silently hand
 * providers control of their own visibility and categorisation — a change that
 * breaks no test unless the list it violates is written down.
 */
export const HOST_TRADE_OWNER_FORBIDDEN_FIELDS = [
    'id',
    'name',
    'slug',
    'category',
    'destinationId',
    'isActive',
    'ownerUserId',
    'benefitReviewState',
    'pendingBenefitType',
    'pendingBenefitValue',
    'pendingBenefitText',
    'revokedAt',
    'revokedById',
    'revokeReason'
] as const;

/**
 * The provider's own listing as returned by `GET /protected/host-trades/mine`.
 *
 * A read allowlist, not the full row: it carries the identity fields so the UI
 * can SHOW them (disabled, with an explanation of why — §8), the operational
 * fields it can edit, and the pending benefit so the provider can see that an
 * edit is still waiting. Audit columns and the revoking admin's id stay out.
 */
export const HostTradeOwnerViewSchema = HostTradeSchema.pick({
    id: true,
    slug: true,
    name: true,
    category: true,
    contact: true,
    benefit: true,
    benefitType: true,
    benefitValue: true,
    pendingBenefitType: true,
    pendingBenefitValue: true,
    pendingBenefitText: true,
    benefitReviewState: true,
    destinationId: true,
    is24h: true,
    scheduleText: true,
    isActive: true,
    revokedAt: true,
    revokeReason: true
});

/** Inferred type for {@link HostTradeOwnerViewSchema}. */
export type HostTradeOwnerView = z.infer<typeof HostTradeOwnerViewSchema>;
