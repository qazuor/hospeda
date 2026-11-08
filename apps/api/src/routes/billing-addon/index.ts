import { createRouter } from '../../utils/create-app';
import { protectedAddonFreeChoiceRoute } from './free-choice';
import { protectedAddonOffersRoute } from './offers';
import { protectedAddonPurchaseRoute } from './purchase';
import { protectedAddonPurchaseReadRoute } from './purchase-read';

const router = createRouter();
router.route('/', protectedAddonPurchaseRoute);
router.route('/', protectedAddonFreeChoiceRoute);
router.route('/', protectedAddonOffersRoute);
router.route('/', protectedAddonPurchaseReadRoute);

/** Protected owner addon purchase routes. */
export const protectedAddonPurchaseRoutes = router;
