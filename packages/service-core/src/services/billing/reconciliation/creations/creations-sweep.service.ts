import type { Clock } from '@repo/billing-verticals-contract';
import { creationSweepModel, getDb, reconciliationInventoryModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import {
    ApprovalUrlRejectedError,
    actStartInstant,
    assertFreshForAct,
    type PaymentProvider,
    sanitizeApprovalUrl
} from '@repo/payments';
import { extractPostgresErrorCause } from '../../../../utils/postgres-error-cause.js';
import {
    type AppliedAuthorizationResult,
    appliedAuthorizationResult
} from '../../subscription/resolve-live-commitment.js';
import { authorizePendingSubscription } from '../../subscription/start-subscription.service.js';

export const CREATION_GRACE_MS = 5 * 60_000;
export const CREATION_RECREATE_AFTER_MS = 15 * 60_000;
// The provider identity matches start-subscription.service.ts and handle-unknown-authorization.service.ts.
const PROVIDER = 'MERCADO_PAGO' as const;
const logger = createLogger('billing-creations-sweep');

export interface CreationsSweepSummary {
    readonly rowsExamined: number;
    readonly linked: number;
    /** Creation keys completed with the recovered checkout, on link or on a later heal (HOS-1725). */
    readonly keysCompleted: number;
    readonly duplicatesCancelled: number;
    readonly alreadyCancelled: number;
    readonly recreated: number;
    readonly skippedTooFresh: number;
    readonly skippedNoEmail: number;
    readonly skippedLiveElsewhere: number;
    readonly skippedRaced: number;
    readonly rowsFailed: number;
    readonly failures: readonly { subscriptionId: string; message: string }[];
    readonly startedAt: Date;
    readonly finishedAt: Date;
}

export async function runCreationsSweep(
    input: { pageSize?: number; correlationId?: string } = {},
    ports: { provider: PaymentProvider; clock: Clock; returnUrl: string }
): Promise<CreationsSweepSummary> {
    const pageSize = input.pageSize ?? 100;
    const startedAt = ports.clock.now();
    const failures: { subscriptionId: string; message: string }[] = [];
    let rowsExamined = 0,
        linked = 0,
        keysCompleted = 0,
        duplicatesCancelled = 0,
        alreadyCancelled = 0,
        recreated = 0;
    let skippedTooFresh = 0,
        skippedNoEmail = 0,
        skippedLiveElsewhere = 0,
        skippedRaced = 0,
        rowsFailed = 0;
    let afterSubscriptionId: string | undefined;
    for (;;) {
        const page = await creationSweepModel.listPendingCreationPage({
            now: ports.clock.now(),
            afterSubscriptionId,
            limit: pageSize
        });
        for (const row of page) {
            rowsExamined++;
            const { subscription, providerLink, newestCreateKey, payerEmail, planName } = row;
            try {
                let cancellationFailure: unknown;
                const cancelAndCount = async (authorizationId: string) => {
                    try {
                        const result = await cancelDuplicate(
                            authorizationId,
                            subscription.id,
                            ports
                        );
                        if (result === 'CANCELLED') duplicatesCancelled++;
                        if (result === 'ALREADY_CANCELLED') alreadyCancelled++;
                        if (result === 'MISMATCH') skippedRaced++;
                    } catch (error) {
                        if (cancellationFailure === undefined) {
                            cancellationFailure = error;
                            rowsFailed++;
                            const message = error instanceof Error ? error.message : String(error);
                            failures.push({ subscriptionId: subscription.id, message });
                            logger.error(
                                { subscriptionId: subscription.id, error: message },
                                'Creation duplicate cancellation failed'
                            );
                        }
                    }
                };
                const rowStartedAt = ports.clock.now();
                if (!payerEmail?.trim()) {
                    skippedNoEmail++;
                    continue;
                }
                const age =
                    rowStartedAt.getTime() -
                    (newestCreateKey?.createdAt ?? subscription.createdAt).getTime();
                if (!providerLink && age < CREATION_GRACE_MS) {
                    skippedTooFresh++;
                    continue;
                }
                // The provider search intentionally uses only payerEmail; its result is classified locally.
                const found = await ports.provider.searchAuthorizations({ payerEmail });
                const named = found.authorizations.filter(
                    (candidate) => candidate.reference === subscription.id
                );
                const pending = named.filter((candidate) => candidate.status === 'pending');
                if (providerLink) {
                    for (const candidate of pending) {
                        if (candidate.authorizationId === providerLink.providerId) continue;
                        await cancelAndCount(candidate.authorizationId);
                    }
                    // HOS-1725: a row linked before the sweep completed keys stays a 409
                    // for S1 until its window closes. Heal it from the linked creation.
                    if (newestCreateKey && newestCreateKey.completedAt === null) {
                        const healed = await healLinkedCreateKey({
                            subscriptionId: subscription.id,
                            authorizationId: providerLink.providerId,
                            ports
                        });
                        if (healed) keysCompleted++;
                    }
                    continue;
                }
                if (pending.length) {
                    const ordered = [...pending].sort(
                        (a, b) =>
                            Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
                            b.authorizationId.localeCompare(a.authorizationId)
                    );
                    let winner: string | undefined;
                    let winnerRead: CreationRead | undefined;
                    for (const candidate of ordered) {
                        const read = await readById(candidate.authorizationId, ports);
                        if (read.reference !== subscription.id || read.status === 'cancelled')
                            continue;
                        winner = candidate.authorizationId;
                        winnerRead = read;
                        break;
                    }
                    if (!winner || !winnerRead) {
                        skippedRaced++;
                        continue;
                    }
                    const checkoutUrl = checkoutUrlOf({
                        creation: winnerRead,
                        subscriptionId: subscription.id
                    });
                    const outcome = await linkWinner({
                        subscriptionId: subscription.id,
                        providerId: winner,
                        completion: checkoutUrl
                            ? appliedAuthorizationResult({ authorizationId: winner, checkoutUrl })
                            : null,
                        completedAt: ports.clock.now()
                    });
                    if (outcome.status === 'RACED') {
                        skippedRaced++;
                        continue;
                    }
                    linked++;
                    if (outcome.keyCompleted) keysCompleted++;
                    for (const candidate of ordered) {
                        if (candidate.authorizationId === winner) continue;
                        await cancelAndCount(candidate.authorizationId);
                    }
                    continue;
                }
                if (named.some((candidate) => candidate.status !== 'cancelled')) {
                    skippedLiveElsewhere++;
                    continue;
                }
                if (named.length === 0 && age >= CREATION_RECREATE_AFTER_MS) {
                    const minted = await creationSweepModel.mintCreateKeyIfUnlinked({
                        subscriptionId: subscription.id,
                        createdAt: ports.clock.now()
                    });
                    if (!minted) {
                        skippedRaced++;
                        continue;
                    }
                    await authorizePendingSubscription({
                        pending: { subscription, idempotencyKey: minted.key },
                        provider: ports.provider,
                        clock: ports.clock,
                        reason: planName,
                        returnUrl: ports.returnUrl,
                        payerEmail,
                        firstChargeAt: subscription.firstChargeAt?.toISOString()
                    });
                    recreated++;
                }
            } catch (error) {
                rowsFailed++;
                const message = error instanceof Error ? error.message : String(error);
                failures.push({ subscriptionId: subscription.id, message });
                logger.error(
                    { subscriptionId: subscription.id, error: message },
                    'Creation sweep row failed'
                );
            }
        }
        if (page.length < pageSize) break;
        afterSubscriptionId = page.at(-1)?.subscription.id;
    }
    return {
        rowsExamined,
        linked,
        keysCompleted,
        duplicatesCancelled,
        alreadyCancelled,
        recreated,
        skippedTooFresh,
        skippedNoEmail,
        skippedLiveElsewhere,
        skippedRaced,
        rowsFailed,
        failures,
        startedAt,
        finishedAt: ports.clock.now()
    };
}

async function readById(
    authorizationId: string,
    ports: { provider: PaymentProvider; clock: Clock }
) {
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const read = await ports.provider.readAuthorization({ authorizationId });
    return assertFreshForAct({ read, act }).snapshot;
}

async function cancelDuplicate(
    authorizationId: string,
    subscriptionId: string,
    ports: { provider: PaymentProvider; clock: Clock }
): Promise<'CANCELLED' | 'ALREADY_CANCELLED' | 'MISMATCH'> {
    const snapshot = await readById(authorizationId, ports);
    if (snapshot.reference !== subscriptionId) {
        logger.warn(
            { authorizationId, subscriptionId },
            'Search result reference changed before cancellation'
        );
        return 'MISMATCH';
    }
    if (snapshot.status === 'cancelled') return 'ALREADY_CANCELLED';
    await ports.provider.cancel({ authorizationId });
    return 'CANCELLED';
}

/** A creation as `readById` returns it: always through `assertFreshForAct` (GUARD:G17). */
type CreationRead = Awaited<ReturnType<typeof readById>>;

/**
 * The sanitized checkout of a creation read back by id, or `null` when the provider reported
 * no usable link. Fails closed (HOS-1725): without a link the key stays incomplete and S1 keeps
 * answering 409, which is better than storing a checkout that does not work.
 */
function checkoutUrlOf(input: {
    readonly creation: CreationRead;
    readonly subscriptionId: string;
}): string | null {
    try {
        return sanitizeApprovalUrl({ approvalUrl: input.creation.approvalUrl ?? '' }).url;
    } catch (error) {
        if (!(error instanceof ApprovalUrlRejectedError)) throw error;
        logger.warn(
            {
                subscriptionId: input.subscriptionId,
                authorizationId: input.creation.authorizationId,
                reason: error.reason
            },
            'Recovered creation has no usable checkout link; its creation key stays incomplete'
        );
        return null;
    }
}

/**
 * Links the winner and, in the SAME transaction, completes the creation key S1's reuse reads
 * (HOS-1725), so a recovered row never commits linked with a key that still answers 409.
 */
async function linkWinner(input: {
    readonly subscriptionId: string;
    readonly providerId: string;
    readonly completion: AppliedAuthorizationResult | null;
    readonly completedAt: Date;
}): Promise<{ readonly status: 'LINKED' | 'RACED'; readonly keyCompleted: boolean }> {
    const raced = { status: 'RACED', keyCompleted: false } as const;
    return getDb().transaction(async (tx) => {
        const { subscriptionId, providerId } = input;
        const locked = await reconciliationInventoryModel.lockSubscriptionForLink({
            subscriptionId,
            tx
        });
        if (locked?.subscription.status !== 'PENDING_AUTHORIZATION' || locked.providerLink)
            return raced;
        try {
            await tx.transaction((sp) =>
                reconciliationInventoryModel.insertProviderLink({
                    subscriptionId,
                    provider: PROVIDER,
                    providerId,
                    tx: sp
                })
            );
        } catch (error) {
            const cause = extractPostgresErrorCause(error);
            if (cause?.code === '23505') return raced;
            throw error;
        }
        const keyCompleted = input.completion
            ? await creationSweepModel.completeNewestCreateKey({
                  subscriptionId,
                  result: input.completion,
                  completedAt: input.completedAt,
                  tx
              })
            : false;
        return { status: 'LINKED', keyCompleted };
    });
}

/**
 * Completes the creation key of a row that is ALREADY linked but whose key never completed
 * (HOS-1725): the rows linked before the sweep completed keys. Only from the linked creation,
 * only while it is still `pending` and still names the row, and only while the row is still
 * pending and linked to that same creation under the lock.
 *
 * @returns `true` when the key was completed
 */
async function healLinkedCreateKey(input: {
    readonly subscriptionId: string;
    readonly authorizationId: string;
    readonly ports: { provider: PaymentProvider; clock: Clock };
}): Promise<boolean> {
    const { subscriptionId, authorizationId, ports } = input;
    const creation = await readById(authorizationId, ports);
    if (creation.reference !== subscriptionId || creation.status !== 'pending') return false;
    const checkoutUrl = checkoutUrlOf({ creation, subscriptionId });
    if (!checkoutUrl) return false;
    return getDb().transaction(async (tx) => {
        const locked = await reconciliationInventoryModel.lockSubscriptionForLink({
            subscriptionId,
            tx
        });
        if (
            locked?.subscription.status !== 'PENDING_AUTHORIZATION' ||
            locked.providerLink?.providerId !== authorizationId
        )
            return false;
        return creationSweepModel.completeNewestCreateKey({
            subscriptionId,
            result: appliedAuthorizationResult({ authorizationId, checkoutUrl }),
            completedAt: ports.clock.now(),
            tx
        });
    });
}
