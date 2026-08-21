/**
 * Public commerce routes barrel (SPEC-239 T-047)
 * Mounts under /api/v1/public/commerce.
 *
 * HOS-693 §6.2 removed the only route this barrel carried
 * (`POST /leads`, the pre-onboarding lead form's endpoint): HOS-690 already
 * unmounted the form from the landing pages, so nothing posts here anymore.
 * The barrel stays — empty, still mounted at `/api/v1/public/commerce` in
 * `routes/index.ts` — as the tier's home if a public commerce route is added
 * again; an unmatched path under it 404s normally in the meantime.
 */
import { createRouter } from '../../../utils/create-app';

const router = createRouter();

/** Public commerce routes: none currently (HOS-693). */
export const publicCommerceRoutes = router;
