/**
 * Protected newsletter routes barrel (SPEC-101 T-101-20).
 */

import { createRouter } from '../../../utils/create-app';
import { newsletterPreferencesRoute } from './preferences';
import { newsletterResendRoute } from './resend';
import { newsletterStatusRoute } from './status';
import { newsletterSubscribeRoute } from './subscribe';
import { newsletterUnsubscribeRoute } from './unsubscribe';

export const newsletterProtectedRoutes = createRouter()
    .route('/', newsletterSubscribeRoute)
    .route('/', newsletterStatusRoute)
    .route('/', newsletterResendRoute)
    .route('/', newsletterUnsubscribeRoute)
    .route('/', newsletterPreferencesRoute);

export { _resetNewsletterRouteSingletons } from './_singletons';
export { type PreferencesBody, preferencesHandler } from './preferences';
export { resendHandler } from './resend';
export { statusHandler } from './status';
export { type SubscribeBody, subscribeHandler } from './subscribe';
export { unsubscribeHandler } from './unsubscribe';
