/**
 * Protected alliance routes barrel (HOS-278 AC-5)
 *
 * NEW tier — mounts under `/api/v1/protected/alliance`. HOS-277 shipped only a
 * public tier (submit) and an admin tier (review); an applicant had no way to
 * see their own application. Everything here is actor-dependent and must never
 * be cached or moved to the public tier (spec §12).
 */
import { createRouter } from '../../../utils/create-app';
import { protectedListMyAllianceLeadsRoute } from './list-mine';

const router = createRouter();

// GET /leads/mine — the caller's own applications (AC-5)
router.route('/', protectedListMyAllianceLeadsRoute);

/**
 * Protected alliance routes:
 * - GET /leads/mine
 */
export const protectedAllianceRoutes = router;
