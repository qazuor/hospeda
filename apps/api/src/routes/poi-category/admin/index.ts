/**
 * Admin POI-category catalog routes (HOS-144 NG-1).
 * Requires admin role.
 */
import { createRouter } from '../../../utils/create-app';
import { adminListPoiCategoriesRoute } from './list';

const adminRouter = createRouter();

// GET / - List/search the full POI category catalog
adminRouter.route('/', adminListPoiCategoriesRoute);

export { adminRouter as adminPoiCategoryRoutes };
