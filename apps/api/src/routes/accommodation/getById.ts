import { createRoute, z } from '@hono/zod-openapi';
import createApp from '../../utils/create-app';
import { ParamsSchema, accommodationSchema } from './schemas';

const app = createApp();

export const accommodationGetByIdOpenAPIRoute = createRoute({
    method: 'get',
    path: '/{id}',
    summary: 'accommodation by id',
    description: 'Returns an accommodation by id',
    tags: ['accommodations'],
    request: {
        params: ParamsSchema
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        data: accommodationSchema,
                        metadata: z.object({
                            timestamp: z.string(),
                            requestId: z.string()
                        })
                    })
                }
            },
            description: 'Retrieve the accommodation'
        },
        404: {
            description: 'Accommodation not found',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.string(),
                            message: z.string()
                        }),
                        metadata: z.object({
                            timestamp: z.string(),
                            requestId: z.string()
                        })
                    })
                }
            }
        }
    }
});

app.openapi(accommodationGetByIdOpenAPIRoute, (c) => {
    const { id } = c.req.valid('param');

    // Simulate accommodation lookup - for now always return success
    // In a real implementation, you would check if accommodation exists
    const accommodation = {
        id,
        age: 20,
        name: 'Ultra-man'
    };

    // For now, always return 200. In real implementation, you would check if accommodation exists
    // and return 404 if not found
    return c.json(
        {
            success: true,
            data: accommodation,
            metadata: {
                timestamp: new Date().toISOString(),
                requestId: c.req.header('x-request-id') || 'unknown'
            }
        },
        200
    );
});

export { app as accommodationGetByIdRoute };
