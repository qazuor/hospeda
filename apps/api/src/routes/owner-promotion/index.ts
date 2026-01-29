import { createRouter } from '../../utils/create-app';
import { createOwnerPromotionRoute } from './create';
import { deleteOwnerPromotionRoute } from './delete';
import { ownerPromotionGetByIdRoute } from './getById';
import { ownerPromotionListRoute } from './list';
import { updateOwnerPromotionRoute } from './update';

const app = createRouter();

// Public routes
app.route('/', ownerPromotionListRoute);
app.route('/', ownerPromotionGetByIdRoute);

// Protected routes (authenticated users)
app.route('/', createOwnerPromotionRoute);
app.route('/', updateOwnerPromotionRoute);
app.route('/', deleteOwnerPromotionRoute);

export const ownerPromotionRoutes = app;
