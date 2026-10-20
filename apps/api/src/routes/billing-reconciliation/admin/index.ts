import { createRouter } from '../../../utils/create-app';
import { adminLiftReconciliationMarkRoute } from './lift-mark';
import { listReconciliationMarksRoute } from './list-marks';
import { readReconciliationMarkEventsRoute } from './mark-events';

const router = createRouter();
router.route('/', listReconciliationMarksRoute);
router.route('/', readReconciliationMarkEventsRoute);
router.route('/', adminLiftReconciliationMarkRoute);

/** The actionable mark list, its events, and action 7 for lifting a mark. */
export { router as adminBillingReconciliationRoutes };
