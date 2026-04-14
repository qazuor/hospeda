/**
 * Protected media routes.
 * Requires user authentication.
 *
 * POST /upload — Upload an avatar image to Cloudinary
 */
import { createRouter } from '../../../utils/create-app';
import { protectedUploadAvatarRoute } from './upload';

const app = createRouter();

// POST /upload - Upload user avatar
app.route('/', protectedUploadAvatarRoute);

export { app as protectedMediaRoutes };
