/**
 * Protected profile routes (SPEC-113 / SPEC-243).
 * Aggregates all profile-completion and device-management endpoints.
 */

import { createRouter } from '../../../utils/create-app';
import { profileCompleteRoute } from './complete';
import { profilePushTokenRoute } from './push-token';
import { profileSetPasswordRoute } from './set-password';
import { profileSkipSetPasswordRoute } from './skip-set-password';
import { profileStatusRoute } from './status';

const app = createRouter();

// GET /status — profile completion flags + account-type info (T-113-06)
app.route('/', profileStatusRoute);

// POST /complete
app.route('/', profileCompleteRoute);

// POST /set-password
app.route('/', profileSetPasswordRoute);

// POST /skip-set-password
app.route('/', profileSkipSetPasswordRoute);

// POST /push-token — register an Expo push token (SPEC-243 T-011)
app.route('/', profilePushTokenRoute);

export { app as protectedProfileRoutes };
