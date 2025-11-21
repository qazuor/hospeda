import { createRouter } from '../../utils/create-app';
import { touristServiceCreateRoute } from './create';
import { touristServiceDeleteRoute } from './delete';
import { touristServiceGetByIdRoute } from './getById';
import { touristServiceListRoute } from './list';
import { touristServiceUpdateRoute } from './update';

const router = createRouter();

router.route('/', touristServiceListRoute);
router.route('/', touristServiceCreateRoute);
router.route('/', touristServiceGetByIdRoute);
router.route('/', touristServiceUpdateRoute);
router.route('/', touristServiceDeleteRoute);

export default router;
