/**
 * Admin QR-code routes (HOS-981 PR 3).
 *
 * Mounted at `/api/v1/admin/qr-codes`. Every handler is gated on
 * `PermissionEnum.SETTINGS_MANAGE` — the same borrowed gate PR 1 chose for the
 * service layer, kept deliberately for this PR rather than opening a
 * `QR_CODE_*` family that would drag a `role_permission` data migration behind it.
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
