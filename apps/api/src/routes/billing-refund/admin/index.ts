import { createRouter } from '../../../utils/create-app';
import { adminSettleExternalRefundRoute } from './settle-external';

const router = createRouter();
router.route('/', adminSettleExternalRefundRoute);

/** Admin billing refund routes, mounted at `/api/v1/admin/billing-refunds` (ACC:14). */
export { router as adminBillingRefundRoutes };
