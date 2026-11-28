import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    and,
    type DomainEventActorType,
    type DrizzleClient,
    domainEventModel,
    eq,
    getDb,
    idempotencyKeys,
    isNull,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import {
    type ActStart,
    type AuthorizationSnapshot,
    assertFreshForAct,
    type PaymentProvider,
    type ProviderRead
} from '@repo/payments';
import type { AddonAbandonReason, AddonFactActorKind } from '../facts/addon-fact';
import type { BillingFactSink } from '../facts/billing-fact-sink';
import { creditedPaymentsFromLedger } from '../payment/payment-ledger';
import { cancelOurAuthorization } from '../reconciliation/cancel-our-authorization';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision';
import { type AddonFactListing, emitAddonFact, wholeSecondsBetween } from './addon-fact-emit';

const logger = createLogger('addon-release-pending-complement');

/** Input of {@link abandonPendingComplementPair}. */
export interface AbandonPendingComplementPairInput {
    /** The pending COMPLEMENTO subscription. */
    readonly complementId: string;
    /** The pending instance; when omitted, the instance that points at the complement. */
    readonly instanceId?: string;
    /** The instant of the transition. */
    readonly now: Date;
    /** Who decided the release, written on the instance's domain event. */
    readonly actor: { readonly type: DomainEventActorType; readonly id?: string | null };
    /**
     * An open `PREAPPROVAL_CREATE` key to complete with this result (HOS-2321). A key that is
     * already completed is left as it is.
     */
    readonly openKey?: { readonly key: string; readonly result: Record<string, unknown> };
    /**
     * Whether this release decided to cancel the preapproval at the provider. When true, the
     * decision is recorded in the same transaction so the sweep retries a failed call.
     */
    readonly decidesProviderCancellation: boolean;
    /**
     * A last check run inside the transaction, after the COMPLEMENTO row is locked and before
     * anything is written; false releases nothing (for example: a payment was credited meanwhile).
     */
    readonly stillReleasable?: (tx: DrizzleClient) => Promise<boolean>;
    /**
     * The `addon_checkout_abandoned` fact to emit once the release committed (HOS-2668, A8 and
     * A9). Omitted, no fact is emitted (HOS-2321's refused creation never had a checkout).
     */
    readonly abandonedFact?: AbandonedFact;
}

/** The `addon_checkout_abandoned` fact of a committed release, and where to send it. */
export interface AbandonedFact {
    readonly reason: AddonAbandonReason;
    readonly actorKind: AddonFactActorKind;
    readonly billingFacts: BillingFactSink | undefined;
    readonly listing?: AddonFactListing;
}

/**
 * A `stillReleasable` check that blocks the release when the COMPLEMENTO has a credited payment,
 * read inside the release transaction (the payment notice can beat the authorization notice).
 *
 * @param complementId - The pending COMPLEMENTO
 * @returns The check to pass as `stillReleasable`
 */
export function withoutCreditedPayment(
    complementId: string
): (tx: DrizzleClient) => Promise<boolean> {
    return async (tx) =>
        !(await creditedPaymentsFromLedger.hasCreditedPayment({
            subscriptionId: complementId,
            tx
        }));
}

/**
 * Abandons a pending COMPLEMENTO and its pending addon instance in ONE transaction, releasing the
 * purchase identity: completes an open creation key when one is given, writes the instance's
 * `addon_instance.status_changed` event and, when the release decided a cancellation, records it
 * for the sweep's retry (AC:B11:6). It never calls the provider. When `abandonedFact` is given,
 * `addon_checkout_abandoned` is emitted exactly once, after the commit, and only when this call
 * performed the abandonment.
 *
 * @param input - The pair, the instant, the actor and what to record
 * @returns Whether this call performed the abandonment; false when either row already moved
 */
export async function abandonPendingComplementPair(
    input: AbandonPendingComplementPairInput
): Promise<boolean> {
    let instanceId: string;
    try {
        instanceId = await abandonPairInTransaction(input);
    } catch (error) {
        if (!(error instanceof PairAlreadyMovedError)) throw error;
        return false;
    }
    const fact = input.abandonedFact;
    if (fact)
        await emitAddonFact({
            billingFacts: fact.billingFacts,
            ...(fact.listing ? { listing: fact.listing } : {}),
            source: { instanceId },
            build: (anchored) => ({
                kind: 'ADDON_CHECKOUT_ABANDONED',
                ...anchored.subject,
                actorKind: fact.actorKind,
                occurredAt: input.now,
                reason: fact.reason,
                secondsInPending: wholeSecondsBetween({ from: anchored.createdAt, to: input.now })
            })
        });
    return true;
}

/** Thrown inside the transaction so a pair that only half matched is rolled back, not committed. */
class PairAlreadyMovedError extends Error {}

async function abandonPairInTransaction(input: AbandonPendingComplementPairInput): Promise<string> {
    return getDb().transaction(async (tx) => {
        if (input.stillReleasable) {
            const [locked] = await tx
                .select({ id: subscriptions.id })
                .from(subscriptions)
                .where(eq(subscriptions.id, input.complementId))
                .limit(1)
                .for('update');
            if (!locked || !(await input.stillReleasable(tx))) throw new PairAlreadyMovedError();
        }
        const [complement] = await tx
            .update(subscriptions)
            .set({ status: 'ABANDONED', updatedAt: input.now })
            .where(
                and(
                    eq(subscriptions.id, input.complementId),
                    eq(subscriptions.class, 'COMPLEMENTO'),
                    eq(subscriptions.status, 'PENDING_AUTHORIZATION')
                )
            )
            .returning({ id: subscriptions.id });
        const [instance] = await tx
            .update(addonInstances)
            .set({ status: 'ABANDONED', updatedAt: input.now })
            .where(
                and(
                    eq(addonInstances.complementSubscriptionId, input.complementId),
                    eq(addonInstances.status, 'PENDING_AUTHORIZATION'),
                    input.instanceId === undefined
                        ? undefined
                        : eq(addonInstances.id, input.instanceId)
                )
            )
            .returning({ id: addonInstances.id });
        // Someone else already moved the pair (for example the window expiry): nothing to do.
        // Throwing rolls back the update of the row that still matched.
        if (!complement || !instance) {
            if (complement || instance)
                logger.warn(
                    { complementId: input.complementId, instanceId: input.instanceId },
                    'Pending complement pair only half matched; nothing was released'
                );
            throw new PairAlreadyMovedError();
        }
        if (input.openKey)
            await tx
                .update(idempotencyKeys)
                .set({ result: input.openKey.result, completedAt: input.now })
                .where(
                    and(
                        eq(idempotencyKeys.key, input.openKey.key),
                        eq(idempotencyKeys.operation, 'PREAPPROVAL_CREATE'),
                        eq(idempotencyKeys.subjectId, input.complementId),
                        isNull(idempotencyKeys.completedAt)
                    )
                );
        const changes = [
            { field: 'status', old: 'PENDING_AUTHORIZATION', new: 'ABANDONED' }
        ] as const;
        await domainEventModel.insert({
            eventType: 'addon_instance.status_changed',
            entityType: 'addon_instance',
            entityId: instance.id,
            actorType: input.actor.type,
            actorId: input.actor.id ?? null,
            correlationId: randomUUID(),
            changes: [...changes],
            occurredAt: input.now,
            tx
        });
        if (input.decidesProviderCancellation)
            // A8: a pending add-on purchase replaced by its owner (HOS-2668, owner decision
            // 2026-11-27), not A3, which stays the sweep's window expiry with its
            // ADDON_AUTHORIZATION_EXPIRED notice. A8 is RECIPIENTLESS in the retry map, so the
            // sweep retries a failed cancel without asking for, or waiting on, any notice. The
            // literal stays inline so before-cancel-notice-kinds.guard.test.ts can see it.
            await recordProviderCancellationDecided({
                subscriptionId: input.complementId,
                transition: 'A8',
                decidedAt: input.now,
                actor: input.actor,
                correlationId: randomUUID(),
                changes: [...changes],
                tx
            });
        return instance.id;
    });
}

/**
 * Releases a pending recurring purchase whose preapproval was read live: abandons the pair, then
 * cancels the preapproval when the read did not already see it cancelled. A failed or unconfirmed
 * cancel is logged and left to the sweep, which retries the recorded decision. No before-cancel
 * notice is asked for: the release is the owner's own new request (A8). A credited payment on
 * the COMPLEMENTO, re-checked inside the release transaction, releases and cancels nothing. A
 * committed release emits `addon_checkout_abandoned` (`OWNER_WITHDREW`, by the `USER`) once.
 * The cancel trusts `prior`, the decision's own read, without re-reading first (as S39 does).
 *
 * @param input.complementId - The pending COMPLEMENTO
 * @param input.instanceId - Its pending instance, when the caller knows it
 * @param input.authorizationId - The provider preapproval linked to the complement
 * @param input.prior - The fresh read of that preapproval and the act it was taken for
 * @param input.actor - Who decided the release
 * @param ports - The provider, clock and the optional fact sink and listing reader
 * @returns Whether this call released the pair
 */
export async function releasePendingComplement(
    input: {
        readonly complementId: string;
        readonly instanceId?: string;
        readonly authorizationId: string;
        readonly prior: {
            readonly read: ProviderRead<AuthorizationSnapshot>;
            readonly act: ActStart;
        };
        readonly actor: { readonly type: DomainEventActorType; readonly id?: string | null };
    },
    ports: {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly billingFacts?: BillingFactSink;
        readonly listing?: AddonFactListing;
    }
): Promise<{ readonly released: boolean }> {
    const alreadyCancelled =
        assertFreshForAct({ read: input.prior.read, act: input.prior.act }).snapshot.status ===
        'cancelled';
    const released = await abandonPendingComplementPair({
        complementId: input.complementId,
        ...(input.instanceId === undefined ? {} : { instanceId: input.instanceId }),
        now: ports.clock.now(),
        actor: input.actor,
        decidesProviderCancellation: !alreadyCancelled,
        stillReleasable: withoutCreditedPayment(input.complementId),
        abandonedFact: {
            reason: 'OWNER_WITHDREW',
            actorKind: 'USER',
            billingFacts: ports.billingFacts,
            ...(ports.listing ? { listing: ports.listing } : {})
        }
    });
    if (!released || alreadyCancelled) return { released };
    const { outcome } = await cancelOurAuthorization(
        {
            subscriptionId: input.complementId,
            // A8 is RECIPIENTLESS: the owner is replacing this purchase, so nobody is notified.
            userId: null,
            authorizationId: input.authorizationId,
            kind: null,
            prior: input.prior
        },
        { provider: ports.provider, clock: ports.clock }
    );
    if (outcome !== 'CONFIRMED' && outcome !== 'ALREADY_CANCELLED')
        logger.warn(
            { complementId: input.complementId, outcome },
            'Released addon authorization cancellation will be retried by the sweep'
        );
    return { released };
}
