import { Hono } from 'hono';
import { accommodationsRoutes } from './accommodations';
import { destinationsRoutes } from './destinations';
import { eventsRoutes } from './events';
import { postsRoutes } from './posts';
import { searchRoutes } from './search';

// Create the public router
const publicRoutes = new Hono();

// Mount entity-specific routes
publicRoutes.route('/accommodations', accommodationsRoutes);
publicRoutes.route('/destinations', destinationsRoutes);
publicRoutes.route('/events', eventsRoutes);
publicRoutes.route('/posts', postsRoutes);
publicRoutes.route('/search', searchRoutes);

export { publicRoutes };
