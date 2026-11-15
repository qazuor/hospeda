import { AddonFreeChoiceRequestSchema, AddonFreeChoiceResponseSchema } from '@repo/schemas';
import { type ChooseFreeAddonRefusalReason, chooseFreeAddon } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { createErrorResponse } from '../../utils/response-helpers';
import { createProtectedRoute } from '../../utils/route-factory';
import { buildAddonPurchasePorts } from './purchase-ports';
import { readAddonPurchaseCopy } from './purchase-rejections';

const refusals: Readonly<
    Record<
        ChooseFreeAddonRefusalReason,
        {
            readonly status: 404 | 409;
            readonly code: string;
            readonly copy: Parameters<typeof readAddonPurchaseCopy>[1];
        }
    >
> = {
    PRODUCT_NOT_FOUND: {
        status: 404,
        code: 'ADDON_PRODUCT_NOT_FOUND',
        copy: 'freeProductNotFound'
    },
    TARGET_NOT_FOUND: { status: 404, code: 'ADDON_TARGET_NOT_FOUND', copy: 'freeTargetNotFound' },
    NO_FREE_TITLE: { status: 409, code: 'ADDON_NO_FREE_TITLE', copy: 'freeNoTitle' },
    ADDON_VERSION_NOT_CURRENT: {
        status: 409,
        code: 'ADDON_VERSION_NOT_CURRENT',
        copy: 'freeVersionChanged'
    },
    ALREADY_ACTIVE: { status: 409, code: 'ADDON_ALREADY_ACTIVE', copy: 'freeAlreadyActive' },
    PENDING_ELSEWHERE: {
        status: 409,
        code: 'ADDON_PENDING_ELSEWHERE',
        copy: 'freePendingElsewhere'
    },
    ORDER_REQUEST_REUSED: {
        status: 409,
        code: 'ADDON_ORDER_REQUEST_REUSED',
        copy: 'freeOrderRequestReused'
    }
};

/** Choose one free addon under the actor's permanent grant. */
export const protectedAddonFreeChoiceRoute = createProtectedRoute({
    method: 'post',
    path: '/free-choices',
    summary: 'Choose a free addon',
    description: 'Creates or replays one free addon choice under a live grant anchor.',
    tags: ['Billing addons'],
    requestBody: AddonFreeChoiceRequestSchema,
    responseSchema: AddonFreeChoiceResponseSchema,
    successStatusCode: (result) =>
        AddonFreeChoiceResponseSchema.parse(result).outcome === 'CREATED' ? 201 : 200,
    handler: async (ctx, _params, body) => {
        const actor = getActorFromContext(ctx);
        const parsed = AddonFreeChoiceRequestSchema.parse(body);
        const { clock, addonPolicy, listing, coverageNotices } = buildAddonPurchasePorts();
        const result = await chooseFreeAddon(
            {
                ownerId: actor.id,
                productId: parsed.productId,
                targetId: parsed.targetId,
                orderRequestId: parsed.orderRequestId,
                expectedAddonVersionId: parsed.addonVersionId
            },
            { clock, addonPolicy, listing, coverageNotices }
        );
        if (result.outcome !== 'REFUSED') return result;
        const answer = refusals[result.reason];
        return createErrorResponse(
            {
                code: answer.code,
                message: readAddonPurchaseCopy(ctx, answer.copy),
                reason: result.reason
            },
            ctx,
            answer.status
        );
    }
});
