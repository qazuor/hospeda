/**
 * Admin tag routes
 * Requires admin role
 */
import { createRouter } from '../../../utils/create-app';
import { adminBatchTagsRoute } from './batch';
import { adminCreateTagRoute } from './create';
import { adminDeleteTagRoute } from './delete';
import { adminGetTagByIdRoute } from './getById';
import { adminHardDeleteTagRoute } from './hardDelete';
import { adminListTagsRoute } from './list';
import { adminPatchTagRoute } from './patch';
import { adminRestoreTagRoute } from './restore';
import { adminUpdateTagRoute } from './update';

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
