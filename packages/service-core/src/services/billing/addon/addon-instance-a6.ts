import { randomUUID } from 'node:crypto';
import type { Clock, VerticalsForBilling } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    addonVersions,
    and,
    type DrizzleClient,
    domainEventModel,
    eq,
    getDb,
    inArray,
    providerLinks,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { z } from 'zod';
import type { CoverageNotices } from '../payment/payment-ports';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision';
import type { ReconciliationMarkPayments } from '../reconciliation/reconciliation-mark-payments.port';
import { applyS21 } from '../subscription/complement-s21';
import type { BeforeCancelNotice } from '../subscription/start-subscription.service';
import type { CancellationSeenAnnotator } from '../subscription/subscription-billing-ports';
import { type CancelledAddon, emitAddonCoverageRemoved } from './addon-instance-a5';
import { cancelAddonComplementAtProviderForA6 } from './addon-instance-a6-provider';
import { removedCoverageVerticalsOf } from './addon-removed-coverage-verticals';

const applySchema = z.object({
    instanceId: z.uuid(),
    now: z.date(),
    tx: z.custom<DrizzleClient>((value) => value !== null && value !== undefined)
});
const cancelSchema = z.object({ instanceId: z.uuid(), correlationId: z.uuid() });

/** Ports for the local A6 act, all database work using the caller's transaction. */
export interface ApplyA6Ports {
    readonly listing: VerticalsForBilling['listing'];
}

/** Ports for A6's complete act, including its after-commit effects. */
export interface CancelPurgedListingAddonPorts extends ApplyA6Ports {
    readonly listingPurged: VerticalsForBilling['listingPurged'];
    readonly coverageNotices: CoverageNotices;
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly cancellationSeen?: CancellationSeenAnnotator;
    readonly markPayments?: ReconciliationMarkPayments;
}

/** A6 inside one transaction: consume a live LISTING addon and close its complement by S21. */
export async function applyA6(
    input: {
        readonly tx: DrizzleClient;
        readonly instanceId: string;
        readonly now: Date;
        readonly markPayments?: ReconciliationMarkPayments;
    },
    ports: ApplyA6Ports
): Promise<
    | { readonly outcome: 'CANCELLED'; readonly addon: CancelledAddon }
    | { readonly outcome: 'NOT_LIVE' }
> {
    applySchema.parse(input);
    const { tx, now } = input;
    const [instance] = await tx
        .select()
        .from(addonInstances)
        .where(eq(addonInstances.id, input.instanceId))
        .limit(1)
        .for('update');
    if (!instance || !['ACTIVE', 'PENDING_AUTHORIZATION'].includes(instance.status))
        return { outcome: 'NOT_LIVE' };
    const [version] = await tx
        .select({ scopeType: addonVersions.scopeType })
        .from(addonVersions)
        .where(eq(addonVersions.id, instance.addonVersionId))
        .limit(1);
    if (version?.scopeType !== 'LISTING') return { outcome: 'NOT_LIVE' };
    const [written] = await tx
        .update(addonInstances)
        .set({ status: 'CANCELLED', updatedAt: now })
        .where(
            and(
                eq(addonInstances.id, instance.id),
                inArray(addonInstances.status, ['ACTIVE', 'PENDING_AUTHORIZATION']),
                eq(addonInstances.status, instance.status)
            )
        )
        .returning({ id: addonInstances.id });
    if (!written) throw new Error(`Addon instance ${instance.id} changed during A6`);
    await domainEventModel.insert({
        eventType: 'addon_instance.status_changed',
        entityType: 'addon_instance',
        entityId: instance.id,
        actorType: 'job',
        actorId: null,
        correlationId: randomUUID(),
        changes: [{ field: 'status', old: instance.status, new: 'CANCELLED' }],
        occurredAt: now,
        tx
    });
    let providerCancellation: CancelledAddon['providerCancellation'] = null;
    if (instance.complementSubscriptionId) {
        const s21 = await applyS21({
            tx,
            complementSubscriptionId: instance.complementSubscriptionId,
            now,
            cause: 'OTHER_CAUSE',
            markPayments: input.markPayments
        });
        if (s21.outcome === 'CANCELLED') {
            const [complement] = await tx
                .select({
                    userId: subscriptions.userId,
                    paymentMethod: subscriptions.paymentMethod,
                    authorizationId: providerLinks.providerId
                })
                .from(subscriptions)
                .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
                .where(eq(subscriptions.id, instance.complementSubscriptionId))
                .limit(1);
            if (
                complement?.authorizationId &&
                complement.paymentMethod === 'CARD' &&
                complement.userId
            ) {
                await recordProviderCancellationDecided({
                    subscriptionId: instance.complementSubscriptionId,
                    transition: 'A6',
                    decidedAt: now,
                    actor: { type: 'job' },
                    correlationId: randomUUID(),
                    changes: [{ field: 'status', old: s21.from, new: 'CANCELLED' }],
                    tx
                });
                providerCancellation = {
                    subscriptionId: instance.complementSubscriptionId,
                    userId: complement.userId,
                    authorizationId: complement.authorizationId
                };
            }
        }
    }
    const coverageVerticals =
        instance.status === 'ACTIVE'
            ? await removedCoverageVerticalsOf({ tx, instance, ports })
            : [];
    return {
        outcome: 'CANCELLED',
        addon: {
            instanceId: instance.id,
            ownerId: instance.ownerId,
            clause: 'ORPHANED',
            coverageVerticals,
            complementSubscriptionId: instance.complementSubscriptionId,
            providerCancellation
        }
    };
}

/** Re-read fichaPurgada, run A6, then remove coverage and cancel the addon preapproval. */
export async function cancelPurgedListingAddon(
    input: { readonly instanceId: string; readonly correlationId: string },
    ports: CancelPurgedListingAddonPorts
): Promise<{
    readonly outcome: 'CANCELLED' | 'NOT_LIVE' | 'DISCARDED';
    readonly cancelCall?: 'SENT' | 'NOT_NEEDED' | 'NOTICE_PENDING' | 'FAILED';
}> {
    cancelSchema.parse(input);
    const [target] = await getDb()
        .select({ targetId: addonInstances.targetId })
        .from(addonInstances)
        .where(eq(addonInstances.id, input.instanceId))
        .limit(1);
    if (!target?.targetId) return { outcome: 'NOT_LIVE' };
    const { purged } = await ports.listingPurged({ listingId: target.targetId });
    if (!purged) return { outcome: 'DISCARDED' };
    const result = await getDb().transaction((tx) =>
        applyA6(
            {
                tx,
                instanceId: input.instanceId,
                now: ports.clock.now(),
                markPayments: ports.markPayments
            },
            ports
        )
    );
    if (result.outcome === 'NOT_LIVE') return result;
    await emitAddonCoverageRemoved({
        cancelled: [result.addon],
        coverageNotices: {
            emitCoverageChanged: (notice) => ports.coverageNotices.emitCoverageChanged(notice)
        }
    });
    const { results } = await cancelAddonComplementAtProviderForA6(
        { cancelled: [result.addon] },
        ports
    );
    return { outcome: 'CANCELLED', cancelCall: results[0]?.cancelCall };
}
