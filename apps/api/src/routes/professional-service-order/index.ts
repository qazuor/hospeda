import { createRouter } from '../../utils/create-app';
import { professionalServiceOrderCreateRoute } from './create';
import { professionalServiceOrderDeleteRoute } from './delete';
import { professionalServiceOrderGetByIdRoute } from './getById';
import { professionalServiceOrderListRoute } from './list';
import { professionalServiceOrderUpdateRoute } from './update';

const router = createRouter();

router.route('/', professionalServiceOrderListRoute);
router.route('/', professionalServiceOrderCreateRoute);
router.route('/', professionalServiceOrderGetByIdRoute);
router.route('/', professionalServiceOrderUpdateRoute);
router.route('/', professionalServiceOrderDeleteRoute);

export default router;
