/**
 * QR-code routes (HOS-981).
 *
 * Two tiers: the unauthenticated resolution a printed sticker reaches, and the
 * admin CRUD the panel drives.
 */
export { adminQrCodeRoutes } from './admin/index.js';
export { publicQrCodeRoutes } from './public/index.js';
