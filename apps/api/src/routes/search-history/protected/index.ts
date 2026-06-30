/**
 * Protected search history routes (SPEC-289).
 * All routes require authentication.
 *
 * Route registration order:
 *   1. PATCH /preferences — no ordering constraint with DELETE routes (different method).
 *   2. DELETE / — clear all; must come BEFORE DELETE /:id so the parameterless
 *      path is matched first.
 *   3. DELETE /:id — delete one; registered after clear-all to avoid
 *      /:id inadvertently matching a future path-segment sibling.
 *   4. GET / — list.
 */
import { createRouter } from '../../../utils/create-app';
import { clearAllSearchHistoryRoute } from './clear-all';
import { deleteOneSearchHistoryRoute } from './delete-one';
import { listSearchHistoryRoute } from './list';
import { patchSearchHistoryPreferencesRoute } from './preferences';

const app = createRouter();

// PATCH /preferences — no ordering constraint with DELETE routes (PATCH ≠ DELETE)
app.route('/', patchSearchHistoryPreferencesRoute);

// DELETE / — clear all entries
app.route('/', clearAllSearchHistoryRoute);

// DELETE /:id — delete one entry (after clear-all to avoid /:id catching /preferences)
app.route('/', deleteOneSearchHistoryRoute);

// GET / — list entries
app.route('/', listSearchHistoryRoute);

export { app as protectedSearchHistoryRoutes };
