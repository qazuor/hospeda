import { createRouter } from '../../utils/create-app';
import { captureInteractionRoute } from './capture';

/**
 * Public listing-interaction routes (HOS-2256).
 *
 * Mounted at `/api/v1/public`, exactly like `viewsRoutes`, so the path declared
 * on the route itself is the full public path.
 */
export const interactionRoutes = createRouter().route('/', captureInteractionRoute);
