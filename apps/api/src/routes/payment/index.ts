import { createRouter } from '../../utils/create-app';
import { paymentCreateRoute } from './create';
import { paymentDeleteRoute } from './delete';
import { paymentGetByIdRoute } from './getById';
import { paymentListRoute } from './list';
import { paymentUpdateRoute } from './update';

const router = createRouter();

// Register all payment routes
router.route('/', paymentListRoute);
router.route('/', paymentCreateRoute);
router.route('/', paymentGetByIdRoute);
router.route('/', paymentUpdateRoute);
router.route('/', paymentDeleteRoute);

export default router;
