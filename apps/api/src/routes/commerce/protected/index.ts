/**
 * Protected commerce routes barrel (HOS-166 §6.3, §7.2)
 *
 * NEW tier — mounts under `/api/v1/protected/commerce`. Owner self-service
 * surface: create a listing, then start a subscription for it. Sits
 * alongside (and is deliberately separate from) `admin/index.ts` — the admin
 * commerce routes stay on `/api/v1/admin/commerce` as a staff escape hatch
 * (HOS-166 NG-7).
 */
import { createRouter } from '../../../utils/create-app';
import {
    protectedCreateExperienceListingRoute,
    protectedCreateGastronomyListingRoute
} from './create';
import { startCommerceSubscriptionRouter } from './start-subscription';

const router = createRouter();

// POST /listings/gastronomy — owner self-service create (§7.2)
router.route('/', protectedCreateGastronomyListingRoute);
// POST /listings/experience — owner self-service create (§7.2)
router.route('/', protectedCreateExperienceListingRoute);
// POST /listings/:entityType/:entityId/start-subscription — owner checkout (§6.3)
router.route('/', startCommerceSubscriptionRouter);

/**
 * Protected commerce routes:
 * - POST /listings/gastronomy
 * - POST /listings/experience
 * - POST /listings/:entityType/:entityId/start-subscription
 */
export const protectedCommerceRoutes = router;
