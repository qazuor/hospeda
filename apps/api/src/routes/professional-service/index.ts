import { createRouter } from '../../utils/create-app';
import { professionalServiceCreateRoute } from './create';
import { professionalServiceDeleteRoute } from './delete';
import { professionalServiceGetByIdRoute } from './getById';
import { professionalServiceListRoute } from './list';
import { professionalServiceUpdateRoute } from './update';

const router = createRouter();

router.route('/', professionalServiceListRoute);
router.route('/', professionalServiceCreateRoute);
router.route('/', professionalServiceGetByIdRoute);
router.route('/', professionalServiceUpdateRoute);
router.route('/', professionalServiceDeleteRoute);

export default router;
