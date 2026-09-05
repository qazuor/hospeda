/**
 * The partner's own in-platform statistics (HOS-1063 A-4).
 *
 * ```
 * GET /api/v1/protected/partners/mine/stats?windowDays=7|30
 * ```
 *
 * Modelled on `mine-mentions.ts`, and the parts that are copied are the parts
 * that matter:
 *
 * - **No `requiredPermissions`.** An approved partner is an ordinary account
 *   holding no `PARTNER_*` perk, so demanding one would lock them out of their
 *   own numbers (HOS-278 AC-7).
 * - **No `requireEntitlement`.** The host-side view routes (`daily-series.ts`)
 *   demand `VIEW_BASIC_STATS`; do NOT copy that half. `loadEntitlements`
 *   resolves against the ACCOMMODATION subscription and a partner subscription
 *   lives in a different product domain, so an entitlement gate here would
 *   refuse every partner who is not also a paying host — and admit a host who is
 *   not a partner, for the wrong reason (spec §5.6, NG-8).
 * - **No id in the path.** There is nothing to address but your own statistics,
 *   which is what makes "a partner cannot read another's" structural rather than
 *   a check that could be forgotten.
 * - **Fails closed to an "unavailable" payload**, never 403 and never 404. A 403
 *   would confirm a partner exists; a 404 would make an ordinary state (owning
 *   no partner) look like a broken page.
 *
 * Actor-dependent, therefore NOT cacheable. No `cacheTTL`, and it may never move
 * to the public tier.
 *
 * ## What this route does NOT do
 *
 * Decide which cards render. It ships the numbers and the three partner fields
 * `resolvePartnerLogoLink` reads, and the web component calls that function.
 * Gating here — on `tier`, say — would be a second source of truth about what
 * the home carousel actually renders (spec §7.2).
 *
 * @module routes/partners/protected/mine-stats
 */

import { PartnerStatsSchema, PartnerStatsWindowSchema } from '@repo/schemas';
import { PartnerStatsService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const statsService = new PartnerStatsService({ logger: apiLogger });

/**
 * Handler for the read. Exported standalone so it is unit-testable against a
 * mocked `Context` without booting Hono, matching `handleGetMyMentions`.
 */
export async function handleGetMyStats(ctx: Context) {
    const actor = getActorFromContext(ctx);

    // An unparseable or unsupported window falls back to the default rather than
    // 400. The window is a display preference on a page the caller already
    // reached; refusing the whole panel because a query string was hand-edited
    // trades a working page for a pedantic one.
    const parsedWindow = PartnerStatsWindowSchema.safeParse(
        ctx.req.query('windowDays') ?? undefined
    );
    const windowDays = parsedWindow.success ? parsedWindow.data : 30;

    const result = await statsService.getForOwner(actor, { windowDays });

    if (result.error) {
        // `getForOwner` has no gated failure path — no permission check, and
        // "no partner" is `{ available: false }` rather than an error — so an
        // error here is genuinely unexpected. Failing beats answering
        // `available: false`, which the panel would render as "you have no
        // partner" on the page of someone who does.
        throw new ServiceError(result.error.code, result.error.message);
    }

    return result.data ?? { available: false };
}

/**
 * GET /api/v1/protected/partners/mine/stats
 *
 * The caller's own page views and logo clicks over a 7- or 30-day window.
 */
export const protectedGetMyStatsRoute = createProtectedRoute({
    method: 'get',
    path: '/mine/stats',
    summary: "Get the caller's own partner statistics",
    description:
        'Returns in-platform statistics for the partner listing owned by the authenticated caller: views of their own page and clicks on their carousel logo, over a 7- or 30-day window. Answers { available: false } when the caller owns no partner — never 404, never 403. Social-network reach and clicks are deliberately not measured and never appear here.',
    tags: ['Partners'],
    responseSchema: PartnerStatsSchema,
    handler: async (ctx: Context) => handleGetMyStats(ctx),
    options: {
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
