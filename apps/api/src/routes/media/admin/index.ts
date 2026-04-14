/**
 * Admin media routes.
 * Requires admin authentication.
 *
 * POST   /upload  — Upload an entity image to Cloudinary
 * DELETE /        — Delete a Cloudinary asset by publicId
 */
import { createRouter } from '../../../utils/create-app';
import { adminDeleteMediaRoute } from './delete';
import { adminUploadMediaRoute } from './upload';

const app = createRouter();

// POST /upload - Upload entity image
app.route('/', adminUploadMediaRoute);

// DELETE / - Delete media asset by publicId query param
app.route('/', adminDeleteMediaRoute);

export { app as adminMediaRoutes };
