import { createRouter } from '../../../utils/create-app';
import { adminConfirmRefundRoute } from './confirm';
import { adminDeclineRefundRoute } from './decline';
import { adminListProposedRefundsRoute } from './list-proposed';
import { adminListStuckRefundsRoute } from './list-stuck';
import { adminRetryRefundProviderCallsRoute } from './retry-provider-calls';
import { adminSettleExternalRefundRoute } from './settle-external';
import { adminSettleExternalChargeRoute } from './settle-external-charge';
import { adminSettleRefundRemainderRoute } from './settle-remainder';

const router = createRouter();
router.route('/', adminListProposedRefundsRoute);
router.route('/', adminListStuckRefundsRoute);
router.route('/', adminConfirmRefundRoute);
router.route('/', adminDeclineRefundRoute);
router.route('/', adminRetryRefundProviderCallsRoute);
router.route('/', adminSettleExternalRefundRoute);
router.route('/', adminSettleExternalChargeRoute);
router.route('/', adminSettleRefundRemainderRoute);

/** Admin action 13 proposal list, stuck-refund list (HOS-2560), confirmation (RF2), provider call retry (HOS-2516), refusal (RF5), action 14 external settlement, and the partial-refund remainder settlement (HOS-2406). */
export { router as adminBillingRefundRoutes };
