import { createRouter } from '../../../utils/create-app';
import { adminClosePromoCodeRoute } from './close';
import { adminCreatePromoCodeRoute } from './create';
import { adminListPromoCodesRoute } from './list';

const router = createRouter();
router.route('/', adminListPromoCodesRoute);
router.route('/', adminCreatePromoCodeRoute);
router.route('/', adminClosePromoCodeRoute);

export { router as adminBillingPromoCodeRoutes };
