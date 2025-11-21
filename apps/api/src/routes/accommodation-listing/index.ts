import { createRouter } from '../../utils/create-app';
import { accommodationListingCreateRoute } from './create';
import { accommodationListingDeleteRoute } from './delete';
import { accommodationListingGetByIdRoute } from './getById';
import { accommodationListingListRoute } from './list';
import { accommodationListingUpdateRoute } from './update';

const router = createRouter();

router.route('/', accommodationListingListRoute);
router.route('/', accommodationListingCreateRoute);
router.route('/', accommodationListingGetByIdRoute);
router.route('/', accommodationListingUpdateRoute);
router.route('/', accommodationListingDeleteRoute);

export default router;
