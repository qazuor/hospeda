import { createRouter } from '../../utils/create-app';
import { createReportRoute } from './create-report';
import { getLabelsRoute } from './get-labels';

const router = createRouter();

router.route('/', getLabelsRoute);
router.route('/', createReportRoute);

export { router as reportRoutes };
