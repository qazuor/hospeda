import { z } from 'zod';
import { EntityTypeEnum } from '../../enums/entity-type.enum.js';

/**
 * Listing traffic stats schemas (HOS-2119, spec §6.5).
 *
 * Wire shapes for the owner-facing route
 * `GET /api/v1/protected/views/:entityType/:entityId/traffic-stats?window=7d|30d|90d`,
 * backed by Umami. Separate from the `entityView` schemas because this route
 * supports a 90d window that `EntityViewWindowSchema` does not.
 */

/** Default window applied when the query omits `window`. */
export const LISTING_TRAFFIC_STATS_DEFAULT_WINDOW = '30d' as const;

/**
 * Rolling windows supported by the traffic-stats route.
 *
 * @example
 * ```ts
 * ListingTrafficStatsWindowSchema.parse('90d'); // ok
 * ListingTrafficStatsWindowSchema.parse('14d'); // throws ZodError
 * ```
 */
export const ListingTrafficStatsWindowSchema = z.enum(['7d', '30d', '90d']);

/** Window type, inferred from {@link ListingTrafficStatsWindowSchema}. */
export type ListingTrafficStatsWindow = z.infer<typeof ListingTrafficStatsWindowSchema>;

/**
 * Owner-facing listing types that have traffic stats: the subset of
 * `TRACKABLE_ENTITY_TYPES` that a user can own (no POST or EVENT).
 */
export const LISTING_TRAFFIC_STATS_ENTITY_TYPES = [
    EntityTypeEnum.ACCOMMODATION,
    EntityTypeEnum.VENUE,
    EntityTypeEnum.EXPERIENCE,
    EntityTypeEnum.PARTNER
] as const;

/**
 * Entity-type schema for the traffic-stats route.
 *
 * @example
 * ```ts
 * ListingTrafficStatsEntityTypeSchema.parse('VENUE'); // ok
 * ListingTrafficStatsEntityTypeSchema.parse('POST'); // throws ZodError
 * ```
 */
export const ListingTrafficStatsEntityTypeSchema = z.enum(LISTING_TRAFFIC_STATS_ENTITY_TYPES);

/** Entity type, inferred from {@link ListingTrafficStatsEntityTypeSchema}. */
export type ListingTrafficStatsEntityType = z.infer<typeof ListingTrafficStatsEntityTypeSchema>;

/**
 * Path params (`:entityType/:entityId`) for the traffic-stats route.
 */
export const ListingTrafficStatsParamsSchema = z.object({
    entityType: ListingTrafficStatsEntityTypeSchema,
    entityId: z.string().uuid()
});

/** Path params type. */
export type ListingTrafficStatsParams = z.infer<typeof ListingTrafficStatsParamsSchema>;

/**
 * Query params for the traffic-stats route. `window` defaults to `'30d'`.
 */
export const ListingTrafficStatsQuerySchema = z.object({
    window: ListingTrafficStatsWindowSchema.default(LISTING_TRAFFIC_STATS_DEFAULT_WINDOW)
});

/** Query params type (output, after defaults). */
export type ListingTrafficStatsQuery = z.infer<typeof ListingTrafficStatsQuerySchema>;

/**
 * Reserved referrer `value` for DIRECT traffic (visits with no referrer).
 * Umami's referrer metrics never include direct visits, so the service
 * computes them (`max(0, totalVisitors - sum(referrer visitors))`) and appends
 * a row with this value. The UI must render it with the i18n key
 * `traffic.referrers.direct` instead of showing the raw value.
 *
 * **It is an approximation.** Umami counts a visitor once per referrer row, so a
 * visitor who arrived through several referrers in the window is counted in each
 * row and the sum can exceed the total (which understates direct traffic, clamped
 * at 0). Same-site navigation is not a referrer row either (Umami drops it, measured
 * on 3.5.0); it is reported separately as {@link LISTING_TRAFFIC_INTERNAL_REFERRER}
 * and subtracted from direct.
 *
 * The service never trusts a raw referrer row equal to this sentinel (or to the
 * internal one): a forged referrer host `(direct)` is a valid URL host, so such
 * rows are dropped before the computed rows are derived.
 */
export const LISTING_TRAFFIC_DIRECT_REFERRER = '(direct)' as const;

/**
 * Reserved referrer `value` for INTERNAL navigation: visitors who entered the
 * listing page from another page of the Hospeda site. Umami hides same-site
 * referrers, so the listing pages send a dedicated `listing_internal_entry`
 * event and the service turns its distinct-visitor count into a row with this
 * value. The UI must render it with the i18n key `traffic.referrers.internal`
 * instead of showing the raw value.
 *
 * Like direct it is an approximation: the count is clamped to the visitors not
 * already explained by an external referrer, and raw rows equal to this value
 * are dropped as forgeries.
 */
export const LISTING_TRAFFIC_INTERNAL_REFERRER = '(internal)' as const;

/**
 * One breakdown row (referrer host, country code or device type) with its
 * non-negative integer count.
 *
 * @example
 * ```ts
 * const row: ListingTrafficBreakdownItem = { value: 'google.com', count: 12 };
 * ```
 */
export const ListingTrafficBreakdownItemSchema = z.object({
    /** Dimension value as reported by Umami (e.g. `google.com`, `AR`, `mobile`). */
    value: z.string(),
    /** Distinct visitors for this value. Non-negative integer. */
    count: z.number().int().nonnegative()
});

/** Breakdown row type. */
export type ListingTrafficBreakdownItem = z.infer<typeof ListingTrafficBreakdownItemSchema>;

/**
 * Contact funnel (views, then contact started, then contact completed).
 * Present for ACCOMMODATION only.
 */
export const ListingContactFunnelSchema = z.object({
    views: z.number().int().nonnegative(),
    contactStarted: z.number().int().nonnegative(),
    contactCompleted: z.number().int().nonnegative()
});

/** Contact funnel type. */
export type ListingContactFunnel = z.infer<typeof ListingContactFunnelSchema>;

/**
 * Response of `GET /api/v1/protected/views/:entityType/:entityId/traffic-stats`.
 *
 * - `available: false` means Umami failed or timed out: the arrays are empty
 *   and `contactFunnel` is `null` (or all zeros). The route never answers 5xx
 *   for that; the schema enforces the invariant.
 * - `contactFunnel` is an object for ACCOMMODATION and `null` for VENUE,
 *   EXPERIENCE and PARTNER.
 *
 * @example
 * ```ts
 * ListingTrafficStatsResponseSchema.parse({
 *   window: '7d',
 *   available: false,
 *   referrers: [],
 *   countries: [],
 *   devices: [],
 *   contactFunnel: null
 * });
 * ```
 */
export const ListingTrafficStatsResponseSchema = z
    .object({
        window: ListingTrafficStatsWindowSchema,
        available: z.boolean(),
        referrers: z.array(ListingTrafficBreakdownItemSchema),
        countries: z.array(ListingTrafficBreakdownItemSchema),
        devices: z.array(ListingTrafficBreakdownItemSchema),
        contactFunnel: ListingContactFunnelSchema.nullable()
    })
    .refine(
        (value) =>
            value.available ||
            (value.referrers.length === 0 &&
                value.countries.length === 0 &&
                value.devices.length === 0 &&
                (value.contactFunnel === null ||
                    (value.contactFunnel.views === 0 &&
                        value.contactFunnel.contactStarted === 0 &&
                        value.contactFunnel.contactCompleted === 0))),
        {
            message:
                'available=false requires empty referrers/countries/devices and a null or all-zero contactFunnel',
            path: ['available']
        }
    );

/** Response type, inferred from {@link ListingTrafficStatsResponseSchema}. */
export type ListingTrafficStatsResponse = z.infer<typeof ListingTrafficStatsResponseSchema>;
