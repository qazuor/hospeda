/**
 * Protected AI connection routes (HOS-2184 T-026).
 * All routes require authentication and act on the caller's own connections.
 *
 * Deliberately NOT behind `HOSPEDA_MCP_ENABLED`: the flag gates the `/mcp`
 * endpoint and the OAuth metadata, and a user must still be able to see and
 * remove what they connected while the feature is switched off.
 */
import { createRouter } from '../../../utils/create-app';
import { getAiAssistantAccessRoute } from './access';
import { listOwnAiActivityRoute } from './activity';
import { listAiConnectionsRoute } from './list';
import { resolveResetReviewRoute } from './reset-review';
import { revokeAiConnectionRoute } from './revoke';

const app = createRouter();

// DELETE /?clientId= — disconnect one assistant
app.route('/', revokeAiConnectionRoute);

// POST /reset-review — answer the post-password-reset question
app.route('/', resolveResetReviewRoute);

// GET / — list connected assistants
app.route('/', listAiConnectionsRoute);

// GET /access — whether the AI assistant answers the actor (HOS-2184 T-041)
app.route('/', getAiAssistantAccessRoute);

// GET /activity — what the assistants did on the actor's behalf (HOS-2348)
app.route('/', listOwnAiActivityRoute);

export { app as protectedAiConnectionRoutes };
