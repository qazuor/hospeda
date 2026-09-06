import { createRouter } from '../../utils/create-app';
import { captureLogoClickRoute } from './capture';

/**
 * Public partner-logo-click routes (HOS-1063 A-3).
 *
 * Mounted at `/api/v1/public`, exactly like `viewsRoutes`, so the path declared
 * on the route itself is the full public path.
 */
export const partnerLogoClickRoutes = createRouter().route('/', captureLogoClickRoute);
