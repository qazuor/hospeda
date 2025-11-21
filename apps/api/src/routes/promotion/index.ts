import { createRouter } from '../../utils/create-app';
import { promotionCreateRoute } from './create';
import { promotionDeleteRoute } from './delete';
import { promotionGetByIdRoute } from './getById';
import { promotionListRoute } from './list';
import { promotionUpdateRoute } from './update';

const router = createRouter();

router.route('/', promotionListRoute);
router.route('/', promotionCreateRoute);
router.route('/', promotionGetByIdRoute);
router.route('/', promotionUpdateRoute);
router.route('/', promotionDeleteRoute);

export default router;
