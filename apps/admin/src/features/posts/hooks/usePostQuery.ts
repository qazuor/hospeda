import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminLogger } from '@/utils/logger';

/**
 * Query keys for post operations
 */
export const postQueryKeys = {
    all: ['posts'] as const,
    lists: () => [...postQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...postQueryKeys.lists(), { filters }] as const,
    details: () => [...postQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...postQueryKeys.details(), id] as const
};

// Mock API functions - Replace with actual API calls
const mockFetchPost = async (id: string) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
        id,
        title: `Post ${id}`,
        slug: `post-${id}`,
        summary: 'Resumen del artículo',
        content: 'Contenido completo del artículo...',
        category: 'TOURISM',
        isFeatured: false,
        isFeaturedInWebsite: false,
        isNews: false,
        authorId: 'author-1',
        likes: 0,
        comments: 0,
        shares: 0,
        readingTimeMinutes: 5,
        visibility: 'PUBLIC',
        lifecycleState: 'ACTIVE',
        moderationState: 'APPROVED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
};

const mockUpdatePost = async (id: string, data: Record<string, unknown>) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { id, ...data };
};

const mockCreatePost = async (data: Record<string, unknown>) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const id = crypto.randomUUID();
    return { id, ...data };
};

const mockDeletePost = async (id: string) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { id, deleted: true };
};

/**
 * Hook to fetch a single post by ID
 */
export const usePostQuery = (id: string, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: postQueryKeys.detail(id),
        queryFn: () => mockFetchPost(id),
        enabled: options?.enabled !== false && !!id,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000 // 10 minutes (formerly cacheTime)
    });
};

/**
 * Hook to update a post
 */
export const useUpdatePostMutation = (id: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => mockUpdatePost(id, data),
        onSuccess: (data) => {
            adminLogger.debug('[PostMutation] Post updated successfully', { id, data });

            // Invalidate and refetch
            queryClient.invalidateQueries({ queryKey: postQueryKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: postQueryKeys.lists() });
        },
        onError: (error) => {
            adminLogger.error('[PostMutation] Failed to update post', { id, error });
        }
    });
};

/**
 * Hook to create a new post
 */
export const useCreatePostMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => mockCreatePost(data),
        onSuccess: (data) => {
            adminLogger.debug('[PostMutation] Post created successfully', data);

            // Invalidate list to show new post
            queryClient.invalidateQueries({ queryKey: postQueryKeys.lists() });
        },
        onError: (error) => {
            adminLogger.error('[PostMutation] Failed to create post', error);
        }
    });
};

/**
 * Hook to delete a post
 */
export const useDeletePostMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => mockDeletePost(id),
        onSuccess: (_data, id) => {
            adminLogger.debug('[PostMutation] Post deleted successfully', { id });

            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: postQueryKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: postQueryKeys.lists() });
        },
        onError: (error, id) => {
            adminLogger.error('[PostMutation] Failed to delete post', { id, error });
        }
    });
};
