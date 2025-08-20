import { ensureDatabase } from '@/server/db';
import { PostService } from '@repo/service-core';
import type { PostType } from '@repo/types';

import { getCurrentUser } from '@/data/user';

/**
 * Returns paginated posts data.
 */
type LocalsAuth = () => { userId?: string | null } | undefined | null;

export const getPosts = async ({
    locals,
    page = 1,
    pageSize = 12,
    filters = {}
}: {
    locals?: { auth?: LocalsAuth };
    page?: number;
    pageSize?: number;
    filters?: Record<string, unknown>;
} = {}): Promise<{
    posts: PostType[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });

    const postService = new PostService({});

    const result = await postService.list(actor, {
        page,
        pageSize,
        ...filters
    });

    const posts = result.data?.items ?? [];
    const total = result.data?.total ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
        posts,
        total,
        page,
        pageSize,
        totalPages
    };
};

/**
 * Returns a single post by slug.
 */
export const getPostBySlug = async ({
    locals,
    slug
}: {
    locals?: { auth?: LocalsAuth };
    slug: string;
}): Promise<{
    post: PostType | null;
}> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });

    const postService = new PostService({});

    const result = await postService.getBySlug(actor, slug);

    return {
        post: result.data ?? null
    };
};

/**
 * Returns featured posts.
 */
export const getFeaturedPosts = async ({
    locals,
    limit = 6
}: {
    locals?: { auth?: LocalsAuth };
    limit?: number;
} = {}): Promise<{
    posts: PostType[];
}> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });

    const postService = new PostService({});

    const result = await postService.getFeatured(actor, {});

    // Limit the results if needed
    const posts = result.data?.slice(0, limit) ?? [];

    return {
        posts
    };
};

/**
 * Fetch all posts for static path generation.
 * Used by getStaticPaths to prerender all post pages.
 *
 * @param locals - Optional locals for authentication context
 * @returns Promise with all posts
 */
export const getAllPosts = async ({
    locals
}: {
    locals?: { auth?: LocalsAuth };
} = {}): Promise<PostType[]> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });
    const postService = new PostService({});

    try {
        // Get all posts with a large page size for static generation
        const { data } = await postService.list(actor, {
            page: 1,
            pageSize: 1000 // Large enough to get all posts
        });
        return data?.items ?? [];
    } catch (error) {
        console.error('Error fetching all posts:', error);
        return [];
    }
};
