/**
 * API Documentation routes
 * Provides Swagger UI and OpenAPI documentation endpoints
 */
import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { env } from '../../utils/env';

const app = new OpenAPIHono();

// Redirect /docs to /docs/ui for better UX
app.get('/', (c) => {
    return c.redirect('/docs/ui');
});

// Swagger UI - Main documentation
app.get('/ui', swaggerUI({ url: '/docs/openapi.json' }));

// Alternative Swagger UI for testing
app.get('/ui-alt', swaggerUI({ url: '/openapi.json' }));

// Manual OpenAPI document with complete specification
app.get('/openapi.json', (c) => {
    const openApiDoc = {
        openapi: '3.0.0',
        info: {
            title: 'Hospeda API',
            version: '1.0.0',
            description:
                'Complete API for the Hospeda tourism accommodation platform with filtering, search, and pagination capabilities.',
            contact: {
                name: 'Hospeda Development Team',
                email: 'dev@hospeda.com'
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            }
        },
        servers: [
            {
                url: `http://${env.API_HOST}:${env.API_PORT}`,
                description: 'Development server'
            }
        ],
        paths: {
            '/': {
                get: {
                    summary: 'API information',
                    description: 'Returns basic information about the API',
                    tags: ['General'],
                    responses: {
                        '200': {
                            description: 'API information',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string' },
                                            version: { type: 'string' },
                                            status: { type: 'string' },
                                            timestamp: { type: 'string' },
                                            documentation: { type: 'string' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            '/health': {
                get: {
                    summary: 'Health check',
                    description: 'Returns the health status of the API',
                    tags: ['Health'],
                    responses: {
                        '200': {
                            description: 'API is healthy',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            status: {
                                                type: 'string',
                                                enum: ['healthy', 'unhealthy']
                                            },
                                            timestamp: { type: 'string' },
                                            uptime: { type: 'number' },
                                            version: { type: 'string' },
                                            environment: { type: 'string' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            '/api/v1/public/accommodations': {
                get: {
                    summary: 'List accommodations',
                    description: 'Get a paginated list of accommodations with filtering options',
                    tags: ['Accommodations'],
                    parameters: [
                        {
                            name: 'page',
                            in: 'query',
                            description: 'Page number for pagination',
                            required: false,
                            schema: { type: 'integer', minimum: 1, default: 1 }
                        },
                        {
                            name: 'limit',
                            in: 'query',
                            description: 'Number of items per page',
                            required: false,
                            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
                        },
                        {
                            name: 'location',
                            in: 'query',
                            description: 'Filter by location',
                            required: false,
                            schema: { type: 'string' }
                        },
                        {
                            name: 'minPrice',
                            in: 'query',
                            description: 'Minimum price filter',
                            required: false,
                            schema: { type: 'number' }
                        },
                        {
                            name: 'maxPrice',
                            in: 'query',
                            description: 'Maximum price filter',
                            required: false,
                            schema: { type: 'number' }
                        }
                    ],
                    responses: {
                        '200': {
                            description: 'Accommodations retrieved successfully',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            accommodations: {
                                                type: 'array',
                                                items: {
                                                    type: 'object',
                                                    properties: {
                                                        id: { type: 'string' },
                                                        name: { type: 'string' },
                                                        description: { type: 'string' },
                                                        location: { type: 'string' },
                                                        price: { type: 'number' },
                                                        rating: { type: 'number' },
                                                        amenities: {
                                                            type: 'array',
                                                            items: { type: 'string' }
                                                        }
                                                    }
                                                }
                                            },
                                            pagination: {
                                                type: 'object',
                                                properties: {
                                                    page: { type: 'number' },
                                                    limit: { type: 'number' },
                                                    total: { type: 'number' },
                                                    totalPages: { type: 'number' }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            '/api/v1/public/search': {
                get: {
                    summary: 'Search content',
                    description: 'Search across accommodations, destinations, and events',
                    tags: ['Search'],
                    parameters: [
                        {
                            name: 'q',
                            in: 'query',
                            description: 'Search query string',
                            required: true,
                            schema: { type: 'string', minLength: 1 }
                        },
                        {
                            name: 'type',
                            in: 'query',
                            description: 'Content type to search',
                            required: false,
                            schema: {
                                type: 'string',
                                enum: ['all', 'accommodations', 'destinations', 'events'],
                                default: 'all'
                            }
                        },
                        {
                            name: 'page',
                            in: 'query',
                            description: 'Page number for pagination',
                            required: false,
                            schema: { type: 'integer', minimum: 1, default: 1 }
                        },
                        {
                            name: 'limit',
                            in: 'query',
                            description: 'Number of items per page',
                            required: false,
                            schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 }
                        }
                    ],
                    responses: {
                        '200': {
                            description: 'Search results',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            results: {
                                                type: 'array',
                                                items: {
                                                    type: 'object',
                                                    properties: {
                                                        id: { type: 'string' },
                                                        type: {
                                                            type: 'string',
                                                            enum: [
                                                                'accommodation',
                                                                'destination',
                                                                'event'
                                                            ]
                                                        },
                                                        title: { type: 'string' },
                                                        description: { type: 'string' },
                                                        image: { type: 'string' },
                                                        score: { type: 'number' }
                                                    }
                                                }
                                            },
                                            pagination: {
                                                type: 'object',
                                                properties: {
                                                    page: { type: 'number' },
                                                    limit: { type: 'number' },
                                                    total: { type: 'number' },
                                                    totalPages: { type: 'number' }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        tags: [
            { name: 'General', description: 'General API information' },
            { name: 'Health', description: 'Health and monitoring endpoints' },
            { name: 'Accommodations', description: 'Hotel and accommodation management' },
            { name: 'Search', description: 'Search functionality' }
        ]
    };

    return c.json(openApiDoc);
});

export { app as docsRoutes };
