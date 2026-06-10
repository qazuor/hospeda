/**
 * Post-sponsorship entity select utilities.
 *
 * SPEC-169 / OQ1 — PRE-EXISTING BUG (OUT OF FUNCTIONAL SCOPE):
 * This selector calls /api/v1/admin/post-sponsorships which is NOT mounted in
 * the API router. All requests will 404 at runtime. The selector appears to work
 * only because no UI currently exercises it with a non-empty response.
 *
 * DO NOT migrate this to a /options endpoint until the base route is mounted.
 * When the route is mounted, ALSO add a /options variant gated by
 * ACCESS_PANEL_ADMIN (NOT by a broad _VIEW_ALL permission). See decision OQ1 in
 * .qtm/specs/SPEC-169-role-permission-own-scoping/decision-log.md.
 *
 * Current state: left as-is (pointing at the unmounted route). The authorization
 * path is documented here so whoever mounts the route knows what to wire.
 */

import { createSelectUtils } from './create-select-utils';

interface PostSponsorshipItem {
    id: string;
    sponsor?: { name?: string };
    sponsorName?: string;
    message?: string;
    description?: string;
}

// SPEC-169 / OQ1: endpoint /api/v1/admin/post-sponsorships is NOT mounted.
// This util is intentionally left pointing at the dead route so no 404 is silently
// introduced by the migration. Whoever mounts the route must:
//   1. Add GET /api/v1/admin/post-sponsorships (list) — gated by the appropriate perm.
//   2. Add GET /api/v1/admin/post-sponsorships/options — gated by ACCESS_PANEL_ADMIN.
//   3. Migrate this util to createOptionsSelectUtils pointing at /options.
const utils = createSelectUtils<PostSponsorshipItem>({
    endpoint: '/api/v1/admin/post-sponsorships',
    buildLabel: (item) =>
        item.sponsorName || item.sponsor?.name || item.message?.slice(0, 60) || item.id,
    buildDescription: (item) => item.description || item.message?.slice(0, 100),
    // No batch endpoint — falls back to parallel GET-by-id.
    entityName: 'post sponsorships'
});

export const searchPostSponsorships = utils.search;
export const loadPostSponsorshipsByIds = utils.loadByIds;
export const loadInitialPostSponsorships = utils.loadAll;
