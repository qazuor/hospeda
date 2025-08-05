/**
 * Route helpers for creating common API routes
 * Provides a unified interface for creating CRUD and list routes with consistent structure
 */

import { createPaginatedResponse, createResponse } from './response-helpers';
import { createCRUDRoute, createListRoute } from './route-factory';

export { createPaginatedResponse, createResponse } from './response-helpers';
export {
    createCRUDRoute,
    createListRoute,
    type CreateOpenApiRouteInterface
} from './route-factory';

/**
 * Route helpers namespace for easy access to all route creation utilities
 */
export const RouteHelpers = {
    // Route creation functions
    createCRUDRoute,
    createListRoute,

    // Response creation functions
    createResponse,
    createPaginatedResponse
};
