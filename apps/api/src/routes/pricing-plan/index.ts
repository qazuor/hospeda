import { createRouter } from '../../utils/create-app';
import { pricingPlanCreateRoute } from './create';
import { pricingPlanDeleteRoute } from './delete';
import { pricingPlanGetByIdRoute } from './getById';
import { pricingPlanListRoute } from './list';
import { pricingPlanUpdateRoute } from './update';

const app = createRouter();

app.route('/', pricingPlanListRoute);
app.route('/', pricingPlanCreateRoute);
app.route('/', pricingPlanGetByIdRoute);
app.route('/', pricingPlanUpdateRoute);
app.route('/', pricingPlanDeleteRoute);

export { app as pricingPlanRoutes };
