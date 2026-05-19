/**
 * Protected profile routes (SPEC-113).
 * Aggregates all profile-completion endpoints under a single router.
 */

import { createRouter } from '../../../utils/create-app';
import { profileCompleteRoute } from './complete';
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

export { app as protectedProfileRoutes };
