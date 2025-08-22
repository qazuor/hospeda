import { createRouter } from '../../utils/create-app';
import { eventOrganizerListRoute } from './list';

const app = createRouter();
app.route('/', eventOrganizerListRoute);
export { app as eventOrganizerRoutes };
