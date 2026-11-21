/**
 * Public partner type routes (HOS-2336).
 */
import { createRouter } from '../../../utils/create-app';
import { publicListPartnerTypesRoute } from './list';

const publicRouter = createRouter();

// GET / - The active partner types
publicRouter.route('/', publicListPartnerTypesRoute);

export { publicRouter as publicPartnerTypeRoutes };
