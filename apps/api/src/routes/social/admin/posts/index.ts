/**
 * Admin social post routes — SPEC-254 T-036 + T-037.
 *
 * Assembles:
 *  - 9 state-machine transition routes (T-036): POST /{id}/<verb>
 *  - 3 CRUD routes (T-037): GET /, GET /{id}, PATCH /{id}
 *
 * Mounted at /api/v1/admin/social/posts so the final URLs are:
 *   GET  /api/v1/admin/social/posts            — list
 *   GET  /api/v1/admin/social/posts/{id}       — detail
 *   PATCH /api/v1/admin/social/posts/{id}      — content update
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
 * Route ordering note: Hono resolves routes in registration order. The
 * transition routes use /{id}/<verb> paths (more specific), while the
 * CRUD routes use / (list) and /{id} (detail/patch). Registering transition
 * routes first ensures /{id}/approve etc. are matched before the bare /{id}.
 * In practice Hono also disambiguates by HTTP method so there is no collision,
 * but explicit ordering documents the intent.
 */
import { createRouter } from '../../../../utils/create-app';
import { adminApproveSocialPostRoute } from './approve';
import { adminArchiveSocialPostRoute } from './archive';
import { adminGetSocialPostByIdRoute } from './getById';
import { adminListSocialPostsRoute } from './list';
import { adminMarkReadySocialPostRoute } from './mark-ready';
import { adminPatchSocialPostRoute } from './patch';
import { adminPauseSocialPostRoute } from './pause';
import { adminPromoteHashtagSocialPostRoute } from './promote-hashtag';
import { adminRejectSocialPostRoute } from './reject';
import { adminRequestChangesSocialPostRoute } from './request-changes';
import { adminScheduleSocialPostRoute } from './schedule';
import { adminUnpauseSocialPostRoute } from './unpause';

const app = createRouter();

// --- T-036: state-machine transition routes (registered first — more specific paths) ---
app.route('/', adminApproveSocialPostRoute);
app.route('/', adminRejectSocialPostRoute);
app.route('/', adminRequestChangesSocialPostRoute);
app.route('/', adminScheduleSocialPostRoute);
app.route('/', adminMarkReadySocialPostRoute);
app.route('/', adminPauseSocialPostRoute);
app.route('/', adminUnpauseSocialPostRoute);
app.route('/', adminArchiveSocialPostRoute);
app.route('/', adminPromoteHashtagSocialPostRoute);

// --- T-037: CRUD routes ---
app.route('/', adminListSocialPostsRoute);
app.route('/', adminGetSocialPostByIdRoute);
app.route('/', adminPatchSocialPostRoute);

export { app as adminSocialPostTransitionRoutes };
