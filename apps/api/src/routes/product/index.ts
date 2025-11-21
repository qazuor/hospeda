import { createRouter } from '../../utils/create-app';
import { productCreateRoute } from './create';
import { productDeleteRoute } from './delete';
import { productGetByIdRoute } from './getById';
import { productListRoute } from './list';
import { productUpdateRoute } from './update';

const app = createRouter();

app.route('/', productListRoute);
app.route('/', productCreateRoute);
app.route('/', productGetByIdRoute);
app.route('/', productUpdateRoute);
app.route('/', productDeleteRoute);

export { app as productRoutes };
