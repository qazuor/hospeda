import { createRouter } from '../../utils/create-app';
import { captureViewRoute } from './capture';

export const viewsRoutes = createRouter().route('/', captureViewRoute);

export { protectedViewsRoutes } from './protected/index';
export { adminViewsRoutes } from './admin/index';
