/**
 * Create user bookmark collection route.
 * Creates a new named bookmark collection for the authenticated user.
 * The userId is resolved from the authenticated session, not from the request body.
 * @route POST /api/v1/protected/user-bookmark-collections
 */

import {
    ServiceErrorCode,
    type UserBookmarkCollectionCreateInput,
    UserBookmarkCollectionCreateInputSchema,
    UserBookmarkCollectionSchema,
    VerticalEnum
} from '@repo/schemas';
import { ServiceError, UserBookmarkCollectionService } from '@repo/service-core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getActorFromContext } from '../../../utils/actor';
import { enforceUserGate, readEffectiveLimit } from '../../../utils/listing-access/user-gate';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const collectionService = new UserBookmarkCollectionService({ logger: apiLogger });

/**
 * Request body schema for creating a bookmark collection.
 * Omits userId because it is resolved server-side from the authenticated actor.
 */
const CreateCollectionRequestSchema = UserBookmarkCollectionCreateInputSchema.omit({
    userId: true
});

export const createUserBookmarkCollectionRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Create user bookmark collection',
    description:
        'Creates a new named bookmark collection for the authenticated user. The userId is derived from the session.',
    tags: ['User Bookmark Collections'],
    requestBody: CreateCollectionRequestSchema,
    responseSchema: UserBookmarkCollectionSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const input = body as Omit<UserBookmarkCollectionCreateInput, 'userId'>;
        await enforceUserGate({
            userId: actor.id,
            vertical: VerticalEnum.TOURIST,
            keys: ['can_use_collections'],
            limit: async () => {
                const countResult = await collectionService
                    .countActiveCollections(actor)
                    .catch(() => {
                        throw new ServiceError(
                            ServiceErrorCode.SERVICE_UNAVAILABLE,
                            'Usage count unavailable'
                        );
                    });
                if (countResult.error || !countResult.data) {
                    throw new ServiceError(
                        ServiceErrorCode.SERVICE_UNAVAILABLE,
                        'Usage count unavailable'
                    );
                }
                return { key: 'max_collections', requested: countResult.data.count + 1 };
            }
        });
        const planLimit = await readEffectiveLimit({
            userId: actor.id,
            vertical: VerticalEnum.TOURIST,
            key: 'max_collections'
        });

        const result = await collectionService.createCollection(
            actor,
            {
                ...input,
                userId: actor.id
            },
            { hookState: { planLimit } }
        );

        if (result.error) {
            const { code, message, details } = result.error;

            // Preserve the service quota details in the standard plan-limit response.
            if (code === ServiceErrorCode.QUOTA_EXCEEDED) {
                const currentCount =
                    typeof details === 'object' &&
                    details !== null &&
                    'currentCount' in details &&
                    typeof details.currentCount === 'number'
                        ? details.currentCount
                        : 0;
                const maxAllowed =
                    typeof details === 'object' &&
                    details !== null &&
                    'maxAllowed' in details &&
                    typeof details.maxAllowed === 'number'
                        ? details.maxAllowed
                        : planLimit;
                throw new ServiceError(ServiceErrorCode.LIMIT_REACHED, 'Limit reached', {
                    limitKey: 'max_collections',
                    currentCount,
                    maxAllowed
                });
            }

            // ALREADY_EXISTS (NAME_TAKEN reason) maps to 409 Conflict
            if (code === ServiceErrorCode.ALREADY_EXISTS) {
                throw new HTTPException(409, { message });
            }

            throw new ServiceError(code, message, result.error.details);
        }

        return result.data;
    }
});
