import { createRouter } from '../../utils/create-app';
import { sponsorListRoute } from './list';

const app = createRouter();
app.route('/', sponsorListRoute);
export { app as sponsorRoutes };
