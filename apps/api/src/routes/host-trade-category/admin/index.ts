/**
 * Admin provider trade category routes (HOS-919).
 * Requires admin access + HOST_TRADE_CATEGORY_* permissions.
 */
import { createRouter } from '../../../utils/create-app';
import { adminCreateHostTradeCategoryRoute } from './create';
import { adminDeleteHostTradeCategoryRoute } from './delete';
import { adminGetHostTradeCategoryByIdRoute } from './getById';
import { adminListHostTradeCategoriesRoute } from './list';
import { adminPatchHostTradeCategoryRoute } from './patch';
import { adminRestoreHostTradeCategoryRoute } from './restore';

const adminRouter = createRouter();

adminRouter.route('/', adminListHostTradeCategoriesRoute);
adminRouter.route('/', adminGetHostTradeCategoryByIdRoute);
adminRouter.route('/', adminCreateHostTradeCategoryRoute);
adminRouter.route('/', adminRestoreHostTradeCategoryRoute);
adminRouter.route('/', adminPatchHostTradeCategoryRoute);
adminRouter.route('/', adminDeleteHostTradeCategoryRoute);

export { adminRouter as adminHostTradeCategoryRoutes };
