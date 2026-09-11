/**
 * Admin QR-code routes (HOS-981 PR 3).
 *
 * Mounted at `/api/v1/admin/qr-codes`. Each handler is gated on its OWN verb
 * from the `platform.qrCode.*` family: `QR_CODE_VIEW` for the three reads (list,
 * detail, download), and `QR_CODE_CREATE` / `QR_CODE_UPDATE` / `QR_CODE_DELETE`
 * for the three writes.
 *
 * PR 1 borrowed `SETTINGS_MANAGE` because no route existed to justify a family
 * of its own. These routes are that justification, and the split is what lets
 * the QR manager be handed to somebody without also handing over SEO defaults
 * and system tags. Both roles that held `SETTINGS_MANAGE` receive all four in
 * the same release, so nobody's access changes the day it ships.
 *
 * @module routes/qr-code/admin
 */

import { createRouter } from '../../../utils/create-app';
import { adminCreateQrCodeRoute } from './create';
import { adminDeleteQrCodeRoute } from './delete';
import { adminDownloadQrCodeRoute } from './download';
import { adminGetQrCodeByIdRoute } from './getById';
import { adminListQrCodesRoute } from './list';
import { adminUpdateQrCodeRoute } from './update';

const adminRouter = createRouter();

// GET / — paginated list
adminRouter.route('/', adminListQrCodesRoute);

// GET /{id}/download — rendered image. Registered BEFORE `/{id}` so the more
// specific path is matched first.
adminRouter.route('/', adminDownloadQrCodeRoute);

// GET /{id} — one code
adminRouter.route('/', adminGetQrCodeByIdRoute);

// POST / — create
adminRouter.route('/', adminCreateQrCodeRoute);

// PATCH /{id} — update (this is where a code gets retargeted)
adminRouter.route('/', adminUpdateQrCodeRoute);

// DELETE /{id} — soft delete
adminRouter.route('/', adminDeleteQrCodeRoute);

export { adminRouter as adminQrCodeRoutes };
