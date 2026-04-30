/**
 * Public PostTag routes
 *
 * No authentication required. Returns only ACTIVE PostTags.
 * Sets Cache-Control: public, max-age=600 on responses (D-013, AC-F24).
 *
 * Route layout:
 *   GET /  — List all ACTIVE PostTags (?withCounts=true for usage counts)
 */
import { createRouter } from '../../../../utils/create-app';
import { publicListPostTagsRoute } from './list';

const app = createRouter();

// GET / - List ACTIVE PostTags
app.route('/', publicListPostTagsRoute);

export { app as publicPostTagRoutes };
