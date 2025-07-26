/**
 * Utility to list all registered routes automatically
 */
import type { OpenAPIHono } from '@hono/zod-openapi';
import { logger } from '@repo/logger';
import { env } from './env';
import { MANUAL_ROUTES } from './manual-routes';

interface RouteInfo {
    method: string;
    path: string;
    description?: string;
}

interface GroupedRoutes {
    core: RouteInfo[];
    documentation: RouteInfo[];
    public: RouteInfo[];
    admin: RouteInfo[];
    other: RouteInfo[];
}

/**
 * Extract routes from OpenAPI Hono app instance
 */
const extractRoutes = (app: OpenAPIHono): RouteInfo[] => {
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

        logger.info(`Extracted ${routes.length} routes from OpenAPI registry`);

        // Add manual routes that might not be in OpenAPI registry
        for (const manualRoute of MANUAL_ROUTES) {
            const exists = routes.some(
                (route) => route.method === manualRoute.method && route.path === manualRoute.path
            );
            if (!exists) {
                routes.push({
                    method: manualRoute.method,
                    path: manualRoute.path,
                    description: manualRoute.description
                });
            }
        }
    } catch (error) {
        logger.warn('Could not extract OpenAPI routes, using fallback method');
        logger.debug(
            'OpenAPI extraction error:',
            error instanceof Error ? error.message : String(error)
        );

        // Fallback: Use only manual routes (they already contain all necessary routes)
        for (const manualRoute of MANUAL_ROUTES) {
            routes.push({
                method: manualRoute.method,
                path: manualRoute.path,
                description: manualRoute.description
            });
        }
    }

    return routes;
};

/**
 * Group routes by category
 */
const groupRoutes = (routes: RouteInfo[]): GroupedRoutes => {
    const grouped: GroupedRoutes = {
        core: [],
        documentation: [],
        public: [],
        admin: [],
        other: []
    };

    for (const route of routes) {
        if (route.path === '/' || route.path.startsWith('/health')) {
            grouped.core.push(route);
        } else if (route.path.startsWith('/docs') || route.path.includes('openapi')) {
            grouped.documentation.push(route);
        } else if (route.path.includes('/public')) {
            grouped.public.push(route);
        } else if (route.path.includes('/admin')) {
            grouped.admin.push(route);
        } else {
            grouped.other.push(route);
        }
    }

    return grouped;
};

/**
 * Display routes in a formatted way
 */
const displayRoutes = (grouped: GroupedRoutes) => {
    logger.info('📋 Registered API Endpoints:');
    logger.info('');

    // Core endpoints
    if (grouped.core.length > 0) {
        logger.info('🔧 Core Endpoints:');
        for (const route of grouped.core) {
            logger.info(
                `  ${route.method.padEnd(6)} http://${env.API_HOST}:${env.API_PORT}${route.path.padEnd(35)} - ${route.description || 'No description'}`
            );
        }
        logger.info('');
    }

    // Documentation endpoints
    if (grouped.documentation.length > 0) {
        logger.info('📖 Documentation:');
        for (const route of grouped.documentation) {
            logger.info(
                `  ${route.method.padEnd(6)} http://${env.API_HOST}:${env.API_PORT}${route.path.padEnd(35)} - ${route.description || 'No description'}`
            );
        }
        logger.info('');
    }

    // Public API endpoints
    if (grouped.public.length > 0) {
        logger.info('🌐 Public API:');
        for (const route of grouped.public) {
            logger.info(
                `  ${route.method.padEnd(6)} http://${env.API_HOST}:${env.API_PORT}${route.path.padEnd(35)} - ${route.description || 'No description'}`
            );
        }
        logger.info('');
    }

    // Admin API endpoints
    if (grouped.admin.length > 0) {
        logger.info('� Admin API:');
        for (const route of grouped.admin) {
            logger.info(
                `  ${route.method.padEnd(6)} http://${env.API_HOST}:${env.API_PORT}${route.path.padEnd(35)} - ${route.description || 'No description'}`
            );
        }
        logger.info('');
    }

    // Other endpoints
    if (grouped.other.length > 0) {
        logger.info('🔀 Other Endpoints:');
        for (const route of grouped.other) {
            logger.info(
                `  ${route.method.padEnd(6)} ${route.path.padEnd(35)} - ${route.description || 'No description'}`
            );
        }
        logger.info('');
    }

    // Quick links
    logger.info('🔗 Quick Links:');
    logger.info(`  📚 Documentation: http://${env.API_HOST}:${env.API_PORT}/docs`);
    logger.info(`  🔍 API Spec: http://${env.API_HOST}:${env.API_PORT}/docs/openapi.json`);
    logger.info(`  ❤️  Health Check: http://${env.API_HOST}:${env.API_PORT}/health`);
    logger.info('');
};

/**
 * Extract and display all registered routes from the Hono app
 */
export const listRoutes = (app: OpenAPIHono) => {
    const routes = extractRoutes(app);
    const grouped = groupRoutes(routes);
    displayRoutes(grouped);
};
