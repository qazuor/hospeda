/**
 * Protected commerce routes barrel
 *
 * Mounts under `/api/v1/protected/commerce`. Owner self-service surface for
 * listing CRUD. The subscription checkout / change-plan / downgrade-preview /
 * trial-verdict routes were removed with the legacy billing system
 * (HOS-1416); the admin commerce routes stay on `/api/v1/admin/commerce` as
 * a staff escape hatch (HOS-166 NG-7).
 *
 * `GET /leads/mine` (HOS-257 pre-fill read) was removed by HOS-693 §6.2
 * along with the admin provisioning path that was its only writer of
 * `commerce_leads.provisionedUserId` — the field this endpoint scoped by.
 * `CommerceLeadService.getMyLead` itself is untouched (HOS-693's own scope
 * note: "the rest remains").
 */
import { createRouter } from '../../../utils/create-app';
import {
    protectedCreateExperienceListingRoute,
    protectedCreateGastronomyListingRoute
} from './create';
import { protectedDeleteCommerceDraftRoute } from './delete-draft';

const router = createRouter();

// POST /listings/gastronomy — owner self-service create (§7.2)
router.route('/', protectedCreateGastronomyListingRoute);
// POST /listings/experience — owner self-service create (§7.2)
router.route('/', protectedCreateExperienceListingRoute);
// DELETE /listings/:vertical/:id — owner discards one of their own DRAFTs
// (HOS-1156 AC-14). One route for both verticals, unlike the create pair above:
// a delete has no payload, so the vertical only picks which service answers.
router.route('/', protectedDeleteCommerceDraftRoute);

/**
 * Protected commerce routes:
 * - POST /listings/gastronomy
 * - POST /listings/experience
 * - DELETE /listings/:vertical/:id
 */
export const protectedCommerceRoutes = router;
