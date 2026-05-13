/**
 * Protected newsletter routes barrel (SPEC-101 T-101-20).
 */

import { createRouter } from '../../../utils/create-app';
import { newsletterResendRoute } from './resend';
import { newsletterStatusRoute } from './status';
import { newsletterSubscribeRoute } from './subscribe';
import { newsletterUnsubscribeRoute } from './unsubscribe';

export const newsletterProtectedRoutes = createRouter()
    .route('/', newsletterSubscribeRoute)
    .route('/', newsletterStatusRoute)
    .route('/', newsletterResendRoute)
    .route('/', newsletterUnsubscribeRoute);

export { _resetNewsletterRouteSingletons } from './_singletons';
export { resendHandler } from './resend';
export { statusHandler } from './status';
export { type SubscribeBody, subscribeHandler } from './subscribe';
export { unsubscribeHandler } from './unsubscribe';
