import { createRouter } from '../../../utils/create-app';
import { adminSettleExternalRefundRoute } from './settle-external';
import { adminSettleExternalChargeRoute } from './settle-external-charge';

const router = createRouter();
router.route('/', adminSettleExternalRefundRoute);
router.route('/', adminSettleExternalChargeRoute);

/** Admin action 14 routes, mounted at `/api/v1/admin/billing-refunds`: external refund (RF4) and external charge settlement (motive 19). */
export { router as adminBillingRefundRoutes };
