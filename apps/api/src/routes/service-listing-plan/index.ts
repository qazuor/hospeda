import { createRouter } from '../../utils/create-app';
import { serviceListingPlanCreateRoute } from './create';
import { serviceListingPlanDeleteRoute } from './delete';
import { serviceListingPlanGetByIdRoute } from './getById';
import { serviceListingPlanListRoute } from './list';
import { serviceListingPlanUpdateRoute } from './update';

const router = createRouter();

router.route('/', serviceListingPlanListRoute);
router.route('/', serviceListingPlanCreateRoute);
router.route('/', serviceListingPlanGetByIdRoute);
router.route('/', serviceListingPlanUpdateRoute);
router.route('/', serviceListingPlanDeleteRoute);

export default router;
