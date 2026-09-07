/**
 * Schemas for the partner's own in-platform statistics (HOS-1063 A-3 / A-4).
 *
 * Two surfaces live here:
 *
 *  1. {@link PartnerLogoClickCaptureBodySchema} — the public capture endpoint's
 *     body, the sibling of `CaptureViewBodySchema`.
 *  2. {@link PartnerStatsSchema} — the owner-facing read payload behind
 *     `GET /api/v1/protected/partners/mine/stats`.
 *
 * ## What this payload deliberately does NOT decide
 *
 * It carries the NUMBERS and the few partner fields needed to resolve the
 * partner's logo link, and it does not say which cards to render. That decision
 * belongs to exactly one function — `resolvePartnerLogoLink` in `apps/web` — for
 * the reason spelled out in spec §7.2: any card whose visibility were derived
 * here, from `tier`, would be a SECOND source of truth about what the home
 * carousel actually renders, and the two would part ways the moment HOS-1159
 * changes silver's clickability. Shipping the inputs instead of the verdict is
 * what makes the panel structurally unable to contradict the carousel.
 *
 * A consequence worth stating: `views` and `clicks` are always present, even for
 * a partner whose logo links nowhere. They are the honest count of a thing that
 * did not happen. Turning "no surface" into a rendered `0` is the bug G-3 names,
 * and it is prevented in the component that omits the card — not by nulling a
 * number here.
 *
 * @module entities/partner/partner-stats.schema
 */

import { z } from 'zod';
import { PartnerLogoClickDestinationEnumSchema } from '../../enums/partner-logo-click-destination.schema.js';

/**
 * Body of `POST /api/v1/public/partner-logo-clicks`.
 *
 * Shaped after `CaptureViewBodySchema`: the client sends only what it cannot
 * lie about usefully. `visitorHash` is computed server-side from the request,
 * never accepted from the caller, so a client cannot forge a distinct visitor.
 */
export const PartnerLogoClickCaptureBodySchema = z.object({
    /** UUID of the partner whose logo was clicked. */
    partnerId: z
        .string({ message: 'zodError.partnerLogoClick.partnerId.required' })
        .uuid({ message: 'zodError.partnerLogoClick.partnerId.invalidUuid' }),
    /**
     * Which linking branch the click followed.
     *
     * Sent by the client because only the browser knows which anchor was
     * clicked, and re-deriving it server-side would mean re-resolving the link
     * from the partner row — a second implementation of
     * `resolvePartnerLogoLink` living in a different language. A caller who lies
     * about it mis-tags their own click and changes no total, since both
     * destinations count toward the one number the partner sees.
     */
    destination: PartnerLogoClickDestinationEnumSchema
});

/** Inferred type of the logo-click capture body. */
export type PartnerLogoClickCaptureBody = z.infer<typeof PartnerLogoClickCaptureBodySchema>;

/**
 * One metric's deduplicated counts over the requested window.
 *
 * `unique` and `total` mean the same thing here as everywhere else in the
 * view-tracking system, and that is deliberate: the panel puts views and clicks
 * side by side, and two numbers computed by two different rules invite a
 * comparison that means nothing.
 */
export const PartnerStatsCountsSchema = z.object({
    /** Distinct visitor fingerprints in the window. */
    unique: z.number().int().nonnegative(),
    /** Deduplicated total events in the window (30-minute bucket rule). */
    total: z.number().int().nonnegative()
});

/** Inferred type of one metric's counts. */
export type PartnerStatsCounts = z.infer<typeof PartnerStatsCountsSchema>;

/**
 * The subset of the caller's partner needed to resolve their logo link.
 *
 * These are exactly the three fields `resolvePartnerLogoLink` reads, plus the
 * identifiers the panel needs to label itself. Nothing else is included —
 * this endpoint is a statistics read, not a second `GET /mine`.
 */
export const PartnerStatsSubjectSchema = z.object({
    /** The partner's UUID. */
    id: z.string().uuid(),
    /** Display name, for the panel heading. */
    name: z.string(),
    /** Slug, when the partner has one. Half of the "has a public page" test. */
    slug: z.string().optional(),
    /** Commercial tier. Read ONLY by `resolvePartnerLogoLink`, never rendered. */
    tier: z.string().optional(),
    /** The partner's own website, when they filled one in. */
    websiteUrl: z.string().optional()
});

/** Inferred type of the partner descriptor. */
export type PartnerStatsSubject = z.infer<typeof PartnerStatsSubjectSchema>;

/**
 * Response of `GET /api/v1/protected/partners/mine/stats`.
 *
 * `available: false` with nothing else is the answer for an actor who owns no
 * partner — and for a guest. Never a 403 and never a 404, matching
 * `mine-mentions`: a 403 would confirm a partner exists, and a 404 would make an
 * ordinary state look like a broken page.
 */
export const PartnerStatsSchema = z.object({
    /** Whether the caller owns a partner whose statistics could be resolved. */
    available: z.boolean(),
    /** The caller's partner. Absent exactly when `available` is false. */
    partner: PartnerStatsSubjectSchema.optional(),
    /** Rolling window the counts cover, in days. */
    windowDays: z.number().int().positive().optional(),
    /** Views of the partner's own page. Absent exactly when `available` is false. */
    views: PartnerStatsCountsSchema.optional(),
    /** Clicks on the partner's carousel logo. Absent exactly when `available` is false. */
    clicks: PartnerStatsCountsSchema.optional()
});

/** Inferred type of the partner statistics payload. */
export type PartnerStats = z.infer<typeof PartnerStatsSchema>;

/**
 * Accepted rolling windows for the panel.
 *
 * 7 and 30 only, matching `EntityViewWindowSchema` and the host widget (§7.4).
 * No custom ranges: a range the purge horizon cannot honour is a range that
 * silently truncates.
 */
export const PartnerStatsWindowSchema = z.coerce
    .number()
    .int()
    .refine((v): v is 7 | 30 => v === 7 || v === 30, {
        message: 'zodError.partnerStats.windowDays.unsupported'
    })
    .default(30);
