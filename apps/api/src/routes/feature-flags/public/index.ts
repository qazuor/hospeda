import { createRouter } from '../../../utils/create-app';
import { publicGetAllFlagsRoute } from './getAll';

const app = createRouter();
app.route('/', publicGetAllFlagsRoute);
export { app as publicFeatureFlagRoutes };
