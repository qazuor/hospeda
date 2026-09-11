/**
 * Public QR-code routes (HOS-981).
 *
 * One endpoint, no authentication: the caller is whoever pointed a camera at a
 * printed sticker.
 */
import { createRouter } from '../../../utils/create-app';
import { publicResolveQrCodeRoute } from './resolve';

const publicRouter = createRouter();

publicRouter.route('/', publicResolveQrCodeRoute);

export { publicRouter as publicQrCodeRoutes };
