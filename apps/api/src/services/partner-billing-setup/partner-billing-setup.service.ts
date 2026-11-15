import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import {
    and,
    billingOptions,
    domainEventModel,
    eq,
    getDb,
    inArray,
    PartnerModel,
    planCatalogModel,
    plans,
    planVersions
} from '@repo/db';
import { PartnerBillingSetupOptionSchema, ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import type {
    Actor,
    StartManualSubscriptionResult,
    StartSubscriptionPorts
} from '@repo/service-core';
import { isSystemActor, ServiceError, startManualSubscription } from '@repo/service-core';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';
import { getRequestCorrelationId } from '../../lib/request-context';

const partnerModel = new PartnerModel();
const ACTION = 'ACC_6' as const;
const EFFECT = 'Creates a subscription pending authorization and opens its first installment.';

/** A sellable Partner billing option exposed by the action 6 preview (AC:V7:17, ACC:6). */
export type PartnerBillingSetupOption = ReturnType<typeof PartnerBillingSetupOptionSchema.parse>;

/** Typed AC:V7:17 ACC:6 rejection reasons translated by the HTTP route. */
export type PartnerBillingSetupRejection =
    | 'NOT_FOUND'
    | 'PARTNER_WITHOUT_OWNER'
    | 'COMMITMENT_TAKEN'
    | 'PLAN_NOT_FOR_SALE'
    | 'MANUAL_PAYMENT_NOT_AVAILABLE'
    | 'ADMINISTRATIVE_ACTION_FORBIDDEN';

/** Read-only action 6 preview for one Partner (AC:V7:17, ACC:6). */
export async function previewPartnerBillingSetup(input: {
    readonly actor: Actor;
    readonly partnerId: string;
}): Promise<{
    readonly partner: { readonly id: string; readonly name: string };
    readonly ownerUserId: string;
    readonly method: 'MANUAL';
    readonly options: readonly PartnerBillingSetupOption[];
    readonly effect: typeof EFFECT;
}> {
    assertActionPermission(input.actor);
    const partner = await partnerModel.findOne({ id: input.partnerId });
    if (!partner) throw rejection('NOT_FOUND', ServiceErrorCode.NOT_FOUND, 'Partner not found');
    if (!partner.ownerUserId)
        throw rejection(
            'PARTNER_WITHOUT_OWNER',
            ServiceErrorCode.ALREADY_EXISTS,
            'Partner has no owner'
        );

    const versions = await planCatalogModel.findSellableCurrentVersions({
        vertical: VerticalEnum.PARTNER
    });
    if (versions.length === 0)
        return {
            partner: { id: partner.id, name: partner.name },
            ownerUserId: partner.ownerUserId,
            method: 'MANUAL',
            options: [],
            effect: EFFECT
        };
    const rows = await getDb()
        .select({
            billingOptionId: billingOptions.id,
            planVersionId: planVersions.id,
            planName: plans.name,
            planSlug: plans.slug,
            cycle: billingOptions.cycle,
            amountMinor: billingOptions.amount,
            currency: billingOptions.currency
        })
        .from(billingOptions)
        .innerJoin(planVersions, eq(planVersions.id, billingOptions.planVersionId))
        .innerJoin(plans, eq(plans.id, planVersions.planId))
        .where(
            and(
                inArray(
                    planVersions.id,
                    versions.map((version) => version.id)
                ),
                eq(planVersions.vertical, VerticalEnum.PARTNER),
                eq(planVersions.current, true),
                eq(planVersions.sellable, true)
            )
        );
    const order = new Map(versions.map((version, index) => [version.id, index]));
    const options = rows
        .sort(
            (left, right) =>
                (order.get(left.planVersionId) ?? 0) - (order.get(right.planVersionId) ?? 0) ||
                left.cycle.localeCompare(right.cycle)
        )
        .map((row) => PartnerBillingSetupOptionSchema.parse(row));
    return {
        partner: { id: partner.id, name: partner.name },
        ownerUserId: partner.ownerUserId,
        method: 'MANUAL',
        options,
        effect: EFFECT
    };
}

/** Creates the Partner owner's manual S1 commitment and durable action 6 event atomically (AC:V7:17, ACC:6). */
export async function configurePartnerBilling(
    input: {
        readonly actor: Actor;
        readonly partnerId: string;
        readonly billingOptionId: string;
        readonly reason: string;
    },
    ports: StartSubscriptionPorts
): Promise<StartManualSubscriptionResult> {
    const reason = input.reason.trim();
    if (reason.length < 1 || reason.length > 500)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Reason must contain 1 to 500 characters'
        );
    return getDb().transaction(async (tx) => {
        const partner = await partnerModel.lockById({
            tx: tx as DrizzleClient,
            partnerId: input.partnerId
        });
        if (!partner) throw rejection('NOT_FOUND', ServiceErrorCode.NOT_FOUND, 'Partner not found');
        if (!partner.ownerUserId)
            throw rejection(
                'PARTNER_WITHOUT_OWNER',
                ServiceErrorCode.ALREADY_EXISTS,
                'Partner has no owner'
            );
        const step = resolveAdministrativeActionStep({
            action: ACTION,
            actorId: input.actor.id,
            subjectId: partner.ownerUserId,
            permitted: isAdministrativeActionPermitted({
                action: ACTION,
                actorPermissions: input.actor.permissions
            }),
            isSystemActor: isSystemActor(input.actor)
        });
        if (!step.allowed)
            throw rejection(
                'ADMINISTRATIVE_ACTION_FORBIDDEN',
                ServiceErrorCode.FORBIDDEN,
                'Forbidden'
            );
        const [choice] = await tx
            .select({ option: billingOptions, vertical: planVersions.vertical })
            .from(billingOptions)
            .innerJoin(planVersions, eq(planVersions.id, billingOptions.planVersionId))
            .where(eq(billingOptions.id, input.billingOptionId))
            .limit(1);
        if (!choice || choice.vertical !== VerticalEnum.PARTNER)
            throw rejection(
                'MANUAL_PAYMENT_NOT_AVAILABLE',
                ServiceErrorCode.VALIDATION_ERROR,
                'Manual payment option is unavailable'
            );
        const result = await startManualSubscription(
            {
                userId: partner.ownerUserId,
                billingOptionId: input.billingOptionId,
                tx: tx as DrizzleClient
            },
            ports
        );
        if (result.created) {
            await domainEventModel.insert({
                tx: tx as DrizzleClient,
                eventType: 'partner.billing_configured',
                entityType: 'partner',
                entityId: partner.id,
                actorType: 'admin',
                actorId: input.actor.id,
                reason,
                changes: [
                    { field: 'payment_method', old: null, new: 'MANUAL' },
                    { field: 'plan_version_id', old: null, new: choice.option.planVersionId },
                    { field: 'billing_option_id', old: null, new: choice.option.id },
                    { field: 'subscription_id', old: null, new: result.subscriptionId },
                    { field: 'owner_user_id', old: null, new: partner.ownerUserId }
                ],
                correlationId: getRequestCorrelationId() ?? randomUUID(),
                occurredAt: ports.clock.now()
            });
        }
        return result;
    });
}

function assertActionPermission(actor: Actor): void {
    if (!isAdministrativeActionPermitted({ action: ACTION, actorPermissions: actor.permissions }))
        throw rejection('ADMINISTRATIVE_ACTION_FORBIDDEN', ServiceErrorCode.FORBIDDEN, 'Forbidden');
    if (isSystemActor(actor))
        throw rejection('ADMINISTRATIVE_ACTION_FORBIDDEN', ServiceErrorCode.FORBIDDEN, 'Forbidden');
}

function rejection(
    reason: PartnerBillingSetupRejection,
    code: ServiceErrorCode,
    message: string
): ServiceError {
    return new ServiceError(code, message, undefined, reason);
}
