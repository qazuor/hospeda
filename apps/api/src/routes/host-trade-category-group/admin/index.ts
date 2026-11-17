/**
 * Admin provider trade category group routes (HOS-919).
 * Requires admin access + HOST_TRADE_CATEGORY_* permissions.
 */
import { createRouter } from '../../../utils/create-app';
import { adminCreateHostTradeCategoryGroupRoute } from './create';
import { adminDeleteHostTradeCategoryGroupRoute } from './delete';
import { adminGetHostTradeCategoryGroupByIdRoute } from './getById';
import { adminListHostTradeCategoryGroupsRoute } from './list';
import { adminPatchHostTradeCategoryGroupRoute } from './patch';
import { adminRestoreHostTradeCategoryGroupRoute } from './restore';

const adminRouter = createRouter();

adminRouter.route('/', adminListHostTradeCategoryGroupsRoute);
adminRouter.route('/', adminGetHostTradeCategoryGroupByIdRoute);
adminRouter.route('/', adminCreateHostTradeCategoryGroupRoute);
adminRouter.route('/', adminRestoreHostTradeCategoryGroupRoute);
adminRouter.route('/', adminPatchHostTradeCategoryGroupRoute);
adminRouter.route('/', adminDeleteHostTradeCategoryGroupRoute);

export { adminRouter as adminHostTradeCategoryGroupRoutes };
