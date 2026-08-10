/**
 * Protected host-trade routes
 * Requires authentication and HOST_TRADE_VIEW permission
 */
import { createRouter } from '../../../utils/create-app';
import { protectedListProviderReviewsRoute } from './directory-reviews';
import { protectedGetHostTradeBySlugRoute } from './get-by-slug';
import { protectedListHostTradesRoute } from './list';
import { protectedGetMyHostTradeRoute, protectedUpdateMyHostTradeRoute } from './mine';
import { protectedGetMyQrRoute } from './mine-qr';
import {
    protectedDeclareUsageAsProviderRoute,
    protectedListLinkedHostsRoute,
    protectedListOwnUsagesRoute
} from './mine-usages';
import { protectedCreateReplyRoute, protectedUpdateReplyRoute } from './replies';
import {
    protectedCreateReviewRoute,
    protectedGetMyReviewRoute,
    protectedUpdateReviewRoute
} from './reviews';
import {
    protectedConfirmUsageRoute,
    protectedRejectUsageRoute,
    protectedUndoRejectionRoute
} from './usage-transitions';
import {
    protectedCountPendingUsagesRoute,
    protectedDeclareUsageRoute,
    protectedListHostUsagesRoute,
    protectedListPendingUsagesRoute
} from './usages';

const protectedRouter = createRouter();

// GET / - List host-trade entries for the authenticated host
protectedRouter.route('/', protectedListHostTradesRoute);

// GET|PATCH /mine - The caller's OWN listing (HOS-278 AC-7..AC-10).
// Auth-only, no HOST_TRADE_* permission: an approved service provider is an
// ordinary account, and the host-directory read perk is a different thing.
protectedRouter.route('/', protectedGetMyHostTradeRoute);
protectedRouter.route('/', protectedUpdateMyHostTradeRoute);

// Literal paths before the parameterised one (HOS-376 T-030).
//
// MEASURED, not assumed: with this order inverted, `GET /usages/pending` still
// reaches the inbox — Hono's selected router gives a static segment precedence
// over `:slug` regardless of registration sequence. So this order is DEFENCE IN
// DEPTH, not the thing that makes routing correct. It is kept because which
// router `SmartRouter` picks is Hono's decision, not a contract we hold, and a
// first-match-wins router would read `/usages/pending` as "declare a usage on
// the provider whose slug is `usages`" — a 404-shaped mystery, not a crash.
//
// What actually guarantees the behaviour is the request-level test in
// `test/routes/host-trade/usages.test.ts`.
protectedRouter.route('/', protectedListPendingUsagesRoute);
protectedRouter.route('/', protectedCountPendingUsagesRoute);

// The host's own record (HOS-376 T-046). `/usages` is ONE segment, exactly like
// the parameterised `GET /{slug}` registered at the bottom, so `usages` is a
// candidate slug — the same shape as the `/mine` case, not the longer-path cases
// above. Registered here, well ahead of it, and asserted by request in
// `test/routes/host-trade/usages.test.ts`.
protectedRouter.route('/', protectedListHostUsagesRoute);

// The provider's own side (HOS-376 T-031). `/mine/usages` overlaps `/{slug}/usages`
// exactly as `/usages/pending` does — "mine" is a candidate `:slug` — so it is
// registered ahead of it for the same defence-in-depth reason.
protectedRouter.route('/', protectedDeclareUsageAsProviderRoute);
protectedRouter.route('/', protectedListOwnUsagesRoute);
protectedRouter.route('/', protectedListLinkedHostsRoute);
protectedRouter.route('/', protectedGetMyQrRoute);

// The shared transitions (HOS-376 T-033). Role-blind by design: `declaredBy`
// on the row decides who may answer, so one pair of endpoints serves a host and
// a provider identically.
//
// `/reject/undo` sits before `/reject` for tidiness, NOT because it changes
// anything — measured, same as the `/usages/pending` case above: Hono's
// selected router resolves by specificity, so the longer path wins whatever the
// registration sequence. Ordering here buys a safety margin against a
// first-match-wins router, nothing more. The request-level tests are what
// guarantee the undo reaches the undo.
protectedRouter.route('/', protectedConfirmUsageRoute);
protectedRouter.route('/', protectedUndoRejectionRoute);
protectedRouter.route('/', protectedRejectUsageRoute);

// The host's review of a provider (HOS-376 T-034). `/reviews/{id}` is a
// literal-first path exactly like `/usages/pending`, so it is registered ahead
// of the parameterised `/{id}/reviews` for the same defence-in-depth reason —
// the two never collide today because they differ in method, and this ordering
// is what keeps that true if either ever gains the other's verb.
protectedRouter.route('/', protectedUpdateReviewRoute);
protectedRouter.route('/', protectedCreateReviewRoute);
protectedRouter.route('/', protectedGetMyReviewRoute);

// The provider's right of reply (HOS-376 T-035). `/reviews/{id}/reply` shares
// its verb with `/{id}/reviews` and differs only in shape, so it is registered
// ahead of it for the same defence-in-depth reason as the pair above.
protectedRouter.route('/', protectedCreateReplyRoute);
protectedRouter.route('/', protectedUpdateReplyRoute);

// The directory's own review listing (HOS-376 T-036).
protectedRouter.route('/', protectedListProviderReviewsRoute);

protectedRouter.route('/', protectedDeclareUsageRoute);

// The single-provider read the QR landing page runs on (HOS-376 T-045). It is
// registered LAST of all, and here the ordering is less theoretical than the
// cases above: `GET /{slug}` is ONE segment long, exactly like the literal
// `GET /mine`, so `mine` is a candidate slug rather than a longer or shorter
// path that specificity separates on its own. `test/routes/host-trade/
// get-by-slug.test.ts` asserts by request that `/mine` still reaches the
// own-listing handler with both mounted, and that a real slug still reaches
// this one.
protectedRouter.route('/', protectedGetHostTradeBySlugRoute);

export { protectedRouter as protectedHostTradeRoutes };
