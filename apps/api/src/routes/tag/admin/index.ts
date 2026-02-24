/**
 * Admin tag routes
 * Requires admin role
 */
import { createRouter } from '../../../utils/create-app.js';
import { adminBatchTagsRoute } from './batch.js';
import { adminCreateTagRoute } from './create.js';
import { adminDeleteTagRoute } from './delete.js';
import { adminGetTagByIdRoute } from './getById.js';
import { adminHardDeleteTagRoute } from './hardDelete.js';
import { adminListTagsRoute } from './list.js';
import { adminPatchTagRoute } from './patch.js';
import { adminRestoreTagRoute } from './restore.js';
import { adminUpdateTagRoute } from './update.js';

const router = createRouter();

// GET / - List all tags (including deleted)
router.route('/', adminListTagsRoute);

// GET /:id - Get tag by ID
router.route('/', adminGetTagByIdRoute);

// POST / - Create tag
router.route('/', adminCreateTagRoute);

// POST /batch - Batch get tags
router.route('/', adminBatchTagsRoute);

// POST /:id/restore - Restore tag
router.route('/', adminRestoreTagRoute);

// PUT /:id - Update tag
router.route('/', adminUpdateTagRoute);

// PATCH /:id - Partial update tag
router.route('/', adminPatchTagRoute);

// DELETE /:id - Soft delete tag
router.route('/', adminDeleteTagRoute);

// DELETE /:id/hard - Hard delete tag
router.route('/', adminHardDeleteTagRoute);

export { router as adminTagRoutes };
