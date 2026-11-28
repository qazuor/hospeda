/**
 * Direct email routes barrel (HOS-2685).
 *
 * @module routes/direct-email
 */

export {
    directEmailAdminRoutes,
    directEmailSuppressionAdminRoutes,
    directEmailTemplateAdminRoutes
} from './admin';
export { directEmailPublicRoutes } from './public/opt-out';
