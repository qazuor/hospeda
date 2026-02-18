/**
 * Public billing routes
 * No authentication required
 */
import { createRouter } from '../../../utils/create-app.js';
import { publicListPlansRoute } from './listPlans.js';

const router = createRouter();

// Register public routes
router.route('/', publicListPlansRoute);

export { router as publicBillingRoutes };
