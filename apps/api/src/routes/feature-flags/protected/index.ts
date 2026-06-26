import { createRouter } from '../../../utils/create-app';
import { protectedGetFeatureFlagsMeRoute } from './getMe';

const app = createRouter();
app.route('/', protectedGetFeatureFlagsMeRoute);
export { app as protectedFeatureFlagRoutes };
