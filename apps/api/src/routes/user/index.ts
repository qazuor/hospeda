import createApp from '../../utils/create-app';
import { createUserRoute } from './create';
import { deleteUserRoute } from './delete';
import { getUserByIdRoute } from './getById';
import { listUsersRoute } from './list';
import { updateUserRoute } from './update';

const app = createApp();

app.route('/', getUserByIdRoute);
app.route('/', createUserRoute);
app.route('/', updateUserRoute);
app.route('/', deleteUserRoute);
app.route('/', listUsersRoute);

export { app as userRoutes };
