import {
    errorResponse,
    notFoundResponse,
    paginatedResponse,
    successResponse
} from '@/utils/response';
import { zValidator } from '@hono/zod-validator';
import { PostService, PostSponsorService } from '@repo/db';
import { logger } from '@repo/logger';
import { PostCreateSchema, PostUpdateSchema } from '@repo/schemas';
import { Hono } from 'hono';
import { z } from 'zod';

// Create the posts router
const postsRoutes = new Hono();

// Common parameter validation
const idParam = z.object({
    id: z.string().uuid()
});

// List query params validation
const listQuerySchema = z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(20),
    query: z.string().optional(),
    category: z.string().optional(),
    visibility: z.string().optional(),
    state: z.string().optional(),
    orderBy: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
    isFeatured: z.enum(['true', 'false']).optional(),
    isNews: z.enum(['true', 'false']).optional(),
    isFeaturedInWebsite: z.enum(['true', 'false']).optional(),
    includeDeleted: z.enum(['true', 'false']).optional()
});

// List all posts
postsRoutes.get('/', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');
        const user = c.get('user');

        logger.info('Listing posts', 'PostsAPI', { query });

        // Convert pagination params
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit,
            query: query.query,
            category: query.category,
            visibility: query.visibility,
            state: query.state,
            orderBy: query.orderBy,
            order: query.order,
            isFeatured:
                query.isFeatured === 'true'
                    ? true
                    : query.isFeatured === 'false'
                      ? false
                      : undefined,
            isNews: query.isNews === 'true' ? true : query.isNews === 'false' ? false : undefined,
            isFeaturedInWebsite:
                query.isFeaturedInWebsite === 'true'
                    ? true
                    : query.isFeaturedInWebsite === 'false'
                      ? false
                      : undefined,
            includeDeleted: query.includeDeleted === 'true'
        };

        // Create the service
        const postService = new PostService();

        // Fetch posts
        const posts = await postService.list(filter, user);

        // Get total count for pagination
        const total =
            posts.length > query.limit
                ? posts.length
                : Math.max(query.page * query.limit, posts.length);

        return paginatedResponse(c, posts, {
            page: query.page,
            limit: query.limit,
            total: total
        });
    } catch (error) {
        logger.error('Error listing posts', 'PostsAPI', error);
        return errorResponse(c, {
            message: 'Error listing posts',
            status: 500
        });
    }
});

// Get post by ID
postsRoutes.get('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        logger.info('Fetching post by ID', 'PostsAPI', { id });

        const postService = new PostService();
        const post = await postService.getById(id, user);

        if (!post) {
            return notFoundResponse(c, 'Post not found');
        }

        return successResponse(c, post);
    } catch (error) {
        logger.error('Error fetching post', 'PostsAPI', error);

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Post not found');
        }

        return errorResponse(c, {
            message: 'Error fetching post',
            status: 500
        });
    }
});

// Create a new post
postsRoutes.post('/', zValidator('json', PostCreateSchema), async (c) => {
    try {
        const data = c.req.valid('json');
        const user = c.get('user');

        logger.info('Creating new post', 'PostsAPI');

        const postService = new PostService();
        const newPost = await postService.create(data, user);

        return successResponse(c, newPost, 201);
    } catch (error) {
        logger.error('Error creating post', 'PostsAPI', error);
        return errorResponse(c, {
            message: 'Error creating post',
            status: 500
        });
    }
});

// Update a post
postsRoutes.put(
    '/:id',
    zValidator('param', idParam),
    zValidator('json', PostUpdateSchema),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const data = c.req.valid('json');
            const user = c.get('user');

            logger.info('Updating post', 'PostsAPI', { id });

            const postService = new PostService();
            const updatedPost = await postService.update(id, data, user);

            return successResponse(c, updatedPost);
        } catch (error) {
            logger.error('Error updating post', 'PostsAPI', error);

            if ((error as Error).message.includes('not found')) {
                return notFoundResponse(c, 'Post not found');
            }
            if ((error as Error).message === 'Forbidden') {
                return errorResponse(c, {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to update this post',
                    status: 403
                });
            }

            return errorResponse(c, {
                message: 'Error updating post',
                status: 500
            });
        }
    }
);

// Delete (soft-delete) a post
postsRoutes.delete('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        logger.info('Soft-deleting post', 'PostsAPI', { id });

        const postService = new PostService();
        await postService.delete(id, user);

        return successResponse(c, { id, deleted: true });
    } catch (error) {
        logger.error('Error deleting post', 'PostsAPI', error);

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Post not found');
        }
        if ((error as Error).message === 'Forbidden') {
            return errorResponse(c, {
                code: 'FORBIDDEN',
                message: 'You do not have permission to delete this post',
                status: 403
            });
        }

        return errorResponse(c, {
            message: 'Error deleting post',
            status: 500
        });
    }
});

// Restore a soft-deleted post
postsRoutes.post('/:id/restore', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        logger.info('Restoring post', 'PostsAPI', { id });

        const postService = new PostService();
        await postService.restore(id, user);

        return successResponse(c, { id, restored: true });
    } catch (error) {
        logger.error('Error restoring post', 'PostsAPI', error);

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Post not found');
        }
        if ((error as Error).message === 'Forbidden') {
            return errorResponse(c, {
                code: 'FORBIDDEN',
                message: 'You do not have permission to restore this post',
                status: 403
            });
        }

        return errorResponse(c, {
            message: 'Error restoring post',
            status: 500
        });
    }
});

// Add a sponsor to a post
postsRoutes.post(
    '/:id/sponsors',
    zValidator('param', idParam),
    zValidator(
        'json',
        z.object({
            sponsorId: z.string().uuid(),
            message: z.string().min(3).max(100),
            description: z.string().min(3).max(100),
            paid: z.object({
                price: z.number().min(1),
                currency: z.enum(['ARS', 'USD'])
            }),
            fromDate: z.coerce.date().optional(),
            toDate: z.coerce.date().optional(),
            isHighlighted: z.boolean().default(false)
        })
    ),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const sponsorData = c.req.valid('json');
            const user = c.get('user');

            logger.info('Adding sponsor to post', 'PostsAPI', {
                postId: id,
                sponsorId: sponsorData.sponsorId
            });

            const postSponsorService = new PostSponsorService();
            const sponsorship = await postSponsorService.assignToPost(
                id,
                sponsorData.sponsorId,
                {
                    message: sponsorData.message,
                    description: sponsorData.description,
                    paid: sponsorData.paid,
                    fromDate: sponsorData.fromDate,
                    toDate: sponsorData.toDate,
                    isHighlighted: sponsorData.isHighlighted
                },
                user
            );

            return successResponse(c, sponsorship, 201);
        } catch (error) {
            logger.error('Error adding sponsor to post', 'PostsAPI', error);

            if (
                (error as Error).message.includes('post not found') ||
                (error as Error).message.includes('Post not found')
            ) {
                return notFoundResponse(c, 'Post not found');
            }
            if (
                (error as Error).message.includes('sponsor not found') ||
                (error as Error).message.includes('Sponsor not found')
            ) {
                return notFoundResponse(c, 'Sponsor not found');
            }

            return errorResponse(c, {
                message: 'Error adding sponsor to post',
                status: 500
            });
        }
    }
);

// Remove a sponsor from a post
postsRoutes.delete(
    '/:id/sponsors/:sponsorId',
    zValidator(
        'param',
        z.object({
            id: z.string().uuid(),
            sponsorId: z.string().uuid()
        })
    ),
    async (c) => {
        try {
            const { id, sponsorId } = c.req.valid('param');
            const user = c.get('user');

            logger.info('Removing sponsor from post', 'PostsAPI', { postId: id, sponsorId });

            const postSponsorService = new PostSponsorService();
            await postSponsorService.removeFromPost(id, sponsorId, user);

            return successResponse(c, { postId: id, sponsorId, removed: true });
        } catch (error) {
            logger.error('Error removing sponsor from post', 'PostsAPI', error);

            if ((error as Error).message.includes('not found')) {
                return notFoundResponse(c, (error as Error).message);
            }

            return errorResponse(c, {
                message: 'Error removing sponsor from post',
                status: 500
            });
        }
    }
);

export { postsRoutes };
