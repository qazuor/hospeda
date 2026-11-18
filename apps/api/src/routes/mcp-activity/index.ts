/**
 * Assistant (MCP) activity routes (HOS-2335 §6.10).
 *
 * - GET /api/v1/admin/mcp-activity (MCP_ACTIVITY_VIEW, HOS-2349)
 *
 * @module routes/mcp-activity
 */

import { createRouter } from '../../utils/create-app';
import { listAdminMcpActivityRoute } from './admin/list';

const adminApp = createRouter();
adminApp.route('/', listAdminMcpActivityRoute);

export { adminApp as adminMcpActivityRoutes };
