import { createRouter } from '../../utils/create-app';
import { protectedAddonFreeChoiceRoute } from './free-choice';
import { protectedOwnerRecurringAddonsRoute } from './instances';
import { protectedAddonOffersRoute } from './offers';
import { protectedAddonPurchaseRoute } from './purchase';
import { protectedAddonPurchaseReadRoute } from './purchase-read';
import { protectedAddonWithdrawalRoute } from './withdrawal';

const router = createRouter();
router.route('/', protectedAddonPurchaseRoute);
router.route('/', protectedAddonFreeChoiceRoute);
router.route('/', protectedAddonOffersRoute);
router.route('/', protectedAddonPurchaseReadRoute);
router.route('/', protectedOwnerRecurringAddonsRoute);
router.route('/', protectedAddonWithdrawalRoute);

/** Protected owner addon purchase routes. */
export const protectedAddonPurchaseRoutes = router;
