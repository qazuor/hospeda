import {
    AddonVersionContentSchema,
    AdminAddonCatalogResponseSchema,
    CreateAddonRequestSchema,
    PermissionEnum
} from '@repo/schemas';
import { createAddon, createAddonVersion, readAdminAddonCatalog } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor.js';
import { AuditEventType, auditLog } from '../../../utils/audit-logger.js';
import { createRouter } from '../../../utils/create-app.js';
import { createAdminRoute } from '../../../utils/route-factory.js';
import { answerAddonCatalogRejection } from './rejections.js';

const versionSchema = z.object({
    id: z.uuid(),
    addonId: z.uuid(),
    validity: z.enum(['FIXED_DAYS', 'WHILE_SUBSCRIPTION_ALIVE']),
    validityDays: z.number().int().positive().nullable(),
    scopeType: z.enum(['LISTING', 'VERTICAL_SUBSCRIPTION', 'USER', 'GLOBAL'])
});
const addonSchema = z.object({
    id: z.uuid(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable()
});

/** Read the complete catalog for the action 20 editor. */
export const adminReadAddonCatalogRoute = createAdminRoute({
    method: 'get',
    path: '/',
    summary: 'Read the admin addon catalog',
    description: 'Reads addons, versions, products and live instance counts.',
    tags: ['Billing'],
    requiredPermissions: [PermissionEnum.BILLING_PUBLISH_ADDON_VERSION],
    responseSchema: AdminAddonCatalogResponseSchema,
    handler: async () => readAdminAddonCatalog()
});

/** Create an addon and its first immutable version. */
export const adminCreateAddonRoute = createAdminRoute({
    method: 'post',
    path: '/addons',
    summary: 'Create an addon with its first version',
    description: 'Creates an addon and its first immutable version in one transaction.',
    tags: ['Billing'],
    requiredPermissions: [PermissionEnum.BILLING_PUBLISH_ADDON_VERSION],
    requestBody: CreateAddonRequestSchema,
    responseSchema: z.object({ addon: addonSchema, version: versionSchema }),
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        try {
            const actor = getActorFromContext(ctx);
            const result = await createAddon({ actor, input: body });
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'create',
                resourceType: 'addon',
                resourceId: result.addon.id,
                metadata: { administrativeAction: 'ACC_20', versionId: result.version.id }
            });
            return result;
        } catch (error) {
            return answerAddonCatalogRejection({ error, ctx });
        }
    }
});

/** Append an immutable version to an existing addon. */
export const adminCreateAddonVersionRoute = createAdminRoute({
    method: 'post',
    path: '/addons/{addonId}/versions',
    summary: 'Create an addon version',
    description: 'Appends an immutable version to an existing addon.',
    tags: ['Billing'],
    requiredPermissions: [PermissionEnum.BILLING_PUBLISH_ADDON_VERSION],
    requestParams: { addonId: z.uuid() },
    requestBody: AddonVersionContentSchema,
    responseSchema: versionSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        try {
            const actor = getActorFromContext(ctx);
            const version = await createAddonVersion({
                actor,
                input: { ...body, addonId: params.addonId }
            });
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'create',
                resourceType: 'addon-version',
                resourceId: version.id,
                metadata: { administrativeAction: 'ACC_20', addonId: version.addonId }
            });
            return version;
        } catch (error) {
            return answerAddonCatalogRejection({ error, ctx });
        }
    }
});

const router = createRouter();
router.route('/', adminReadAddonCatalogRoute);
router.route('/', adminCreateAddonRoute);
router.route('/', adminCreateAddonVersionRoute);

export { router as adminAddonCatalogRoutes };
