import { createRouter } from '../../utils/create-app';
import { protectedRedeemPromoCodeRoute } from './redeem';

const router = createRouter();
router.route('/', protectedRedeemPromoCodeRoute);

export { router as protectedBillingPromoRoutes };
