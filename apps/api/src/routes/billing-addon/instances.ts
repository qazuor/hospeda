import { OwnerRecurringAddonsQuerySchema, OwnerRecurringAddonsResponseSchema } from '@repo/schemas';
import { readOwnerRecurringAddons } from '../../services/billing-addon/owner-recurring-addons.service';
import { getActorFromContext, isGuestActor } from '../../utils/actor';
import { createErrorResponse } from '../../utils/response-helpers';
import { createProtectedRoute } from '../../utils/route-factory';

/** List the signed-in owner's live recurring addons. */
export const protectedOwnerRecurringAddonsRoute = createProtectedRoute({
    method: 'get',
    path: '/instances',
    summary: 'List own recurring addons',
    description: 'Returns live recurring addon instances owned by the actor.',
    tags: ['Billing addons'],
    requestQuery: OwnerRecurringAddonsQuerySchema.shape,
    responseSchema: OwnerRecurringAddonsResponseSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        if (isGuestActor(actor))
            return createErrorResponse(
                { code: 'UNAUTHORIZED', message: 'Authentication required' },
                ctx,
                401
            );
        const { listingId } = OwnerRecurringAddonsQuerySchema.parse(query);
        return readOwnerRecurringAddons({ userId: actor.id, listingId });
    }
});
