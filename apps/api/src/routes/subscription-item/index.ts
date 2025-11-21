import { createRouter } from '../../utils/create-app';
import { subscriptionItemCreateRoute } from './create';
import { subscriptionItemDeleteRoute } from './delete';
import { subscriptionItemGetByIdRoute } from './getById';
import { subscriptionItemListRoute } from './list';
import { subscriptionItemUpdateRoute } from './update';

const app = createRouter();

app.route('/', subscriptionItemListRoute);
app.route('/', subscriptionItemCreateRoute);
app.route('/', subscriptionItemGetByIdRoute);
app.route('/', subscriptionItemUpdateRoute);
app.route('/', subscriptionItemDeleteRoute);

export { app as subscriptionItemRoutes };
