import { createRouter } from '../../utils/create-app';
import { clientCreateRoute } from './create';
import { clientDeleteRoute } from './delete';
import { clientGetByIdRoute } from './getById';
import { clientListRoute } from './list';
import { clientUpdateRoute } from './update';

const app = createRouter();

// Register all client routes
app.route('/', clientListRoute);
app.route('/', clientCreateRoute);
app.route('/', clientGetByIdRoute);
app.route('/', clientUpdateRoute);
app.route('/', clientDeleteRoute);

export { app as clientRoutes };
