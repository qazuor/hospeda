import { createRouter } from '../../../utils/create-app';
import { adminConfirmRefundRoute } from './confirm';
import { adminDeclineRefundRoute } from './decline';
import { adminListProposedRefundsRoute } from './list-proposed';
import { adminRetryRefundProviderCallsRoute } from './retry-provider-calls';
import { adminSettleExternalRefundRoute } from './settle-external';
import { adminSettleExternalChargeRoute } from './settle-external-charge';

const router = createRouter();
router.route('/', adminListProposedRefundsRoute);
router.route('/', adminConfirmRefundRoute);
router.route('/', adminDeclineRefundRoute);
router.route('/', adminRetryRefundProviderCallsRoute);
router.route('/', adminSettleExternalRefundRoute);
router.route('/', adminSettleExternalChargeRoute);

/** Admin action 13 proposal list, confirmation (RF2), provider call retry (HOS-2516), refusal (RF5), and action 14 external settlement routes. */
export { router as adminBillingRefundRoutes };
