import { createRouter } from '../../../utils/create-app';
import { publicGetAllFlagsRoute } from './getAll';
import { publicGetFeatureFlagsMeRoute } from './getMe';

const app = createRouter();
app.route('/', publicGetAllFlagsRoute);
app.route('/', publicGetFeatureFlagsMeRoute);
export { app as publicFeatureFlagRoutes };
