import { ChangeVerticalDeadlineSchema, PermissionEnum } from '@repo/schemas';
import {
    changeVerticalDeadline,
    getCurrentVerticalDeadlines,
    getVerticalDeadlinesVersion,
    previewVerticalDeadlineChange
} from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor.js';
import { AuditEventType, auditLog } from '../../../utils/audit-logger.js';
import { createRouter } from '../../../utils/create-app.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

const versionSchema = z.object({
    version: z.number().int(),
    values: z.record(z.string(), z.unknown()),
    changedKey: z.number().int().nullable(),
    previousValue: z.unknown().nullable(),
    newValue: z.unknown().nullable(),
    changedBy: z.string().uuid().nullable(),
    createdAt: z.string().datetime({ offset: true })
});

/** Read the latest version used by clocks starting now. */
export const adminGetVerticalDeadlinesRoute = createAdminRoute({
    method: 'get',
    path: '/',
    summary: 'Get current vertical deadlines',
    description: 'Returns the version used by new vertical clocks.',
    tags: ['Verticals'],
    requiredPermissions: [PermissionEnum.MAINTENANCE_MODE_WRITE],
    responseSchema: versionSchema,
    handler: async () => serialize(await getCurrentVerticalDeadlines())
});

/** Read the immutable version kept by an already started clock. */
export const adminGetVerticalDeadlineVersionRoute = createAdminRoute({
    method: 'get',
    path: '/{version}',
    summary: 'Get vertical deadlines version',
    description: 'Returns the immutable version stored by a started vertical clock.',
    tags: ['Verticals'],
    requiredPermissions: [PermissionEnum.MAINTENANCE_MODE_WRITE],
    requestParams: { version: z.coerce.number().int().positive() },
    responseSchema: versionSchema,
    handler: async (_ctx: Context, params: Record<string, unknown>) =>
        serialize(await getVerticalDeadlinesVersion({ version: Number(params.version) }))
});

const previewSchema = z.object({ key: ChangeVerticalDeadlineSchema.shape.key, value: z.unknown() });

/** Preview the old and new values and the rule protecting existing clocks. */
export const adminPreviewVerticalDeadlineRoute = createAdminRoute({
    method: 'post',
    path: '/preview',
    summary: 'Preview vertical deadline change',
    description: 'Shows the current and proposed values before confirmation.',
    tags: ['Verticals'],
    requiredPermissions: [PermissionEnum.MAINTENANCE_MODE_WRITE],
    requestBody: previewSchema,
    responseSchema: z.object({
        key: z.number(),
        currentVersion: z.number(),
        currentValue: z.unknown(),
        newValue: z.unknown(),
        message: z.string()
    }),
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) =>
        previewVerticalDeadlineChange({
            actor: getActorFromContext(ctx),
            key: Number(body.key),
            value: body.value
        })
});

/** Publish a confirmed change and audit the administrative action. */
export const adminChangeVerticalDeadlineRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Change vertical deadline',
    description: 'Publishes a new immutable version after explicit confirmation.',
    tags: ['Verticals'],
    requiredPermissions: [PermissionEnum.MAINTENANCE_MODE_WRITE],
    requestBody: ChangeVerticalDeadlineSchema,
    responseSchema: versionSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const row = await changeVerticalDeadline({
            actor,
            ...ChangeVerticalDeadlineSchema.parse(body)
        });
        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'create',
            resourceType: 'vertical-deadline-version',
            resourceId: String(row.version),
            metadata: {
                key: row.changedKey,
                previousValue: row.previousValue,
                newValue: row.newValue
            }
        });
        return serialize(row);
    }
});

function serialize(row: Awaited<ReturnType<typeof getCurrentVerticalDeadlines>>) {
    return { ...row, createdAt: row.createdAt.toISOString() };
}

const router = createRouter();
router.route('/', adminGetVerticalDeadlinesRoute);
router.route('/', adminGetVerticalDeadlineVersionRoute);
router.route('/', adminPreviewVerticalDeadlineRoute);
router.route('/', adminChangeVerticalDeadlineRoute);

export { router as adminVerticalDeadlineRoutes };
