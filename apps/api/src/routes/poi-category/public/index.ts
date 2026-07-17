/**
 * Public POI-category catalog routes (HOS-147).
 * Read-only public catalog for the web thematic filter-chip UI.
 */
import { createRouter } from '../../../utils/create-app';
import { publicListPoiCategoriesRoute } from './list';

const publicRouter = createRouter();

// GET / - List the public POI category catalog
publicRouter.route('/', publicListPoiCategoriesRoute);

export { publicRouter as publicPoiCategoryRoutes };
