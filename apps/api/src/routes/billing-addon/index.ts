import { createRouter } from '../../utils/create-app';
import { protectedAddonPurchaseRoute } from './purchase';
import { protectedAddonPurchaseReadRoute } from './purchase-read';

const router = createRouter();
router.route('/', protectedAddonPurchaseRoute);
router.route('/', protectedAddonPurchaseReadRoute);

/** Protected owner addon purchase routes. */
export const protectedAddonPurchaseRoutes = router;
