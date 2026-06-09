/**
 * Protected media routes.
 * Requires user authentication.
 *
 * POST /upload        — Upload an avatar image to Cloudinary
 * POST /upload-entity — Upload an entity image (featured/gallery) to Cloudinary
 */
import { createRouter } from '../../../utils/create-app';
import { protectedUploadAvatarRoute } from './upload';
import { protectedUploadEntityRoute } from './upload-entity';

const app = createRouter();

// POST /upload - Upload user avatar
app.route('/', protectedUploadAvatarRoute);

// POST /upload-entity - Upload entity image (featured/gallery)
app.route('/', protectedUploadEntityRoute);

export { app as protectedMediaRoutes };
