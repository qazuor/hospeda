import { CreateAddonProductRequestSchema, PermissionEnum } from '@repo/schemas';
import { createAddonProduct } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor.js';
import { AuditEventType, auditLog } from '../../../utils/audit-logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';
import { buildAddonVersionPublicationPorts } from './ports.js';
import { answerAddonVersionPublicationRejection } from './rejections.js';

/** Create the saleable product for an addon under administrative action 20. */
export const adminCreateAddonProductRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create an addon product',
    description: 'Creates the saleable product for an addon version.',
    tags: ['Billing'],
    requiredPermissions: [PermissionEnum.BILLING_PUBLISH_ADDON_VERSION],
    requestBody: CreateAddonProductRequestSchema,
    responseSchema: z.object({
        id: z.uuid(),
        addonId: z.uuid(),
        versionId: z.uuid(),
        price: z.number().int().positive(),
        currency: z.literal('ARS'),
        chargeKind: z.enum(['UNA_VEZ', 'PERIODICO']),
        cycle: z.enum(['monthly', 'quarterly', 'semiannual', 'annual']).nullable(),
        compatibleVerticals: CreateAddonProductRequestSchema.shape.compatibleVerticals
    }),
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        try {
            const actor = getActorFromContext(ctx);
            const product = await createAddonProduct(
                { actor, input: body },
                buildAddonVersionPublicationPorts()
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'create',
                resourceType: 'addon-product',
                resourceId: product.id,
                metadata: {
                    administrativeAction: 'ACC_20',
                    addonId: product.addonId,
                    versionId: product.versionId,
                    price: product.price
                }
            });
            return product;
        } catch (error) {
            return answerAddonVersionPublicationRejection({ error, ctx });
        }
    }
});
