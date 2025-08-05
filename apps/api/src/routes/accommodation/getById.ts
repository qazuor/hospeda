/**
 * Get accommodation by ID endpoint
 * ✅ Migrated to use createCRUDRoute (Route Factory 2.0)
 */
import { z } from '@hono/zod-openapi';
import { createCRUDRoute } from '../../utils/route-factory';
import { accommodationSchema } from './schemas';

// ✅ Migrated to createCRUDRoute with proper error handling
export const accommodationGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get accommodation by ID',
    description: 'Returns an accommodation by its ID',
    tags: ['Accommodations'],
    requestParams: {
        id: z.string().min(1, 'ID is required')
    },
    responseSchema: accommodationSchema,
    handler: async (_ctx, params) => {
        const { id } = params as { id: string };

        // Mock accommodation lookup
        // In a real implementation, this would call a service
        const mockAccommodations = {
            '1': { id: '1', age: 20, name: 'Ultra-man' },
            '2': { id: '2', age: 21, name: 'Super-man' },
            '3': { id: '3', age: 25, name: 'Iron-man' }
        };

        const accommodation = mockAccommodations[id as keyof typeof mockAccommodations];

        if (!accommodation) {
            throw new Error(`Accommodation with ID ${id} not found`);
        }

        return accommodation;
    },
    options: {
        cacheTTL: 300, // Cache for 5 minutes
        customRateLimit: { requests: 300, windowMs: 60000 }
    }
});
