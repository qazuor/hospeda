import { createRouter } from '../../utils/create-app';
import { notificationCreateRoute } from './create';
import { notificationDeleteRoute } from './delete';
import { notificationGetByIdRoute } from './getById';
import { notificationListRoute } from './list';
import { notificationUpdateRoute } from './update';

const router = createRouter();

router.route('/', notificationListRoute);
router.route('/', notificationCreateRoute);
router.route('/', notificationGetByIdRoute);
router.route('/', notificationUpdateRoute);
router.route('/', notificationDeleteRoute);

export default router;
