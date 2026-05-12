/**
 * Protected newsletter routes barrel (SPEC-101 T-101-20).
 */

import { createRouter } from '../../../utils/create-app';
import { newsletterStatusRoute } from './status';
import { newsletterSubscribeRoute } from './subscribe';

export const newsletterProtectedRoutes = createRouter()
    .route('/', newsletterSubscribeRoute)
    .route('/', newsletterStatusRoute);

export { subscribeHandler, type SubscribeBody } from './subscribe';
export { statusHandler } from './status';
export { _resetNewsletterRouteSingletons } from './_singletons';
