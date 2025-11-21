import { createRouter } from '../../utils/create-app';
import { refundCreateRoute } from './create';
import { refundDeleteRoute } from './delete';
import { refundGetByIdRoute } from './getById';
import { refundListRoute } from './list';
import { refundUpdateRoute } from './update';

const router = createRouter();

// Register all refund routes
router.route('/', refundListRoute);
router.route('/', refundCreateRoute);
router.route('/', refundGetByIdRoute);
router.route('/', refundUpdateRoute);
router.route('/', refundDeleteRoute);

export default router;
