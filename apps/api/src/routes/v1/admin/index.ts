import { apiLogger } from '@/utils/logger';
import { Hono } from 'hono';
import { requireAdmin, requireAuth } from '../../../middleware/auth';
import { accommodationsRoutes } from './accommodations';
import { amenitiesRoutes } from './amenities';
import { destinationsRoutes } from './destinations';
import { eventsRoutes } from './events';
import { featuresRoutes } from './features';
import { permissionsRoutes } from './permissions';
import { postsRoutes } from './posts';
import { rolesRoutes } from './roles';
import { usersRoutes } from './users';

// Create the admin router
const adminRoutes = new Hono();

// Apply auth middleware to all admin routes
adminRoutes.use('*', requireAuth);
adminRoutes.use('*', requireAdmin);

// Mount entity-specific routes
adminRoutes.route('/accommodations', accommodationsRoutes);
adminRoutes.route('/amenities', amenitiesRoutes);
adminRoutes.route('/destinations', destinationsRoutes);
adminRoutes.route('/events', eventsRoutes);
adminRoutes.route('/features', featuresRoutes);
adminRoutes.route('/permissions', permissionsRoutes);
adminRoutes.route('/posts', postsRoutes);
adminRoutes.route('/roles', rolesRoutes);
adminRoutes.route('/users', usersRoutes);

// Admin dashboard stats
adminRoutes.get('/', async (c) => {
    apiLogger.info({ location: 'AdminAPI' }, 'Fetching admin dashboard stats');

    try {
        // This would fetch counts and stats from various services
        // For now we'll return mock data
        return c.json({
            success: true,
            data: {
                stats: {
                    totalUsers: 100,
                    totalAccommodations: 250,
                    totalDestinations: 15,
                    totalEvents: 45,
                    totalPosts: 120
                },
                recentActivity: {
                    newUsers: 5,
                    newBookings: 12,
                    newReviews: 8
                }
            }
        });
    } catch (error) {
        apiLogger.error(error as Error, 'AdminAPI - Error fetching admin stats');
        return c.json(
            {
                success: false,
                error: {
                    code: 'SERVER_ERROR',
                    message: 'Failed to fetch admin dashboard statistics'
                }
            },
            500
        );
    }
});

export { adminRoutes };
