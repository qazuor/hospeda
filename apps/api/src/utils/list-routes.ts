/**
 * Utility to list all registered routes automatically
 */
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppBindings } from '../types';
import { env } from './env';
import { apiLogger } from './logger';

interface RouteInfo {
    method: string;
    path: string;
    description?: string;
}

interface GroupedRoutes {
    core: RouteInfo[];
    documentation: RouteInfo[];
    users: RouteInfo[];
    accommodations: RouteInfo[];
    destinations: RouteInfo[];
    events: RouteInfo[];
    attractions: RouteInfo[];
    amenities: RouteInfo[];
    tags: RouteInfo[];
    features: RouteInfo[];
    posts: RouteInfo[];
    other: RouteInfo[];
}

/**
 * Extract routes from OpenAPI Hono app instance
 */
const extractRoutes = (app: OpenAPIHono<AppBindings>): RouteInfo[] => {
    const routes: RouteInfo[] = [];

    try {
        // Access the OpenAPI registry to get registered routes
        const openApiRoutes = app.getOpenAPIDocument({
            openapi: '3.1.0',
            info: { title: 'API', version: '1.0.0' }
        });

        // Extract paths from OpenAPI document
        if (openApiRoutes.paths) {
            for (const [path, pathItem] of Object.entries(openApiRoutes.paths)) {
                if (pathItem && typeof pathItem === 'object') {
                    for (const [method, operation] of Object.entries(pathItem)) {
                        if (operation && typeof operation === 'object' && 'summary' in operation) {
                            routes.push({
                                method: method.toUpperCase(),
                                path,
                                description:
                                    (operation.summary as string) ||
                                    (operation.description as string) ||
                                    ''
                            });
                        }
                    }
                }
            }
        }

        apiLogger.info(`Extracted ${routes.length} routes from OpenAPI registry`);
    } catch (error) {
        apiLogger.warn('Could not extract OpenAPI routes, using fallback method');
        apiLogger.debug(
            'OpenAPI extraction error:',
            error instanceof Error ? error.message : String(error)
        );
    }

    return routes;
};

/**
 * Group routes by entity
 */
const groupRoutes = (routes: RouteInfo[]): GroupedRoutes => {
    const grouped: GroupedRoutes = {
        core: [],
        documentation: [],
        users: [],
        accommodations: [],
        destinations: [],
        events: [],
        attractions: [],
        amenities: [],
        tags: [],
        features: [],
        posts: [],
        other: []
    };

    for (const route of routes) {
        const path = route.path.toLowerCase();

        // Core routes
        if (route.path === '/' || path.includes('health')) {
            grouped.core.push(route);
        }
        // Documentation routes
        else if (path.includes('docs') || path.includes('openapi')) {
            grouped.documentation.push(route);
        }
        // Entity-specific routes
        else if (path.includes('user')) {
            grouped.users.push(route);
        } else if (path.includes('accommodation')) {
            grouped.accommodations.push(route);
        } else if (path.includes('destination')) {
            grouped.destinations.push(route);
        } else if (path.includes('event')) {
            grouped.events.push(route);
        } else if (path.includes('attraction')) {
            grouped.attractions.push(route);
        } else if (path.includes('amenity') || path.includes('amenities')) {
            grouped.amenities.push(route);
        } else if (path.includes('tag')) {
            grouped.tags.push(route);
        } else if (path.includes('feature')) {
            grouped.features.push(route);
        } else if (path.includes('post')) {
            grouped.posts.push(route);
        } else {
            grouped.other.push(route);
        }
    }

    return grouped;
};

/**
 * Display routes in a formatted way grouped by entity
 */
const displayRoutes = (grouped: GroupedRoutes) => {
    apiLogger.info('📋 Registered API Endpoints:');
    apiLogger.info('');

    // Core endpoints
    if (grouped.core.length > 0) {
        apiLogger.info('🔧 Core Endpoints:');
        for (const route of grouped.core) {
            apiLogger.info(
                `  ${route.method.padEnd(6)} http://${env.API_HOST}:${env.API_PORT}${route.path.padEnd(35)} - ${route.description || 'No description'}`
            );
        }
        apiLogger.info('');
    }

    // Documentation endpoints
    if (grouped.documentation.length > 0) {
        apiLogger.info('📖 Documentation:');
        for (const route of grouped.documentation) {
            apiLogger.info(
                `  ${route.method.padEnd(6)} http://${env.API_HOST}:${env.API_PORT}${route.path.padEnd(35)} - ${route.description || 'No description'}`
            );
        }
        apiLogger.info('');
    }

    // Public API section
    const publicApiRoutes = [
        ...grouped.users,
        ...grouped.accommodations,
        ...grouped.destinations,
        ...grouped.events,
        ...grouped.attractions,
        ...grouped.amenities,
        ...grouped.tags,
        ...grouped.features,
        ...grouped.posts
    ];

    if (publicApiRoutes.length > 0) {
        apiLogger.info('🌐 Public API:');
        apiLogger.info('');

        // Users endpoints
        if (grouped.users.length > 0) {
            apiLogger.info('  👥 Users:');
            for (const route of grouped.users) {
                apiLogger.info(
                    `    ${route.method.padEnd(6)} http://${env.API_HOST}:${env.API_PORT}${route.path.padEnd(35)} - ${route.description || 'No description'}`
                );
            }
            apiLogger.info('');
        }

        // Accommodations endpoints
        if (grouped.accommodations.length > 0) {
            apiLogger.info('  🏨 Accommodations:');
            for (const route of grouped.accommodations) {
                apiLogger.info(
                    `    ${route.method.padEnd(6)} http://${env.API_HOST}:${env.API_PORT}${route.path.padEnd(35)} - ${route.description || 'No description'}`
                );
            }
            apiLogger.info('');
        }

        // Destinations endpoints
        if (grouped.destinations.length > 0) {
            apiLogger.info('  🗺️  Destinations:');
            for (const route of grouped.destinations) {
                apiLogger.info(
                    `    ${route.method.padEnd(6)} http://${env.API_HOST}:${env.API_PORT}${route.path.padEnd(35)} - ${route.description || 'No description'}`
                );
            }
            apiLogger.info('');
        }

        // Events endpoints
        if (grouped.events.length > 0) {
            apiLogger.info('  🎉 Events:');
            for (const route of grouped.events) {
                apiLogger.info(
                    `    ${route.method.padEnd(6)} http://${env.API_HOST}:${env.API_PORT}${route.path.padEnd(35)} - ${route.description || 'No description'}`
                );
            }
            apiLogger.info('');
        }

        // Attractions endpoints
        if (grouped.attractions.length > 0) {
            apiLogger.info('  🎡 Attractions:');
            for (const route of grouped.attractions) {
                apiLogger.info(
                    `    ${route.method.padEnd(6)} http://${env.API_HOST}:${env.API_PORT}${route.path.padEnd(35)} - ${route.description || 'No description'}`
                );
            }
            apiLogger.info('');
        }

        // Amenities endpoints
        if (grouped.amenities.length > 0) {
            apiLogger.info('  🏪 Amenities:');
            for (const route of grouped.amenities) {
                apiLogger.info(
                    `    ${route.method.padEnd(6)} http://${env.API_HOST}:${env.API_PORT}${route.path.padEnd(35)} - ${route.description || 'No description'}`
                );
            }
            apiLogger.info('');
        }

        // Tags endpoints
        if (grouped.tags.length > 0) {
            apiLogger.info('  🏷️  Tags:');
            for (const route of grouped.tags) {
                apiLogger.info(
                    `    ${route.method.padEnd(6)} http://${env.API_HOST}:${env.API_PORT}${route.path.padEnd(35)} - ${route.description || 'No description'}`
                );
            }
            apiLogger.info('');
        }

        // Features endpoints
        if (grouped.features.length > 0) {
            apiLogger.info('  ⭐ Features:');
            for (const route of grouped.features) {
                apiLogger.info(
                    `    ${route.method.padEnd(6)} http://${env.API_HOST}:${env.API_PORT}${route.path.padEnd(35)} - ${route.description || 'No description'}`
                );
            }
            apiLogger.info('');
        }

        // Posts endpoints
        if (grouped.posts.length > 0) {
            apiLogger.info('  📝 Posts:');
            for (const route of grouped.posts) {
                apiLogger.info(
                    `    ${route.method.padEnd(6)} http://${env.API_HOST}:${env.API_PORT}${route.path.padEnd(35)} - ${route.description || 'No description'}`
                );
            }
            apiLogger.info('');
        }
    }

    // Other endpoints
    if (grouped.other.length > 0) {
        apiLogger.info('🔀 Other Endpoints:');
        for (const route of grouped.other) {
            apiLogger.info(
                `  ${route.method.padEnd(6)} http://${env.API_HOST}:${env.API_PORT}${route.path.padEnd(35)} - ${route.description || 'No description'}`
            );
        }
        apiLogger.info('');
    }

    // Quick links
    apiLogger.info('🔗 Quick Links:');
    apiLogger.info(`  📚 Documentation: http://${env.API_HOST}:${env.API_PORT}/docs`);
    apiLogger.info(`  🔍 API Spec: http://${env.API_HOST}:${env.API_PORT}/docs/openapi.json`);
    apiLogger.info(`  ❤️  Health Check: http://${env.API_HOST}:${env.API_PORT}/health`);
    apiLogger.info('');
};

/**
 * Extract and display all registered routes from the Hono app
 */
export const listRoutes = (app: OpenAPIHono<AppBindings>) => {
    const routes = extractRoutes(app);
    const grouped = groupRoutes(routes);
    displayRoutes(grouped);
};
