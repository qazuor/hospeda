import {
    ProtectedEffectiveSetQuerySchema,
    ProtectedEffectiveSetResponseSchema,
    type VerticalEnum
} from '@repo/schemas';
import { encodeFiniteOrInfinite } from '@repo/verticals';
import { getActorFromContext } from '../../../utils/actor';
import { toEffectiveSetView } from '../../../utils/listing-access/effective-set-view';
import { getListingAccessPorts } from '../../../utils/listing-access/ports';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/protected/users/me/effective-set
 *
 * The session user's effective set for one vertical. A pre-trial owner (no live
 * non-trial title, no trial yet) also gets `preTrialDraftLimits`: the photo caps
 * their DRAFT listings accept, the same values step 7 enforces (HOS-1721), so
 * the editor can show and enforce the cap instead of waiting forever on a `0`.
 */
export const protectedGetMyEffectiveSetRoute = createProtectedRoute({
    method: 'get',
    path: '/me/effective-set',
    summary: 'Get own effective set',
    description:
        'Reads V3 effective entitlements and limits for the authenticated user and vertical.',
    tags: ['Users'],
    emailUnverifiedOperation: 'READ_OWN',
    requestQuery: ProtectedEffectiveSetQuerySchema.shape,
    responseSchema: ProtectedEffectiveSetResponseSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const userId = actor.id;
        const vertical = query?.vertical as VerticalEnum;
        const ports = getListingAccessPorts();
        const effective = await ports.effectiveSet({ userId, vertical });
        const view = toEffectiveSetView({ effective, userId, vertical });
        if (effective.hasLiveNonTrialTitle) return view;
        const draftLimits = await ports.preTrialDraftLimits({ userId, vertical });
        if (draftLimits.size === 0) return view;
        return {
            ...view,
            preTrialDraftLimits: Object.fromEntries(
                [...draftLimits].map(([key, value]) => [key, encodeFiniteOrInfinite(value)])
            )
        };
    }
});
