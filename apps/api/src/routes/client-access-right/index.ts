import { createRouter } from '../../utils/create-app';
import { clientAccessRightCreateRoute } from './create';
import { clientAccessRightDeleteRoute } from './delete';
import { clientAccessRightGetByIdRoute } from './getById';
import { clientAccessRightListRoute } from './list';
import { clientAccessRightUpdateRoute } from './update';

const app = createRouter();

app.route('/', clientAccessRightListRoute);
app.route('/', clientAccessRightCreateRoute);
app.route('/', clientAccessRightGetByIdRoute);
app.route('/', clientAccessRightUpdateRoute);
app.route('/', clientAccessRightDeleteRoute);

export { app as clientAccessRightRoutes };
