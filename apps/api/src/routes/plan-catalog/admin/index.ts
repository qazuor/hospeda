import {
    CreatePlanRequestSchema,
    PermissionEnum,
    PLAN_ROLES,
    PlanPublicationConfirmationSchema,
    PreviewPlanVersionRequestSchema,
    PublishedPlanVersionSchema,
    PublishPlanVersionRequestSchema
} from '@repo/schemas';
import { createPlan, previewPlanVersion, publishPlanVersion } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor.js';
import { AuditEventType, auditLog } from '../../../utils/audit-logger.js';
import { createRouter } from '../../../utils/create-app.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

/**
 * Administrative action 18 — *publish a plan version* (HOS-1436, piece V2,
 * AC:V2:6/7). `SUPER_ADMIN` only (provisional `MAINTENANCE_MODE_WRITE`,
 * Coord-20). The preview writes nothing; publishing requires `confirmed: true`.
 */

const planSchema = z.object({
    id: z.string().uuid(),
    vertical: z.string(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    pricingOrder: z.number().int(),
    role: z.enum(PLAN_ROLES).nullable(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true })
});

const serializePlanVersion = (row: {
    id: string;
    planId: string;
    vertical: string;
    rank: number;
    sellable: boolean;
    current: boolean;
    graceDays: number;
    trialDays: number;
    allowsPause: boolean;
    inheritsTouristVip: boolean;
    createdAt: Date;
}) => ({ ...row, createdAt: row.createdAt.toISOString() });

/** Create a plan. `role` marks the three non-sellable plans; NULL is sellable. */
export const adminCreatePlanRoute = createAdminRoute({
    method: 'post',
    path: '/plans',
    summary: 'Create a plan',
    description: 'Creates a plan (action 18). `role` is accepted only here.',
    tags: ['Plan catalog'],
    requiredPermissions: [PermissionEnum.MAINTENANCE_MODE_WRITE],
    requestBody: CreatePlanRequestSchema,
    responseSchema: planSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const row = await createPlan({
            actor,
            data: CreatePlanRequestSchema.parse(body)
        });
        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'create',
            resourceType: 'plan',
            resourceId: row.id,
            metadata: { vertical: row.vertical, slug: row.slug, role: row.role }
        });
        return {
            ...row,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString()
        };
    }
});

/** Preview the key-by-key confirmation; writes nothing. */
export const adminPreviewPlanVersionRoute = createAdminRoute({
    method: 'post',
    path: '/plans/{planId}/versions/preview',
    summary: 'Preview a plan version publication',
    description: 'Shows what changes against the current version, key by key, and the reach.',
    tags: ['Plan catalog'],
    requiredPermissions: [PermissionEnum.MAINTENANCE_MODE_WRITE],
    requestParams: { planId: z.string().uuid() },
    requestBody: PreviewPlanVersionRequestSchema,
    responseSchema: PlanPublicationConfirmationSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: Record<string, unknown>) =>
        previewPlanVersion({
            actor: getActorFromContext(ctx),
            planId: String(params.planId),
            content: PreviewPlanVersionRequestSchema.parse(body)
        })
});

/** Publish a version, after explicit confirmation, and audit the action. */
export const adminPublishPlanVersionRoute = createAdminRoute({
    method: 'post',
    path: '/plans/{planId}/versions',
    summary: 'Publish a plan version',
    description: 'Publishes an immutable version of a plan after explicit confirmation.',
    tags: ['Plan catalog'],
    requiredPermissions: [PermissionEnum.MAINTENANCE_MODE_WRITE],
    requestParams: { planId: z.string().uuid() },
    requestBody: PublishPlanVersionRequestSchema,
    responseSchema: PublishedPlanVersionSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const parsed = PublishPlanVersionRequestSchema.parse(body);
        const row = await publishPlanVersion({
            actor,
            planId: String(params.planId),
            content: parsed
        });
        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'create',
            resourceType: 'plan-version',
            resourceId: row.id,
            metadata: {
                planId: row.planId,
                vertical: row.vertical,
                rank: row.rank,
                sellable: row.sellable,
                trialDays: row.trialDays,
                graceDays: row.graceDays
            }
        });
        return serializePlanVersion(row);
    }
});

const router = createRouter();
router.route('/', adminCreatePlanRoute);
router.route('/', adminPreviewPlanVersionRoute);
router.route('/', adminPublishPlanVersionRoute);

export { router as adminPlanCatalogRoutes };
