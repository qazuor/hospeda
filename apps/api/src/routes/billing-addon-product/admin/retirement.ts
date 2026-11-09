import { PermissionEnum } from '@repo/schemas';
import {
    readAddonProductRetirement,
    retireAddonProduct,
    unretireAddonProduct
} from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor.js';
import { AuditEventType, auditLog } from '../../../utils/audit-logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';
import { answerAddonVersionPublicationRejection } from './rejections.js';

const requestParams = { productId: z.uuid() };
const responseSchema = z.strictObject({
    productId: z.uuid(),
    retiredAt: z.iso.datetime().nullable()
});

function answer(input: { readonly productId: string; readonly retiredAt: Date | null }) {
    return {
        productId: input.productId,
        retiredAt: input.retiredAt?.toISOString() ?? null
    };
}

/** Read whether an addon product is currently for sale. */
export const adminReadAddonProductRetirementRoute = createAdminRoute({
    method: 'get',
    path: '/{productId}/retirement',
    summary: 'Read addon product saleability',
    description: 'Reads the retirement timestamp of an addon product.',
    tags: ['Billing'],
    requiredPermissions: [PermissionEnum.BILLING_PUBLISH_ADDON_VERSION],
    requestParams,
    responseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        try {
            return answer(
                await readAddonProductRetirement({
                    actor: getActorFromContext(ctx),
                    productId: z.uuid().parse(params.productId)
                })
            );
        } catch (error) {
            return answerAddonVersionPublicationRejection({ error, ctx });
        }
    }
});

function retirementRoute(input: { readonly method: 'post' | 'delete'; readonly retire: boolean }) {
    return createAdminRoute({
        method: input.method,
        path: '/{productId}/retirement',
        successStatusCode: 200,
        summary: input.retire ? 'Retire addon product' : 'Restore addon product saleability',
        description: 'Changes future saleability while preserving existing purchases.',
        tags: ['Billing'],
        requiredPermissions: [PermissionEnum.BILLING_PUBLISH_ADDON_VERSION],
        requestParams,
        responseSchema,
        handler: async (ctx: Context, params: Record<string, unknown>) => {
            try {
                const actor = getActorFromContext(ctx);
                const productId = z.uuid().parse(params.productId);
                const state = input.retire
                    ? await retireAddonProduct({ actor, productId })
                    : await unretireAddonProduct({ actor, productId });
                auditLog({
                    auditEvent: AuditEventType.BILLING_MUTATION,
                    actorId: actor.id,
                    action: 'update',
                    resourceType: 'addon-product',
                    resourceId: productId,
                    metadata: {
                        administrativeAction: 'ACC_20',
                        retiredAt: state.retiredAt?.toISOString() ?? null
                    }
                });
                return answer(state);
            } catch (error) {
                return answerAddonVersionPublicationRejection({ error, ctx });
            }
        }
    });
}

/** Stop future sales under action 20. */
export const adminRetireAddonProductRoute = retirementRoute({ method: 'post', retire: true });
/** Resume future sales under action 20. */
export const adminUnretireAddonProductRoute = retirementRoute({ method: 'delete', retire: false });
