/**
 * Public API routes
 * Main router that combines all public domain routes
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { accommodationRoutes } from './accommodation';

const app = new OpenAPIHono();

// Mount domain-specific routes
app.route('/', accommodationRoutes);

// TODO: Add other domain routes as they are created
// app.route('/', destinationRoutes);
// app.route('/', eventRoutes);
// app.route('/', searchRoutes);

export { app as publicRoutes };
