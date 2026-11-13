import { createRouter } from '../../../utils/create-app';
import { publicSubmitPartnerApplicationRoute } from './submit';

const router = createRouter();
router.route('/', publicSubmitPartnerApplicationRoute);

/** Public Partner application routes. */
export const publicPartnerApplicationRoutes = router;
