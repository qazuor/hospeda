import { EntityTypeEnum } from '@repo/types';
import type { APIRoute } from 'astro';
import { z } from 'zod';

/**
 * Schema for bookmark request
 */
const BookmarkRequestSchema = z.object({
    entityId: z.string().min(1, 'Entity ID is required'),
    entityType: z.nativeEnum(EntityTypeEnum, {
        message: 'Invalid entity type'
    }),
    action: z.enum(['ADD', 'REMOVE'])
});

/**
 * POST /api/bookmarks
 * Handles adding/removing bookmarks for any entity type
 */
export const POST: APIRoute = async ({ request }) => {
    try {
        // Parse and validate request body
        const body = await request.json();
        const validated = BookmarkRequestSchema.parse(body);

        // TODO: Get user ID from Clerk session
        // TODO: Call the bookmark service
        // This would typically call your service layer

        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Return success response
        return new Response(
            JSON.stringify({
                success: true,
                message: `Bookmark ${validated.action.toLowerCase()}ed successfully`,
                data: {
                    entityId: validated.entityId,
                    entityType: validated.entityType,
                    bookmarked: validated.action === 'ADD'
                }
            }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    } catch (error) {
        console.error('Bookmark API error:', error);

        if (error instanceof z.ZodError) {
            return new Response(
                JSON.stringify({
                    success: false,
                    message: 'Invalid request data',
                    errors: error.issues
                }),
                {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );
        }

        return new Response(
            JSON.stringify({
                success: false,
                message: 'Internal server error'
            }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    }
};
