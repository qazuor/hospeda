import createApp from '../../utils/create-app';
import { userGetByIdRoute } from './getById';
import { userListRoute } from './list';

const app = createApp();

app.route('/', userListRoute);
app.route('/', userGetByIdRoute);

export { app as userRoutes };
