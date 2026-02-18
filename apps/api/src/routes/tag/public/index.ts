/**
 * Public tag routes
 * No authentication required
 */
import { createRouter } from '../../../utils/create-app.js';
import { publicGetTagBySlugRoute } from './getBySlug.js';

const router = createRouter();

// Register public routes
router.route('/', publicGetTagBySlugRoute);

export { router as publicTagRoutes };
