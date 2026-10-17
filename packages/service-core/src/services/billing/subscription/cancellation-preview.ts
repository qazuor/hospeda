import type { Clock } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    addonProducts,
    addons,
    and,
    asc,
    eq,
    getDb,
    inArray,
    subscriptions
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { type Actor, ServiceError } from '../../../types/index.js';
import { findOrphanhoodCandidates } from '../addon/addon-orphanhood.js';
import { cancelActiveRejection } from './cancel-active-subscription.service.js';
import { resolveCancellationAuthority } from './cancellation-authorization.js';
import type { ComplementPolicyPorts } from './complement-ports.js';
import { selectComplementTargets } from './complement-selection.js';
import { computeS11ServiceEnd, readS11ServiceEndFacts } from './s11-service-end.js';

const inputSchema = z.strictObject({
    actor: z.custom<Actor>((v) => typeof v === 'object' && v !== null),
    subscriptionId: z.string()
});
const cycles = ['monthly', 'quarterly', 'semiannual', 'annual'] as const;
type CancellationOrigin = 'ACTIVE' | 'GRACE_PERIOD' | 'SUSPENDED' | 'CANCEL_SCHEDULED';
function isCancellationOrigin(status: string): status is CancellationOrigin {
    return ['ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCEL_SCHEDULED'].includes(status);
}

/** Classifies the moment a recurrent addon stops being available or billed. */
export function classifyAddonWhenOff(input: {
    readonly origin: 'ACTIVE' | 'GRACE_PERIOD' | 'SUSPENDED';
    readonly cutToday: boolean;
}): 'CHARGE_CUT_TODAY' | 'AT_SERVICE_END' | 'TODAY' {
    switch (input.origin) {
        case 'ACTIVE':
            if (input.cutToday) return 'CHARGE_CUT_TODAY';
            return 'AT_SERVICE_END';
        case 'GRACE_PERIOD':
        case 'SUSPENDED':
            return 'TODAY';
    }
}

/** Read-only cancellation preview; its rejection reasons match the S11/S23/S24 acts. */
export async function previewSubscriptionCancellation(
    input: { readonly actor: Actor; readonly subscriptionId: string },
    ports: { readonly clock: Clock; readonly complements: ComplementPolicyPorts }
) {
    const parsed = inputSchema.parse(input);
    if (!z.uuid().safeParse(parsed.subscriptionId).success)
        throw cancelActiveRejection('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
    return getDb().transaction(async (tx) => {
        const [row] = await tx
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, parsed.subscriptionId))
            .limit(1);
        if (!row) throw cancelActiveRejection('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
        const authority = resolveCancellationAuthority({
            actor: parsed.actor,
            subjectUserId: row.userId
        });
        if (!authority.allowed) {
            if (authority.reason === 'FORBIDDEN')
                throw cancelActiveRejection('CANCELLATION_FORBIDDEN', 'Cancellation is forbidden');
            throw cancelActiveRejection('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
        }
        if (row.class !== 'PRINCIPAL')
            throw cancelActiveRejection(
                'CANCELLATION_NOT_PRINCIPAL',
                'Only principal subscriptions can be cancelled'
            );
        const origin = row.status;
        if (!isCancellationOrigin(origin))
            throw cancelActiveRejection(
                'CANCELLATION_STATE_NOT_ALLOWED',
                'Subscription state cannot be cancelled'
            );
        let serviceEndsAt: Date | undefined;
        let graceEndsAt: Date | undefined;
        if (origin === 'ACTIVE')
            serviceEndsAt = computeS11ServiceEnd({
                now: ports.clock.now(),
                ...(await readS11ServiceEndFacts({ tx, subscription: row }))
            }).serviceEndsAt;
        else if (origin === 'GRACE_PERIOD') graceEndsAt = row.graceEndsAt ?? undefined;
        else if (origin === 'CANCEL_SCHEDULED') serviceEndsAt = row.serviceEndsAt ?? undefined;
        if ((origin === 'ACTIVE' || origin === 'CANCEL_SCHEDULED') && !serviceEndsAt)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Cancellation preview has no service end',
                undefined,
                'CANCELLATION_PREVIEW_INCONSISTENT'
            );
        if (origin === 'GRACE_PERIOD' && !graceEndsAt)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Grace cancellation preview has no grace end',
                undefined,
                'CANCELLATION_PREVIEW_INCONSISTENT'
            );
        let addonRows: Array<{
            addonInstanceId: string;
            name: string;
            price: number;
            currency: 'ARS';
            cycle: (typeof cycles)[number];
            whenOff: ReturnType<typeof classifyAddonWhenOff>;
        }> = [];
        if (origin !== 'CANCEL_SCHEDULED') {
            const { candidates } = await findOrphanhoodCandidates(
                {
                    tx,
                    leftRow: {
                        id: row.id,
                        userId: row.userId,
                        vertical: row.vertical,
                        predecessorId: null
                    }
                },
                ports.complements
            );
            let targets: readonly { readonly instanceId: string }[] = [];
            if (row.userId && row.vertical) {
                let complementStatus: 'ACTIVE' | 'PAUSED';
                switch (origin) {
                    case 'ACTIVE':
                    case 'GRACE_PERIOD':
                        complementStatus = 'ACTIVE';
                        break;
                    case 'SUSPENDED':
                        complementStatus = 'PAUSED';
                        break;
                }
                ({ targets } = await selectComplementTargets(
                    {
                        tx,
                        principal: { id: row.id, userId: row.userId, vertical: row.vertical },
                        rule: 'CANCEL',
                        complementStatus
                    },
                    ports.complements
                ));
            }
            const targetIds = new Set(targets.map((target) => target.instanceId));
            const candidateIds = candidates
                .filter(
                    (candidate) =>
                        (candidate.scopeType !== 'USER' && candidate.scopeType !== 'GLOBAL') ||
                        candidate.status !== 'ACTIVE' ||
                        targetIds.has(candidate.id)
                )
                .map((candidate) => candidate.id);
            const rows = candidateIds.length
                ? await tx
                      .select({
                          addonInstanceId: addonInstances.id,
                          name: addons.name,
                          chargeKind: addonProducts.chargeKind,
                          cycle: addonProducts.cycle,
                          price: addonProducts.price,
                          currency: addonProducts.currency,
                          status: addonInstances.status
                      })
                      .from(addonInstances)
                      .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
                      .innerJoin(addons, eq(addons.id, addonProducts.addonId))
                      .where(
                          and(
                              inArray(addonInstances.id, candidateIds),
                              eq(addonProducts.chargeKind, 'PERIODICO')
                          )
                      )
                      .orderBy(asc(addonInstances.createdAt), asc(addonInstances.id))
                : [];
            addonRows = rows.map((addon) => {
                if (
                    addon.currency !== 'ARS' ||
                    !cycles.includes(addon.cycle as (typeof cycles)[number]) ||
                    addon.price <= 0
                )
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Cancellation preview contains inconsistent add-on product data',
                        undefined,
                        'CANCELLATION_PREVIEW_INCONSISTENT'
                    );
                return {
                    addonInstanceId: addon.addonInstanceId,
                    name: addon.name,
                    price: addon.price,
                    currency: 'ARS',
                    cycle: addon.cycle as (typeof cycles)[number],
                    whenOff: classifyAddonWhenOff({
                        origin,
                        cutToday: addon.status === 'ACTIVE' && targetIds.has(addon.addonInstanceId)
                    })
                };
            });
        }
        const common = {
            subscriptionId: row.id,
            vertical: row.vertical ?? '',
            paymentMethod: row.paymentMethod as 'CARD' | 'MANUAL',
            addons: addonRows
        };
        switch (origin) {
            case 'ACTIVE': {
                if (!serviceEndsAt)
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Cancellation preview has no service end',
                        undefined,
                        'CANCELLATION_PREVIEW_INCONSISTENT'
                    );
                return { ...common, origin, serviceEndsAt: serviceEndsAt.toISOString() };
            }
            case 'GRACE_PERIOD': {
                if (!graceEndsAt)
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Grace cancellation preview has no grace end',
                        undefined,
                        'CANCELLATION_PREVIEW_INCONSISTENT'
                    );
                return { ...common, origin, graceEndsAt: graceEndsAt.toISOString() };
            }
            case 'SUSPENDED':
                return { ...common, origin };
            case 'CANCEL_SCHEDULED': {
                if (!serviceEndsAt)
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Cancellation preview has no service end',
                        undefined,
                        'CANCELLATION_PREVIEW_INCONSISTENT'
                    );
                return { ...common, origin, serviceEndsAt: serviceEndsAt.toISOString() };
            }
            default:
                throw cancelActiveRejection(
                    'CANCELLATION_STATE_NOT_ALLOWED',
                    'Subscription state cannot be cancelled'
                );
        }
    });
}
