/**
 * Admin host-trade routes
 * Requires admin role + HOST_TRADE_* permissions
 */
import { createRouter } from '../../../utils/create-app';
import { adminCreateHostTradeRoute } from './create';
import { adminDeleteHostTradeRoute } from './delete';
import { adminGetHostTradeByIdRoute } from './getById';
import { adminHardDeleteHostTradeRoute } from './hardDelete';
import { adminListHostTradesRoute } from './list';
import { adminPatchHostTradeRoute } from './patch';
import { adminRestoreHostTradeRoute } from './restore';
import { adminUpdateHostTradeRoute } from './update';

const adminRouter = createRouter();

// GET / - List all host-trade entries (including deleted)
adminRouter.route('/', adminListHostTradesRoute);

// GET /:id - Get host-trade entry by ID
adminRouter.route('/', adminGetHostTradeByIdRoute);

// POST / - Create host-trade entry
adminRouter.route('/', adminCreateHostTradeRoute);

// POST /:id/restore - Restore host-trade entry
adminRouter.route('/', adminRestoreHostTradeRoute);

// PUT /:id - Update host-trade entry
adminRouter.route('/', adminUpdateHostTradeRoute);

// PATCH /:id - Partial update host-trade entry
adminRouter.route('/', adminPatchHostTradeRoute);

// DELETE /:id - Soft-delete host-trade entry
adminRouter.route('/', adminDeleteHostTradeRoute);

// DELETE /:id/hard - Hard-delete host-trade entry
adminRouter.route('/', adminHardDeleteHostTradeRoute);

export { adminRouter as adminHostTradeRoutes };
