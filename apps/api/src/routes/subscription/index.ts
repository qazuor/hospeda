import { createRouter } from '../../utils/create-app';
import { subscriptionCreateRoute } from './create';
import { subscriptionDeleteRoute } from './delete';
import { subscriptionGetByIdRoute } from './getById';
import { subscriptionListRoute } from './list';
import { subscriptionUpdateRoute } from './update';

const app = createRouter();

app.route('/', subscriptionListRoute);
app.route('/', subscriptionCreateRoute);
app.route('/', subscriptionGetByIdRoute);
app.route('/', subscriptionUpdateRoute);
app.route('/', subscriptionDeleteRoute);

export { app as subscriptionRoutes };
