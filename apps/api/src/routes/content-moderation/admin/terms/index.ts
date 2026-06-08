/**
 * Admin content moderation terms routes
 */
import { createRouter } from '../../../../utils/create-app';
import { adminBatchImportTermsRoute } from './batch';
import { adminCreateTermRoute } from './create';
import { adminGetTermByIdRoute } from './get-by-id';
import { adminHardDeleteTermRoute } from './hard-delete';
import { adminListTermsRoute } from './list';
import { adminPatchTermRoute } from './patch';
import { adminRestoreTermRoute } from './restore';
import { adminSoftDeleteTermRoute } from './soft-delete';
import { adminUpdateTermRoute } from './update';

const app = createRouter();

// GET / - List terms
app.route('/', adminListTermsRoute);

// POST / - Create term
app.route('/', adminCreateTermRoute);

// POST /batch - Batch import (registered before /{id} to prevent "batch" matching as UUID)
app.route('/', adminBatchImportTermsRoute);

// GET /:id - Get by ID
app.route('/', adminGetTermByIdRoute);

// PUT /:id - Full update
app.route('/', adminUpdateTermRoute);

// PATCH /:id - Partial update
app.route('/', adminPatchTermRoute);

// DELETE /:id - Soft delete
app.route('/', adminSoftDeleteTermRoute);

// DELETE /:id/hard - Hard delete (registered before /:id/restore)
app.route('/', adminHardDeleteTermRoute);

// POST /:id/restore - Restore
app.route('/', adminRestoreTermRoute);

export { app as adminContentModerationTermRoutes };
