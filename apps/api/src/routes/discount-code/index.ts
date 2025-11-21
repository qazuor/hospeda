import { createRouter } from '../../utils/create-app';
import { discountCodeCreateRoute } from './create';
import { discountCodeDeleteRoute } from './delete';
import { discountCodeGetByIdRoute } from './getById';
import { discountCodeListRoute } from './list';
import { discountCodeUpdateRoute } from './update';

const router = createRouter();

router.route('/', discountCodeListRoute);
router.route('/', discountCodeCreateRoute);
router.route('/', discountCodeGetByIdRoute);
router.route('/', discountCodeUpdateRoute);
router.route('/', discountCodeDeleteRoute);

export default router;
