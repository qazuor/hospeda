/**
 * Admin QR-code tag catalog routes (HOS-2679).
 *
 * Mounted at `/api/v1/admin/qr-code-tags`. A resource of its own rather than a
 * sub-path of `/admin/qr-codes`, where `tags` would sit next to `{id}` and every
 * new literal segment there has to be ordered before it.
 *
 * @module routes/qr-code/admin-tags
 */

import { createRouter } from '../../../utils/create-app';
import { adminListQrCodeTagsRoute } from './list';
import {
    adminCreateQrCodeTagRoute,
    adminDeleteQrCodeTagRoute,
    adminPatchQrCodeTagRoute
} from './write';

const adminTagRouter = createRouter();

adminTagRouter.route('/', adminListQrCodeTagsRoute);
adminTagRouter.route('/', adminCreateQrCodeTagRoute);
adminTagRouter.route('/', adminPatchQrCodeTagRoute);
adminTagRouter.route('/', adminDeleteQrCodeTagRoute);

export { adminTagRouter as adminQrCodeTagRoutes };
