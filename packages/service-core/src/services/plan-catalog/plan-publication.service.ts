import {
    and,
    eq,
    getDb,
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions
} from '@repo/db';
import {
    type CreatePlanRequest,
    PermissionEnum,
    PLAN_ROLES,
    type PlanPublicationConfirmation,
    type PlanVersionContentInput,
    ServiceErrorCode
} from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { buildConfirmation } from './plan-publication.confirmation.js';
import { buildPublicationContext } from './plan-publication.reader.js';
import {
    type CountAnchoredCustomersPort,
    type PlanVersionRow,
    zeroAnchoredCustomers
} from './plan-publication.types.js';
import { validatePublication } from './plan-publication.validation.js';

/**
 * Action 18 — *publish a plan version* (HOS-1436, piece V2, AC:V2:6 and
 * AC:V2:7). Creates a plan, publishes a version (which is how a plan is
 * retired — publishing a non-sellable version — and how a retire is undone),
 * previews the key-by-key confirmation and applies the G-R3 validation the
 * action used to be a CI guard for.
 *
 * The whole action is `SUPER_ADMIN` only. The permission is
 * `MAINTENANCE_MODE_WRITE` (provisional, Coord-20): no new permission is
 * created. The reads, the validation and the confirmation live in sibling
 * modules; this file is the public surface.
 */

export { CYCLE_MINIMUM_DAYS, PLAN_PUBLICATION_REJECTIONS } from './plan-publication.rejections.js';
export type { CountAnchoredCustomersPort } from './plan-publication.types.js';
export { zeroAnchoredCustomers } from './plan-publication.types.js';

/** Rejects every caller without the super-admin write permission. */
function requirePlanPublisher(actor: Actor): void {
    if (!actor.permissions.includes(PermissionEnum.MAINTENANCE_MODE_WRITE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Sólo SUPER_ADMIN puede publicar versiones de plan'
        );
    }
}

/** Creates a plan (action 18). `role` is accepted only here and never updated. */
export async function createPlan(input: {
    actor: Actor;
    data: CreatePlanRequest;
}): Promise<typeof plans.$inferSelect> {
    requirePlanPublisher(input.actor);
    if (input.data.role != null && !PLAN_ROLES.includes(input.data.role)) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Rol de plan inválido');
    }
    const [row] = await getDb()
        .insert(plans)
        .values({
            vertical: input.data.vertical,
            slug: input.data.slug,
            name: input.data.name,
            description: input.data.description ?? null,
            pricingOrder: input.data.pricingOrder ?? 0,
            role: input.data.role ?? null
        })
        .returning();
    if (!row) throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'No se creó el plan');
    return row;
}

/** Builds the confirmation of publishing a version; writes nothing. */
export async function previewPlanVersion(input: {
    actor: Actor;
    planId: string;
    content: PlanVersionContentInput;
    countAnchoredCustomers?: CountAnchoredCustomersPort;
}): Promise<PlanPublicationConfirmation> {
    requirePlanPublisher(input.actor);
    const client = getDb();
    const context = await buildPublicationContext({
        client,
        planId: input.planId,
        content: input.content
    });
    validatePublication({ context });
    return buildConfirmation({
        client,
        context,
        countAnchoredCustomers: input.countAnchoredCustomers ?? zeroAnchoredCustomers
    });
}

/**
 * Publishes a version of a plan. Retiring a plan and undoing a retire are both
 * this action: the retire publishes a non-sellable version, the undo publishes
 * a sellable one. Previous current version is flipped off, the new version and
 * its effects are written in the SAME transaction (extras 041 requires it).
 */
export async function publishPlanVersion(input: {
    actor: Actor;
    planId: string;
    content: PlanVersionContentInput;
    countAnchoredCustomers?: CountAnchoredCustomersPort;
}): Promise<PlanVersionRow> {
    requirePlanPublisher(input.actor);
    return getDb().transaction(async (tx) => {
        const context = await buildPublicationContext({
            client: tx,
            planId: input.planId,
            content: input.content
        });
        validatePublication({ context });
        await tx
            .update(planVersions)
            .set({ current: false })
            .where(and(eq(planVersions.planId, context.planId), eq(planVersions.current, true)));
        const [published] = await tx
            .insert(planVersions)
            .values({
                planId: context.planId,
                vertical: context.vertical,
                rank: context.content.rank,
                sellable: context.content.sellable,
                current: true,
                graceDays: context.content.graceDays,
                trialDays: context.content.trialDays,
                allowsPause: context.content.allowsPause,
                inheritsTouristVip: context.content.inheritsTouristVip
            })
            .returning();
        if (!published) {
            throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'No se publicó la versión');
        }
        if (context.content.entitlements.length > 0) {
            await tx.insert(planVersionEntitlements).values(
                context.content.entitlements.map((item) => {
                    const planQuota = item.planQuota ?? null;
                    const trialQuota = item.trialQuota ?? null;
                    if ((planQuota == null) !== (trialQuota == null)) {
                        throw new ServiceError(
                            ServiceErrorCode.VALIDATION_ERROR,
                            'Un entitlement medido lleva sus dos cuotas o ninguna'
                        );
                    }
                    return {
                        planVersionId: published.id,
                        key: item.key,
                        planQuota,
                        trialQuota
                    };
                })
            );
        }
        if (context.content.limits.length > 0) {
            await tx.insert(planVersionLimits).values(
                context.content.limits.map((item) => ({
                    planVersionId: published.id,
                    key: item.key,
                    value: item.value
                }))
            );
        }
        return published;
    });
}
