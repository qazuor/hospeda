/**
 * Admin partner application routes.
 * ACC:24 over an application made without an account (HOS-1494); V8b adds the
 * applications panel here.
 */
import { createRouter } from '../../../utils/create-app';
import {
    adminPartnerApplicationEmailReplacementPreviewRoute,
    adminReplacePartnerApplicationEmailRoute
} from './replace-email';

const app = createRouter();

// GET and POST /:id/replace-email (ACC:24). Same path and same permission on
// purpose: route middlewares are per path and method-agnostic, so the second
// registration inherits the first one's gate.
app.route('/', adminPartnerApplicationEmailReplacementPreviewRoute);
app.route('/', adminReplacePartnerApplicationEmailRoute);

/** Router mounted at `/api/v1/admin/partner-applications`. */
export const adminPartnerApplicationRoutes = app;
