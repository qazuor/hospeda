import { createRouter } from '../../utils/create-app';
import { accommodationListingPlanCreateRoute } from './create';
import { accommodationListingPlanDeleteRoute } from './delete';
import { accommodationListingPlanGetByIdRoute } from './getById';
import { accommodationListingPlanListRoute } from './list';
import { accommodationListingPlanUpdateRoute } from './update';

const router = createRouter();

router.route('/', accommodationListingPlanListRoute);
router.route('/', accommodationListingPlanCreateRoute);
router.route('/', accommodationListingPlanGetByIdRoute);
router.route('/', accommodationListingPlanUpdateRoute);
router.route('/', accommodationListingPlanDeleteRoute);

export default router;
