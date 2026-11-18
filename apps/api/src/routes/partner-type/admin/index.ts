/**
 * Admin partner type routes (HOS-2336).
 * Requires admin access + PARTNER_TYPE_* permissions.
 */
import { createRouter } from '../../../utils/create-app';
import { adminCreatePartnerTypeRoute } from './create';
import { adminDeletePartnerTypeRoute } from './delete';
import { adminGetPartnerTypeByIdRoute } from './getById';
import { adminListPartnerTypesRoute } from './list';
import { adminPatchPartnerTypeRoute } from './patch';
import { adminRestorePartnerTypeRoute } from './restore';

const adminRouter = createRouter();

adminRouter.route('/', adminListPartnerTypesRoute);
adminRouter.route('/', adminGetPartnerTypeByIdRoute);
adminRouter.route('/', adminCreatePartnerTypeRoute);
adminRouter.route('/', adminRestorePartnerTypeRoute);
adminRouter.route('/', adminPatchPartnerTypeRoute);
adminRouter.route('/', adminDeletePartnerTypeRoute);

export { adminRouter as adminPartnerTypeRoutes };
