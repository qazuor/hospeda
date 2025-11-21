import { createRouter } from '../../utils/create-app';
import { benefitListingPlanCreateRoute } from './create';
import { benefitListingPlanDeleteRoute } from './delete';
import { benefitListingPlanGetByIdRoute } from './getById';
import { benefitListingPlanListRoute } from './list';
import { benefitListingPlanUpdateRoute } from './update';

const router = createRouter();

router.route('/', benefitListingPlanListRoute);
router.route('/', benefitListingPlanCreateRoute);
router.route('/', benefitListingPlanGetByIdRoute);
router.route('/', benefitListingPlanUpdateRoute);
router.route('/', benefitListingPlanDeleteRoute);

export default router;
