/**
 * Public provider trade catalog routes (HOS-919).
 */
import { createRouter } from '../../../utils/create-app';
import { publicListHostTradeCategoriesRoute } from './list';

const publicRouter = createRouter();

// GET / - The public provider trade catalog
publicRouter.route('/', publicListHostTradeCategoriesRoute);

export { publicRouter as publicHostTradeCategoryRoutes };
