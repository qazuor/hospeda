import { publicUser } from '@/types';
import {
    errorResponse,
    notFoundResponse,
    paginatedResponse,
    successResponse
} from '@/utils/response';
import { zValidator } from '@hono/zod-validator';
import { PostService } from '@repo/db';
import { logger } from '@repo/logger';
import { Hono } from 'hono';
import { z } from 'zod';

// Create the posts public router
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
    orderBy: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
    isFeatured: z.enum(['true', 'false']).optional(),
    isNews: z.enum(['true', 'false']).optional()
});

// List public posts
postsRoutes.get('/', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');

        logger.info('Listing public posts', 'PublicAPI', { query });

        // Convert pagination params
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit,
            query: query.query,
            category: query.category,
            orderBy: query.orderBy,
            order: query.order,
            visibility: 'PUBLIC', // Only public posts
            state: 'ACTIVE', // Only active posts
            isFeatured:
                query.isFeatured === 'true'
                    ? true
                    : query.isFeatured === 'false'
                      ? false
                      : undefined,
            isNews: query.isNews === 'true' ? true : query.isNews === 'false' ? false : undefined,
            includeDeleted: false
        };

        // Create the service
        const postService = new PostService();

        // Fetch posts
        const posts = await postService.list(filter, publicUser);

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
        logger.error('Error listing public posts', 'PublicAPI', error);
        return errorResponse(c, {
            message: 'Error listing posts',
            status: 500
        });
    }
});

// Get a public post by ID
postsRoutes.get('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');

        logger.info('Fetching public post by ID', 'PublicAPI', { id });

        const postService = new PostService();
        const post = await postService.getById(id, publicUser);

        if (!post || post.visibility !== 'PUBLIC' || post.state !== 'ACTIVE') {
            return notFoundResponse(c, 'Post not found');
        }

        return successResponse(c, post);
    } catch (error) {
        logger.error('Error fetching public post', 'PublicAPI', error);

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Post not found');
        }

        return errorResponse(c, {
            message: 'Error fetching post',
            status: 500
        });
    }
});

// Get a public post by slug
postsRoutes.get(
    '/slug/:slug',
    zValidator(
        'param',
        z.object({
            slug: z.string().min(3).max(100)
        })
    ),
    async (c) => {
        try {
            const { slug } = c.req.valid('param');

            logger.info('Fetching public post by slug', 'PublicAPI', { slug });

            const postService = new PostService();
            const post = await postService.getBySlug(slug, publicUser);

            if (!post || post.visibility !== 'PUBLIC' || post.state !== 'ACTIVE') {
                return notFoundResponse(c, 'Post not found');
            }

            return successResponse(c, post);
        } catch (error) {
            logger.error('Error fetching public post by slug', 'PublicAPI', error);

            if ((error as Error).message.includes('not found')) {
                return notFoundResponse(c, 'Post not found');
            }

            return errorResponse(c, {
                message: 'Error fetching post',
                status: 500
            });
        }
    }
);

// Get featured posts
postsRoutes.get('/featured', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');

        logger.info('Fetching featured posts', 'PublicAPI', { query });

        const limit = query.limit;

        // Create the service
        const postService = new PostService();
        const featuredPosts = await postService.getFeatured(limit, publicUser);

        return successResponse(c, featuredPosts);
    } catch (error) {
        logger.error('Error fetching featured posts', 'PublicAPI', error);
        return errorResponse(c, {
            message: 'Error fetching featured posts',
            status: 500
        });
    }
});

// Get news posts
postsRoutes.get('/news', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');

        logger.info('Fetching news posts', 'PublicAPI', { query });

        const limit = query.limit;

        // Create the service
        const postService = new PostService();
        const newsPosts = await postService.getNews(limit, publicUser);

        return successResponse(c, newsPosts);
    } catch (error) {
        logger.error('Error fetching news posts', 'PublicAPI', error);
        return errorResponse(c, {
            message: 'Error fetching news posts',
            status: 500
        });
    }
});

// Get posts by category
postsRoutes.get(
    '/category/:category',
    zValidator(
        'param',
        z.object({
            category: z.string()
        })
    ),
    zValidator('query', listQuerySchema),
    async (c) => {
        try {
            const { category } = c.req.valid('param');
            const query = c.req.valid('query');

            logger.info('Fetching posts by category', 'PublicAPI', {
                category,
                query
            });

            // Create the service
            const postService = new PostService();

            // Pagination params
            const filter = {
                limit: query.limit,
                offset: (query.page - 1) * query.limit
            };

            // Fetch posts by category
            const posts = await postService.getByCategory(category, publicUser, filter);

            // Filter to public and active posts
            const publicPosts = posts.filter(
                (post) => post.visibility === 'PUBLIC' && post.state === 'ACTIVE'
            );

            // Get total count for pagination
            const total =
                publicPosts.length > query.limit
                    ? publicPosts.length
                    : Math.max(query.page * query.limit, publicPosts.length);

            return paginatedResponse(c, publicPosts, {
                page: query.page,
                limit: query.limit,
                total: total
            });
        } catch (error) {
            logger.error('Error fetching posts by category', 'PublicAPI', error);
            return errorResponse(c, {
                message: 'Error fetching posts by category',
                status: 500
            });
        }
    }
);

// Get posts related to a destination
postsRoutes.get(
    '/destination/:id',
    zValidator('param', idParam),
    zValidator('query', listQuerySchema),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const query = c.req.valid('query');

            logger.info('Fetching posts related to destination', 'PublicAPI', {
                destinationId: id
            });

            // Create the service
            const postService = new PostService();

            // Pagination params
            const filter = {
                limit: query.limit,
                offset: (query.page - 1) * query.limit
            };

            // Fetch related posts
            const posts = await postService.getByRelatedDestination(id, publicUser, filter);

            // Filter to public and active posts
            const publicPosts = posts.filter(
                (post) => post.visibility === 'PUBLIC' && post.state === 'ACTIVE'
            );

            // Get total count for pagination
            const total =
                publicPosts.length > query.limit
                    ? publicPosts.length
                    : Math.max(query.page * query.limit, publicPosts.length);

            return paginatedResponse(c, publicPosts, {
                page: query.page,
                limit: query.limit,
                total: total
            });
        } catch (error) {
            logger.error('Error fetching posts related to destination', 'PublicAPI', error);
            return errorResponse(c, {
                message: 'Error fetching posts related to destination',
                status: 500
            });
        }
    }
);

export { postsRoutes };
