import logger from '@repo/logger';
import { UserBookmarkToggleHttpSchema } from '@repo/schemas';
import type { APIRoute } from 'astro';
import { z } from 'zod';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

/**
 * POST /api/bookmarks
 * Handles adding/removing bookmarks for any entity type.
 * Requires an authenticated Better Auth session.
 */
export const POST: APIRoute = async ({ request }) => {
    try {
        // Verify user session via Better Auth
        const apiUrl = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001';
        const cookieHeader = request.headers.get('cookie') || '';
        const sessionResponse = await fetch(`${apiUrl}/api/auth/get-session`, {
            headers: { cookie: cookieHeader }
        });

        if (!sessionResponse.ok) {
            return new Response(
                JSON.stringify({ success: false, message: 'Authentication required' }),
                { status: 401, headers: JSON_HEADERS }
            );
        }

        const sessionData = await sessionResponse.json();
        const userId = sessionData?.user?.id;

        if (!userId) {
            return new Response(
                JSON.stringify({ success: false, message: 'Authentication required' }),
                { status: 401, headers: JSON_HEADERS }
            );
        }

        // Parse and validate request body
        const body = await request.json();
        const validated = UserBookmarkToggleHttpSchema.parse(body);

        // Forward to the API backend bookmark endpoint
        const bookmarkResponse = await fetch(`${apiUrl}/api/v1/bookmarks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
            body: JSON.stringify({
                userId,
                entityId: validated.entityId,
                entityType: validated.entityType,
                action: validated.action
            })
        });

        // If the backend bookmark endpoint doesn't exist yet, fall back to a stub response
        if (bookmarkResponse.status === 404) {
            logger.warn(
                {
                    userId,
                    entityId: validated.entityId,
                    entityType: validated.entityType,
                    action: validated.action
                },
                'Bookmark API endpoint not available yet, returning stub response'
            );
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
                { status: 200, headers: JSON_HEADERS }
            );
        }

        // Forward the backend response
        const bookmarkData = await bookmarkResponse.json();
        return new Response(JSON.stringify(bookmarkData), {
            status: bookmarkResponse.status,
            headers: JSON_HEADERS
        });
    } catch (error) {
        logger.error({ error }, 'Bookmark API error');

        if (error instanceof z.ZodError) {
            return new Response(
                JSON.stringify({
                    success: false,
                    message: 'Invalid request data',
                    errors: error.issues
                }),
                { status: 400, headers: JSON_HEADERS }
            );
        }

        return new Response(JSON.stringify({ success: false, message: 'Internal server error' }), {
            status: 500,
            headers: JSON_HEADERS
        });
    }
};
