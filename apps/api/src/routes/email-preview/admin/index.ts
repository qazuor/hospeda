/**
 * Admin email preview routes (HOS-2519 §6.3). Mounted at
 * `/api/v1/admin/email-previews`.
 *
 * Gate: `NOTIFICATION_TEMPLATE_PREVIEW` on both routes. Read-only: no DB
 * write, no send, no outbox row.
 *
 * @module routes/email-preview/admin
 */

import { createRouter } from '../../../utils/create-app.js';
import { adminListEmailPreviewsRoute } from './list.js';
import { adminRenderEmailPreviewRoute } from './render.js';

const router = createRouter();
router.route('/', adminListEmailPreviewsRoute);
router.route('/', adminRenderEmailPreviewRoute);

/** Admin email previewer: catalog list and single-scenario render. */
export { router as adminEmailPreviewRoutes };
