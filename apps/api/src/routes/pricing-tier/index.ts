import { createRouter } from '../../utils/create-app';
import { pricingTierCreateRoute } from './create';
import { pricingTierDeleteRoute } from './delete';
import { pricingTierGetByIdRoute } from './getById';
import { pricingTierListRoute } from './list';
import { pricingTierUpdateRoute } from './update';

const app = createRouter();

app.route('/', pricingTierListRoute);
app.route('/', pricingTierCreateRoute);
app.route('/', pricingTierGetByIdRoute);
app.route('/', pricingTierUpdateRoute);
app.route('/', pricingTierDeleteRoute);

export { app as pricingTierRoutes };
