import {
    ProtectedEffectiveSetQuerySchema,
    ProtectedEffectiveSetResponseSchema,
    type VerticalEnum
} from '@repo/schemas';
import { encodeFiniteOrInfinite, PRE_TRIAL_DRAFT_LIMIT_KEYS_BY_VERTICAL } from '@repo/verticals';
import { getActorFromContext } from '../../../utils/actor';
import { toEffectiveSetView } from '../../../utils/listing-access/effective-set-view';
import { getListingAccessPorts } from '../../../utils/listing-access/ports';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/protected/users/me/effective-set
 *
 * The session user's effective set for one vertical. A pre-trial owner (no live
 * non-trial title, no trial yet) also gets `preTrialDraftLimits`: the photo caps
 * their DRAFT listings accept, the same values step 7 enforces (HOS-1721), so
 * the editor can show and enforce the cap instead of waiting forever on a `0`.
 *
 * The draft cap is an enrichment: it is only looked up when the effective set
 * carries none of the vertical's draft keys (an active trial already does), and
 * a failure to resolve it is logged and answered without the field, never as a
 * 500 that would blank every capability on the web. Step 7 stays fail-closed.
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
        const draftKeys = PRE_TRIAL_DRAFT_LIMIT_KEYS_BY_VERTICAL[vertical] ?? [];
        if (draftKeys.length === 0 || draftKeys.every((key) => key in view.limits)) return view;
        let draftLimits: ReadonlyMap<string, number>;
        try {
            draftLimits = await ports.preTrialDraftLimits({ userId, vertical });
        } catch (error) {
            apiLogger.warn(
                {
                    vertical,
                    error: error instanceof Error ? error.name : 'UnknownError'
                },
                'Pre-trial draft limits unresolved; effective set served without them'
            );
            return view;
        }
        if (draftLimits.size === 0) return view;
        return {
            ...view,
            preTrialDraftLimits: Object.fromEntries(
                [...draftLimits].map(([key, value]) => [key, encodeFiniteOrInfinite(value)])
            )
        };
    }
});
