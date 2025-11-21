import { createRouter } from '../../utils/create-app';
import { benefitListingCreateRoute } from './create';
import { benefitListingDeleteRoute } from './delete';
import { benefitListingGetByIdRoute } from './getById';
import { benefitListingListRoute } from './list';
import { benefitListingUpdateRoute } from './update';

const router = createRouter();

router.route('/', benefitListingListRoute);
router.route('/', benefitListingCreateRoute);
router.route('/', benefitListingGetByIdRoute);
router.route('/', benefitListingUpdateRoute);
router.route('/', benefitListingDeleteRoute);

export default router;
