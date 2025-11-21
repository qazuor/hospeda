import { createRouter } from '../../utils/create-app';
import { adSlotCreateRoute } from './create';
import { adSlotDeleteRoute } from './delete';
import { adSlotGetByIdRoute } from './getById';
import { adSlotListRoute } from './list';
import { adSlotUpdateRoute } from './update';

const router = createRouter();

// Register all ad slot routes
router.route('/', adSlotListRoute);
router.route('/', adSlotCreateRoute);
router.route('/', adSlotGetByIdRoute);
router.route('/', adSlotUpdateRoute);
router.route('/', adSlotDeleteRoute);

export default router;
