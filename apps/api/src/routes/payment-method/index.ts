import { createRouter } from '../../utils/create-app';
import { paymentMethodCreateRoute } from './create';
import { paymentMethodDeleteRoute } from './delete';
import { paymentMethodGetByIdRoute } from './getById';
import { paymentMethodListRoute } from './list';
import { paymentMethodUpdateRoute } from './update';

const router = createRouter();

// Register all payment method routes
router.route('/', paymentMethodListRoute);
router.route('/', paymentMethodCreateRoute);
router.route('/', paymentMethodGetByIdRoute);
router.route('/', paymentMethodUpdateRoute);
router.route('/', paymentMethodDeleteRoute);

export default router;
