/**
 * Admin partner application routes.
 * ACC:5 approves (PP2), rejects (PP3), or cancels a Partner application's rejection wait (HOS-1485, HOS-1484); ACC:24
 * replaces the email on an application without an account (HOS-1494); the V8b
 * applications panel is registered below.
 */
import { createRouter } from '../../../utils/create-app';
import { adminApprovePartnerApplicationRoute } from './approve';
import { adminCancelPartnerApplicationWaitRoute } from './cancel-wait';
import { adminListPartnerApplicationPanelRoute } from './list';
import { adminRejectPartnerApplicationRoute } from './reject';
import {
    adminPartnerApplicationEmailReplacementPreviewRoute,
    adminReplacePartnerApplicationEmailRoute
} from './replace-email';

const app = createRouter();

// GET / (V8b panel, AC:V8b:2), gated by PARTNER_RESOLVE_APPLICATION.
app.route('/', adminListPartnerApplicationPanelRoute);

// POST /:id/approve (PP2, ACC:5), gated by its own permission in the factory.
app.route('/', adminApprovePartnerApplicationRoute);

// POST /:id/reject (PP3, ACC:5), gated by its own permission in the factory.
app.route('/', adminRejectPartnerApplicationRoute);

// POST /:id/cancel-wait (ACC:5), gated by its own permission in the factory.
app.route('/', adminCancelPartnerApplicationWaitRoute);

// GET and POST /:id/replace-email (ACC:24). Same path and same permission on
// purpose: route middlewares are per path and method-agnostic, so the second
// registration inherits the first one's gate.
app.route('/', adminPartnerApplicationEmailReplacementPreviewRoute);
app.route('/', adminReplacePartnerApplicationEmailRoute);

/** Router mounted at `/api/v1/admin/partner-applications`. */
export const adminPartnerApplicationRoutes = app;
