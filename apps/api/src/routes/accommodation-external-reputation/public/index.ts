/**
 * Barrel for SPEC-237 T-009 public accommodation external reputation route.
 *
 * Mounts:
 *   GET /api/v1/public/accommodations/:id/external-reputation
 */
import { createRouter } from '../../../utils/create-app';
import { publicGetExternalReputationRoute } from './get-external-reputation.js';

const app = createRouter();

// GET /:id/external-reputation
app.route('/', publicGetExternalReputationRoute);

export { app as publicExternalReputationRoutes };
