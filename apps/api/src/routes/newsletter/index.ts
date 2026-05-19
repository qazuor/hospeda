import { createRouter } from '../../utils/create-app';
import { submitNewsletterRoute } from './submit';

export const newsletterRoutes = createRouter().route('/', submitNewsletterRoute);

export { newsletterAdminRoutes } from './admin';
export { newsletterProtectedRoutes } from './protected';
export { newsletterPublicRoutes } from './public';
