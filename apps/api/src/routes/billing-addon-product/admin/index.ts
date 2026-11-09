import { randomUUID } from 'node:crypto';
import {
    AddonVersionPublicationConfirmationSchema,
    AddonVersionPublicationPreviewRequestSchema,
    AddonVersionPublishedResponseSchema,
    PermissionEnum,
    PublishAddonVersionRequestSchema
} from '@repo/schemas';
import { previewAddonVersionPublication, publishAddonVersion } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getRequestCorrelationId } from '../../../lib/request-context.js';
import { getActorFromContext } from '../../../utils/actor.js';
import { AuditEventType, auditLog } from '../../../utils/audit-logger.js';
import { createRouter } from '../../../utils/create-app.js';
import { createAdminRoute } from '../../../utils/route-factory.js';
import { buildAddonVersionPublicationPorts } from './ports.js';
import { adminCreateAddonProductRoute } from './product-creation.js';
import { answerAddonVersionPublicationRejection } from './rejections.js';
import {
    adminReadAddonProductRetirementRoute,
    adminRetireAddonProductRoute,
    adminUnretireAddonProductRoute
} from './retirement.js';

const requestParams = { productId: z.uuid() };

/** Preview the action 20 version and price change before confirmation. */
export const adminPreviewAddonVersionPublicationRoute = createAdminRoute({
    method: 'post',
    path: '/{productId}/version-publication/preview',
    successStatusCode: 200,
    summary: 'Preview an addon version publication',
    description: 'Shows the current and proposed policy and price for one addon product.',
    tags: ['Billing'],
    requiredPermissions: [PermissionEnum.BILLING_PUBLISH_ADDON_VERSION],
    requestParams,
    requestBody: AddonVersionPublicationPreviewRequestSchema,
    responseSchema: AddonVersionPublicationConfirmationSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        try {
            return await previewAddonVersionPublication(
                {
                    actor: getActorFromContext(ctx),
                    input: { ...body, productId: params.productId }
                },
                buildAddonVersionPublicationPorts()
            );
        } catch (error) {
            return answerAddonVersionPublicationRejection({ error, ctx });
        }
    }
});

/** Publish the addon version, then record the administrative mutation audit. */
export const adminPublishAddonVersionRoute = createAdminRoute({
    method: 'post',
    path: '/{productId}/version-publication',
    successStatusCode: 200,
    summary: 'Publish an addon version',
    description: 'Atomically points one addon product at a validated version and price.',
    tags: ['Billing'],
    requiredPermissions: [PermissionEnum.BILLING_PUBLISH_ADDON_VERSION],
    requestParams,
    requestBody: PublishAddonVersionRequestSchema,
    responseSchema: AddonVersionPublishedResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        try {
            const actor = getActorFromContext(ctx);
            const input = PublishAddonVersionRequestSchema.parse(body);
            const result = await publishAddonVersion(
                {
                    actor,
                    input: { ...input, productId: params.productId },
                    correlationId: getRequestCorrelationId() ?? randomUUID()
                },
                buildAddonVersionPublicationPorts()
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'addon-product',
                resourceId: result.product.id,
                metadata: {
                    administrativeAction: 'ACC_20',
                    previousVersionId: input.expectedCurrentVersionId,
                    newVersionId: result.product.versionId,
                    previousPrice: input.expectedCurrentPrice,
                    newPrice: result.product.price,
                    currency: 'ARS'
                }
            });
            return result;
        } catch (error) {
            return answerAddonVersionPublicationRejection({ error, ctx });
        }
    }
});

const router = createRouter();
router.route('/', adminCreateAddonProductRoute);
router.route('/', adminPreviewAddonVersionPublicationRoute);
router.route('/', adminPublishAddonVersionRoute);
router.route('/', adminReadAddonProductRetirementRoute);
router.route('/', adminRetireAddonProductRoute);
router.route('/', adminUnretireAddonProductRoute);

export { router as adminBillingAddonProductRoutes };
