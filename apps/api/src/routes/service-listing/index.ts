import { createRouter } from '../../utils/create-app';
import { serviceListingCreateRoute } from './create';
import { serviceListingDeleteRoute } from './delete';
import { serviceListingGetByIdRoute } from './getById';
import { serviceListingListRoute } from './list';
import { serviceListingUpdateRoute } from './update';

const router = createRouter();

router.route('/', serviceListingListRoute);
router.route('/', serviceListingCreateRoute);
router.route('/', serviceListingGetByIdRoute);
router.route('/', serviceListingUpdateRoute);
router.route('/', serviceListingDeleteRoute);

export default router;
