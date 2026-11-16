/**
 * Protected AI connection routes (HOS-2184 T-026).
 * All routes require authentication and act on the caller's own connections.
 *
 * Deliberately NOT behind `HOSPEDA_MCP_ENABLED`: the flag gates the `/mcp`
 * endpoint and the OAuth metadata, and a user must still be able to see and
 * remove what they connected while the feature is switched off.
 */
import { createRouter } from '../../../utils/create-app';
import { listAiConnectionsRoute } from './list';
import { revokeAiConnectionRoute } from './revoke';

const app = createRouter();

// DELETE /{clientId} — disconnect one assistant
app.route('/', revokeAiConnectionRoute);

// GET / — list connected assistants
app.route('/', listAiConnectionsRoute);

export { app as protectedAiConnectionRoutes };
