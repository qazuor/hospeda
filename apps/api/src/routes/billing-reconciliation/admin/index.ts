import { createRouter } from '../../../utils/create-app';
import { listReconciliationMarksRoute } from './list-marks';
import { readReconciliationMarkEventsRoute } from './mark-events';

const router = createRouter();
router.route('/', listReconciliationMarksRoute);
router.route('/', readReconciliationMarkEventsRoute);

export { router as adminBillingReconciliationRoutes };
