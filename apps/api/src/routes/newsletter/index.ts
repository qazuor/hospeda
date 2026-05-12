import { createRouter } from '../../utils/create-app';
import { submitNewsletterRoute } from './submit';

export const newsletterRoutes = createRouter().route('/', submitNewsletterRoute);

export { newsletterProtectedRoutes } from './protected';
