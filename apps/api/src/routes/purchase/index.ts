import { createRouter } from '../../utils/create-app';
import { purchaseCreateRoute } from './create';
import { purchaseDeleteRoute } from './delete';
import { purchaseGetByIdRoute } from './getById';
import { purchaseListRoute } from './list';
import { purchaseUpdateRoute } from './update';

const app = createRouter();

app.route('/', purchaseListRoute);
app.route('/', purchaseCreateRoute);
app.route('/', purchaseGetByIdRoute);
app.route('/', purchaseUpdateRoute);
app.route('/', purchaseDeleteRoute);

export { app as purchaseRoutes };
