import { Hono } from 'hono';
import { adminRoutes } from './admin';
import { publicRoutes } from './public';

// Create the v1 router
const apiV1Routes = new Hono();

// Register the admin and public routes
apiV1Routes.route('/admin', adminRoutes);
apiV1Routes.route('/public', publicRoutes);

export { apiV1Routes };
