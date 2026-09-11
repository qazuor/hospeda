/**
 * Protected commerce routes barrel (HOS-166 §6.3, §7.2)
 *
 * NEW tier — mounts under `/api/v1/protected/commerce`. Owner self-service
 * surface: create a listing, then start a subscription for it. Sits
 * alongside (and is deliberately separate from) `admin/index.ts` — the admin
 * commerce routes stay on `/api/v1/admin/commerce` as a staff escape hatch
 * (HOS-166 NG-7).
 *
 * `GET /leads/mine` (HOS-257 pre-fill read) was removed by HOS-693 §6.2
 * along with the admin provisioning path that was its only writer of
 * `commerce_leads.provisionedUserId` — the field this endpoint scoped by.
 * `CommerceLeadService.getMyLead` itself is untouched (HOS-693's own scope
 * note: "the rest remains").
 */
import { createRouter } from '../../../utils/create-app';
import { commerceChangePlanRouter } from './change-plan';
import {
    protectedCreateExperienceListingRoute,
    protectedCreateGastronomyListingRoute
} from './create';
import { protectedDeleteCommerceDraftRoute } from './delete-draft';
import { commerceDowngradePreviewRouter } from './downgrade-preview';
import { startCommerceSubscriptionRouter } from './start-subscription';
import { commerceTrialVerdictRouter } from './trial-verdict';

const router = createRouter();

// POST /listings/gastronomy — owner self-service create (§7.2)
router.route('/', protectedCreateGastronomyListingRoute);
// POST /listings/experience — owner self-service create (§7.2)
router.route('/', protectedCreateExperienceListingRoute);
// POST /listings/:entityType/:entityId/start-subscription — owner checkout (§6.3)
router.route('/', startCommerceSubscriptionRouter);
// POST /subscriptions/:entityType/change-plan — owner tier change (HOS-1119).
// Keyed by VERTICAL, not by listing: since HOS-688 a commerce subscription
// belongs to an owner and a vertical, and several listings hang off one.
router.route('/', commerceChangePlanRouter);
// DELETE /listings/:vertical/:id — owner discards one of their own DRAFTs
// (HOS-1156 AC-14). One route for both verticals, unlike the create pair above:
// a delete has no payload, so the vertical only picks which service answers.
router.route('/', protectedDeleteCommerceDraftRoute);
// GET /subscriptions/:entityType/downgrade-preview — read-only (HOS-1122).
// Mounted AFTER the change-plan router but on a distinct method+path, so the
// order is cosmetic; it lives beside it because the two are one flow: preview
// what a cheaper tier stops covering, then post the change with the keep set.
router.route('/', commerceDowngradePreviewRouter);
// GET /subscriptions/:entityType/trial-verdict — read-only (HOS-1184). What
// publishing in this vertical would do right now: start a free trial, attach to
// a subscription already being paid for, or open a checkout. Three states and
// never a boolean, because the first two both mean "publishing costs nothing
// today" and differ only in whether a clock starts.
router.route('/', commerceTrialVerdictRouter);

/**
 * Protected commerce routes:
 * - POST /listings/gastronomy
 * - POST /listings/experience
 * - POST /listings/:entityType/:entityId/start-subscription
 * - POST /subscriptions/:entityType/change-plan
 * - DELETE /listings/:vertical/:id
 * - GET  /subscriptions/:entityType/downgrade-preview
 * - GET  /subscriptions/:entityType/trial-verdict
 */
export const protectedCommerceRoutes = router;
