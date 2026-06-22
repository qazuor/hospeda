/**
 * Admin social post state-transition routes — SPEC-254 T-036.
 *
 * Assembles the 9 state-machine action routes for social posts.
 * All routes are POST and require admin-level authentication plus the
 * specific permission declared in each route file.
 *
 * Mounted at /api/v1/admin/social/posts so the final URLs are:
 *   POST /api/v1/admin/social/posts/{id}/approve
 *   POST /api/v1/admin/social/posts/{id}/reject
 *   POST /api/v1/admin/social/posts/{id}/request-changes
 *   POST /api/v1/admin/social/posts/{id}/schedule
 *   POST /api/v1/admin/social/posts/{id}/mark-ready
 *   POST /api/v1/admin/social/posts/{id}/pause
 *   POST /api/v1/admin/social/posts/{id}/unpause
 *   POST /api/v1/admin/social/posts/{id}/archive
 *   POST /api/v1/admin/social/posts/{id}/promote-hashtag
 *
 * T-037 will add CRUD (list / getById / patch) at the SAME base path.
 * These transition routes use /{id}/<verb> paths, so they coexist with
 * the future / and /{id} CRUD routes without collision.
 */
import { createRouter } from '../../../../utils/create-app';
import { adminApproveSocialPostRoute } from './approve';
import { adminArchiveSocialPostRoute } from './archive';
import { adminMarkReadySocialPostRoute } from './mark-ready';
import { adminPauseSocialPostRoute } from './pause';
import { adminPromoteHashtagSocialPostRoute } from './promote-hashtag';
import { adminRejectSocialPostRoute } from './reject';
import { adminRequestChangesSocialPostRoute } from './request-changes';
import { adminScheduleSocialPostRoute } from './schedule';
import { adminUnpauseSocialPostRoute } from './unpause';

const app = createRouter();

app.route('/', adminApproveSocialPostRoute);
app.route('/', adminRejectSocialPostRoute);
app.route('/', adminRequestChangesSocialPostRoute);
app.route('/', adminScheduleSocialPostRoute);
app.route('/', adminMarkReadySocialPostRoute);
app.route('/', adminPauseSocialPostRoute);
app.route('/', adminUnpauseSocialPostRoute);
app.route('/', adminArchiveSocialPostRoute);
app.route('/', adminPromoteHashtagSocialPostRoute);

export { app as adminSocialPostTransitionRoutes };
