import type { LifecycleStatusEnum, ModerationStatusEnum, VisibilityEnum } from '@repo/schemas';
import {
    type useQueryClient as UseQueryClient,
    useMutation,
    useQueryClient
} from '@tanstack/react-query';

import { fetchApi } from '@/lib/api/client';
import { adminLogger } from '@/utils/logger';

/**
 * Mutation hooks for the three dedicated content state transitions
 * (HOS-374 §7.6.4).
 *
 * `moderationState`, `visibility` and `lifecycleState` used to travel inside the
 * generic `PATCH /api/v1/admin/{entity}/:id`. They now each have their own
 * endpoint, gated by its own permission, because while they shared the update
 * payload every publication and moderation gate was bypassable by anyone
 * holding plain `POST_UPDATE`/`EVENT_UPDATE`.
 *
 * Each hook is shaped to satisfy `InlineUpdateMutationLike`, so the existing
 * `InlineStateSelectCell` drives them unchanged: the cell already calls
 * `mutateAsync({ [field]: value })`, and the endpoint bodies are named after
 * the same columns.
 */

/** Entity segment of the admin API path. */
export type ContentStateEntity = 'posts' | 'events';

/** Query keys the mutations invalidate on success. */
export interface ContentStateQueryKeys {
    readonly detail: (id: string) => readonly unknown[];
    readonly lists: () => readonly unknown[];
}

interface ContentStateMutationConfig {
    readonly entity: ContentStateEntity;
    readonly queryKeys: ContentStateQueryKeys;
}

// Declared as type aliases, not interfaces, on purpose: `InlineStateSelectCell`
// is generic over `TPatch extends Record<string, unknown>`, and an interface has
// no implicit index signature, so it would not satisfy that bound.

/** Body of the moderation endpoint. */
export type ModerationStatePatch = { moderationState: ModerationStatusEnum };

/** Body of the publish-state endpoint. */
export type PublishStatePatch = { visibility: VisibilityEnum };

/** Body of the lifecycle-state endpoint. */
export type LifecycleStatePatch = { lifecycleState: LifecycleStatusEnum };

type QueryClient = ReturnType<typeof UseQueryClient>;

/**
 * Issues one state transition and refreshes the entity's cached detail + lists.
 */
const postStateTransition = async <TBody extends Record<string, unknown>>(input: {
    readonly entity: ContentStateEntity;
    readonly id: string;
    readonly action: 'moderate' | 'publish-state' | 'lifecycle-state';
    readonly body: TBody;
}): Promise<unknown> => {
    const { entity, id, action, body } = input;
    const result = await fetchApi<{ success: boolean; data: unknown }>({
        path: `/api/v1/admin/${entity}/${id}/${action}`,
        method: 'POST',
        body
    });
    return result.data.data;
};

const invalidate = (input: {
    readonly queryClient: QueryClient;
    readonly queryKeys: ContentStateQueryKeys;
    readonly id: string;
}): void => {
    const { queryClient, queryKeys, id } = input;
    queryClient.invalidateQueries({ queryKey: queryKeys.detail(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
};

/**
 * Builds the three state-transition mutation hooks for one content entity.
 *
 * @param config - The admin API entity segment and its query keys.
 * @returns One hook per transition, each taking the entity id.
 */
export const createContentStateMutationHooks = ({
    entity,
    queryKeys
}: ContentStateMutationConfig) => {
    const useModerateMutation = (id: string) => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: (body: ModerationStatePatch) =>
                postStateTransition({ entity, id, action: 'moderate', body }),
            onSuccess: () => invalidate({ queryClient, queryKeys, id }),
            onError: (error) =>
                adminLogger.error('[ContentState] Failed to moderate', { entity, id, error })
        });
    };

    const useSetPublishStateMutation = (id: string) => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: (body: PublishStatePatch) =>
                postStateTransition({ entity, id, action: 'publish-state', body }),
            onSuccess: () => invalidate({ queryClient, queryKeys, id }),
            onError: (error) =>
                adminLogger.error('[ContentState] Failed to set publish state', {
                    entity,
                    id,
                    error
                })
        });
    };

    const useSetLifecycleStateMutation = (id: string) => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: (body: LifecycleStatePatch) =>
                postStateTransition({ entity, id, action: 'lifecycle-state', body }),
            onSuccess: () => invalidate({ queryClient, queryKeys, id }),
            onError: (error) =>
                adminLogger.error('[ContentState] Failed to set lifecycle state', {
                    entity,
                    id,
                    error
                })
        });
    };

    return { useModerateMutation, useSetPublishStateMutation, useSetLifecycleStateMutation };
};
