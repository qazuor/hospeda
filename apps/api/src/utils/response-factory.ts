import { z } from '@hono/zod-openapi';
import {
    errorResponseSchema,
    paginatedListResponseSchema,
    successResponseSchema
} from '../schemas';

/**
 * Response factory for generating standard API responses
 * Automatically creates consistent response schemas for OpenAPI
 */
export const ResponseFactory = {
    /**
     * Creates CRUD operation responses
     * Includes success and error responses for create, read, update, delete operations
     */
    createCRUDResponses<T extends z.ZodTypeAny>(entitySchema: T) {
        return {
            200: {
                content: {
                    'application/json': {
                        schema: successResponseSchema(entitySchema)
                    }
                },
                description: 'Success'
            },
            201: {
                content: {
                    'application/json': {
                        schema: successResponseSchema(entitySchema)
                    }
                },
                description: 'Created successfully'
            },
            204: {
                description: 'Deleted successfully'
            },
            400: {
                content: {
                    'application/json': {
                        schema: errorResponseSchema
                    }
                },
                description: 'Bad Request'
            },
            401: {
                content: {
                    'application/json': {
                        schema: errorResponseSchema
                    }
                },
                description: 'Unauthorized'
            },
            403: {
                content: {
                    'application/json': {
                        schema: errorResponseSchema
                    }
                },
                description: 'Forbidden'
            },
            404: {
                content: {
                    'application/json': {
                        schema: errorResponseSchema
                    }
                },
                description: 'Not Found'
            },
            409: {
                content: {
                    'application/json': {
                        schema: errorResponseSchema
                    }
                },
                description: 'Conflict'
            },
            422: {
                content: {
                    'application/json': {
                        schema: errorResponseSchema
                    }
                },
                description: 'Unprocessable Entity'
            },
            500: {
                content: {
                    'application/json': {
                        schema: errorResponseSchema
                    }
                },
                description: 'Internal Server Error'
            }
        };
    },

    /**
     * Creates list responses with pagination
     * Includes success and error responses for list operations
     */
    createListResponses<T extends z.ZodTypeAny>(entitySchema: T) {
        return {
            200: {
                content: {
                    'application/json': {
                        schema: paginatedListResponseSchema(entitySchema)
                    }
                },
                description: 'Success'
            },
            400: {
                content: {
                    'application/json': {
                        schema: errorResponseSchema
                    }
                },
                description: 'Bad Request'
            },
            401: {
                content: {
                    'application/json': {
                        schema: errorResponseSchema
                    }
                },
                description: 'Unauthorized'
            },
            500: {
                content: {
                    'application/json': {
                        schema: errorResponseSchema
                    }
                },
                description: 'Internal Server Error'
            }
        };
    },

    /**
     * Creates search responses with pagination
     * Includes success and error responses for search operations
     */
    createSearchResponses<T extends z.ZodTypeAny>(entitySchema: T) {
        return {
            200: {
                content: {
                    'application/json': {
                        schema: paginatedListResponseSchema(entitySchema)
                    }
                },
                description: 'Search results'
            },
            400: {
                content: {
                    'application/json': {
                        schema: errorResponseSchema
                    }
                },
                description: 'Invalid search parameters'
            },
            401: {
                content: {
                    'application/json': {
                        schema: errorResponseSchema
                    }
                },
                description: 'Unauthorized'
            },
            500: {
                content: {
                    'application/json': {
                        schema: errorResponseSchema
                    }
                },
                description: 'Internal Server Error'
            }
        };
    },

    /**
     * Creates health check responses
     * Simple responses for health check endpoints
     */
    createHealthResponses() {
        return {
            200: {
                content: {
                    'application/json': {
                        schema: z.object({
                            status: z.string(),
                            timestamp: z.string().datetime(),
                            version: z.string().optional()
                        })
                    }
                },
                description: 'Service is healthy'
            },
            503: {
                content: {
                    'application/json': {
                        schema: z.object({
                            status: z.string(),
                            error: z.string(),
                            timestamp: z.string().datetime()
                        })
                    }
                },
                description: 'Service is unhealthy'
            }
        };
    },

    /**
     * Creates authentication responses
     * Responses for login, logout, and token operations
     */
    createAuthResponses() {
        return {
            200: {
                content: {
                    'application/json': {
                        schema: z.object({
                            success: z.literal(true),
                            data: z.object({
                                user: z.object({
                                    id: z.string(),
                                    email: z.string().email(),
                                    name: z.string().optional()
                                }),
                                token: z.string().optional()
                            })
                        })
                    }
                },
                description: 'Authentication successful'
            },
            401: {
                content: {
                    'application/json': {
                        schema: errorResponseSchema
                    }
                },
                description: 'Authentication failed'
            },
            403: {
                content: {
                    'application/json': {
                        schema: errorResponseSchema
                    }
                },
                description: 'Access forbidden'
            }
        };
    },

    /**
     * Creates file upload responses
     * Responses for file upload operations
     */
    createFileUploadResponses() {
        return {
            201: {
                content: {
                    'application/json': {
                        schema: z.object({
                            success: z.literal(true),
                            data: z.object({
                                fileId: z.string(),
                                filename: z.string(),
                                size: z.number(),
                                url: z.string().url(),
                                mimeType: z.string()
                            })
                        })
                    }
                },
                description: 'File uploaded successfully'
            },
            400: {
                content: {
                    'application/json': {
                        schema: errorResponseSchema
                    }
                },
                description: 'Invalid file'
            },
            413: {
                content: {
                    'application/json': {
                        schema: errorResponseSchema
                    }
                },
                description: 'File too large'
            },
            415: {
                content: {
                    'application/json': {
                        schema: errorResponseSchema
                    }
                },
                description: 'Unsupported media type'
            }
        };
    }
};
