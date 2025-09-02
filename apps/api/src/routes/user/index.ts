import { createRouter } from '../../utils/create-app';
import { userBatchRoute } from './batch';
import { createUserRoute } from './create';
import { deleteUserRoute } from './delete';
import { getUserByIdRoute } from './getById';
import { listUsersRoute } from './list';
import { updateUserRoute } from './update';

const app = createRouter();

app.route('/', getUserByIdRoute);
app.route('/', userBatchRoute);
app.route('/', createUserRoute);
app.route('/', updateUserRoute);
app.route('/', deleteUserRoute);
app.route('/', listUsersRoute);

export { app as userRoutes };
