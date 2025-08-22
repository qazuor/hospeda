import { createRouter } from '../../utils/create-app';
import { eventLocationListRoute } from './list';

const app = createRouter();
app.route('/', eventLocationListRoute);
export { app as eventLocationRoutes };
