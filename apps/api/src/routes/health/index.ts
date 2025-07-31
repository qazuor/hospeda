/**
 * Health check routes index
 * Exports all health-related routes
 */
import { dbHealthRoutes } from './db-health';
import { healthRoutes } from './health';
import { liveRoutes } from './live';
import { readyRoutes } from './ready';

export { dbHealthRoutes, healthRoutes, liveRoutes, readyRoutes };
