/**
 * Admin direct email routers (HOS-2685).
 *
 * Three routers, mounted by `routes/index.ts`:
 * - `directEmailAdminRoutes` at `/api/v1/admin/direct-emails`
 * - `directEmailTemplateAdminRoutes` at `/api/v1/admin/direct-email-templates`
 * - `directEmailSuppressionAdminRoutes` at `/api/v1/admin/direct-email-suppressions`
 *
 * In the messages router the fixed paths (`/preview`, `/test-send`, `/check-recipients`)
 * are mounted before `/{id}`, so they are never read as an id.
 *
 * @module routes/direct-email/admin
 */

import { createRouter } from '../../../utils/create-app';
import {
    adminCheckDirectEmailRecipientsRoute,
    adminGetDirectEmailRoute,
    adminListDirectEmailsRoute,
    adminPreviewDirectEmailRoute,
    adminSendDirectEmailRoute,
    adminTestSendDirectEmailRoute
} from './messages';
import {
    adminCreateDirectEmailSuppressionRoute,
    adminDeleteDirectEmailSuppressionRoute,
    adminListDirectEmailSuppressionsRoute
} from './suppressions';
import {
    adminCreateDirectEmailTemplateRoute,
    adminDeleteDirectEmailTemplateRoute,
    adminGetDirectEmailTemplateRoute,
    adminListDirectEmailTemplatesRoute,
    adminUpdateDirectEmailTemplateRoute
} from './templates';

/** `/api/v1/admin/direct-emails`. */
export const directEmailAdminRoutes = createRouter()
    .route('/', adminPreviewDirectEmailRoute)
    .route('/', adminTestSendDirectEmailRoute)
    .route('/', adminCheckDirectEmailRecipientsRoute)
    .route('/', adminListDirectEmailsRoute)
    .route('/', adminSendDirectEmailRoute)
    .route('/', adminGetDirectEmailRoute);

/** `/api/v1/admin/direct-email-templates`. */
export const directEmailTemplateAdminRoutes = createRouter()
    .route('/', adminListDirectEmailTemplatesRoute)
    .route('/', adminCreateDirectEmailTemplateRoute)
    .route('/', adminGetDirectEmailTemplateRoute)
    .route('/', adminUpdateDirectEmailTemplateRoute)
    .route('/', adminDeleteDirectEmailTemplateRoute);

/** `/api/v1/admin/direct-email-suppressions`. */
export const directEmailSuppressionAdminRoutes = createRouter()
    .route('/', adminListDirectEmailSuppressionsRoute)
    .route('/', adminCreateDirectEmailSuppressionRoute)
    .route('/', adminDeleteDirectEmailSuppressionRoute);
