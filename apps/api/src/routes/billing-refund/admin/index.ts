import { createRouter } from '../../../utils/create-app';
import { adminConfirmRefundRoute } from './confirm';
import { adminDeclineRefundRoute } from './decline';
import { adminSettleExternalRefundRoute } from './settle-external';
import { adminSettleExternalChargeRoute } from './settle-external-charge';

const router = createRouter();
router.route('/', adminConfirmRefundRoute);
router.route('/', adminDeclineRefundRoute);
router.route('/', adminSettleExternalRefundRoute);
router.route('/', adminSettleExternalChargeRoute);

/** Admin action 13 confirmation (RF2), refusal (RF5), and action 14 external settlement routes. */
export { router as adminBillingRefundRoutes };
