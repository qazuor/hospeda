import type { z } from 'zod';
import { partnerSchema } from './partner.schema.js';

/**
 * @file partner.owner.schema.ts
 * @description What a partner may change on their OWN listing from
 * `/mi-cuenta` (HOS-278 D3).
 *
 * Follows the `host_trades` precedent exactly: the identity and commercial
 * fields are not "validated as forbidden", they are ABSENT FROM THE SCHEMA. Zod
 * strips keys an object schema does not declare, so a payload carrying `name`,
 * `slug`, `tier` or `subscriptionStatus` loses them at parse time and the
 * update never sees them. A field the owner cannot edit is one this file does
 * not mention — the mechanism fails closed by construction rather than by
 * remembering to add a check.
 */

/**
 * The operational fields a partner owns outright.
 *
 * These apply IMMEDIATELY. Contact details and social links are the facts that
 * go stale and that nobody but the partner can keep current; routing them
 * through an admin queue would make the directory less accurate, not more.
 * Same split `host_trades` draws between its contact/schedule fields and its
 * benefit.
 *
 * Both columns are shallow-MERGED by `PartnerModel`, so a form that models only
 * the phone cannot delete the address it never sent.
 */
export const PartnerOwnerOperationalSchema = partnerSchema
    .pick({
        contactInfo: true,
        socialNetworks: true
    })
    .partial();

/**
 * The content fields, which do NOT apply immediately.
 *
 * Step 4 of §6.3 — "un admin revisa logo y textos" — and the reason the pending
 * columns exist. The service writes these to the pending trio; the live ones
 * stay untouched until an admin approves, so a partner who is already published
 * never drops off the carousel while an edit waits in the queue.
 */
export const PartnerOwnerContentSchema = partnerSchema
    .pick({
        logoUrl: true,
        description: true,
        websiteUrl: true
    })
    .partial();

/**
 * Full payload a partner may PATCH onto their own listing.
 *
 * No `.superRefine()` here, deliberately: unlike the host-trade benefit — where
 * a `PERCENTAGE` with no value is incoherent and must be rejected at the door —
 * these three fields carry no cross-field invariant. Each is independently
 * valid or not, and Zod already says so.
 */
export const PartnerOwnerUpdateSchema =
    PartnerOwnerOperationalSchema.merge(PartnerOwnerContentSchema);

/** Inferred type for {@link PartnerOwnerUpdateSchema}. */
export type PartnerOwnerUpdate = z.infer<typeof PartnerOwnerUpdateSchema>;

/**
 * The fields a partner may NEVER change, named explicitly.
 *
 * Exported so a guard test can assert they are absent from
 * {@link PartnerOwnerUpdateSchema} rather than trusting that nobody widens it
 * by accident. Three groups, each dangerous in its own way:
 *
 * - **Identity** (`name`, `slug`, `type`) — what the partner IS, and what the
 *   public URL resolves to. An owner who could rewrite their slug would break
 *   every link to their own ficha.
 * - **Commercial** (`tier`, `planId`, `subscriptionId`, `subscriptionStatus`,
 *   `startsAt`, `endsAt`, `lifecycleState`) — an owner who could set
 *   `subscriptionStatus` would publish themselves without paying, which is the
 *   entire point of §6.3's ordering.
 * - **Review** (the pending trio, the review state and note, and the approval
 *   stamp) — an owner who could set `contentApprovedAt` would approve their own
 *   content, which is AC-11 defeated in one field.
 */
export const PARTNER_OWNER_FORBIDDEN_FIELDS = [
    'id',
    'name',
    'slug',
    'type',
    'tier',
    'planId',
    'subscriptionId',
    'subscriptionStatus',
    'lifecycleState',
    'startsAt',
    'endsAt',
    'ownerUserId',
    'analytics',
    'pendingLogoUrl',
    'pendingDescription',
    'pendingWebsiteUrl',
    'contentReviewState',
    'contentReviewNote',
    'contentApprovedAt',
    'contentApprovedById'
] as const;

/**
 * The partner's own listing as returned by `GET /protected/partners/mine`.
 *
 * A read allowlist, not the full row. It carries:
 *
 * - the identity fields so the UI can SHOW them disabled, with an explanation
 *   of why (§8), exactly as the provider ficha does;
 * - the live content, so the partner sees what the public sees;
 * - the PENDING content and its review state, so "your logo is still being
 *   reviewed" is something the page can actually say;
 * - `contentApprovedAt`, because it is what decides whether the page offers a
 *   payment CTA or a "waiting for review" notice (AC-11, §8).
 *
 * `contentApprovedById` stays out: which admin approved it is an audit fact,
 * not something the partner needs. Audit columns stay out for the same reason.
 */
export const PartnerOwnerViewSchema = partnerSchema.pick({
    id: true,
    slug: true,
    name: true,
    type: true,
    tier: true,
    logoUrl: true,
    description: true,
    websiteUrl: true,
    contactInfo: true,
    socialNetworks: true,
    subscriptionStatus: true,
    lifecycleState: true,
    startsAt: true,
    endsAt: true,
    pendingLogoUrl: true,
    pendingDescription: true,
    pendingWebsiteUrl: true,
    contentReviewState: true,
    contentReviewNote: true,
    contentApprovedAt: true
});

/** Inferred type for {@link PartnerOwnerViewSchema}. */
export type PartnerOwnerView = z.infer<typeof PartnerOwnerViewSchema>;
