import createApp from '../../utils/create-app';
import { accommodationGetByIdRoute } from './getById';
import { accommodationListRoute } from './list';

const app = createApp();

app.route('/', accommodationListRoute);
app.route('/', accommodationGetByIdRoute);

export { app as accommodationRoutes };
