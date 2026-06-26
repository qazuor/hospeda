/**
 * Admin media routes.
 * Requires admin authentication.
 *
 * POST   /upload  — Upload an entity image to Cloudinary
 * DELETE /        — Delete a Cloudinary asset by publicId
 */
import { createRouter } from '../../../utils/create-app';
import { adminDeleteMediaRoute } from './delete';
import { adminImportStockMediaRoute } from './import-stock';
import { adminSearchStockMediaRoute } from './search';
import { adminUploadMediaRoute } from './upload';

const app = createRouter();

// POST /upload - Upload entity image
// Mounted under /upload so the upload sub-app middleware (which requires
// MEDIA_UPLOAD) is scoped to this path only and does not leak into DELETE /.
app.route('/upload', adminUploadMediaRoute);
app.route('/', adminSearchStockMediaRoute);
app.route('/', adminImportStockMediaRoute);

// DELETE / - Delete media asset by publicId query param
app.route('/', adminDeleteMediaRoute);

export { app as adminMediaRoutes };
