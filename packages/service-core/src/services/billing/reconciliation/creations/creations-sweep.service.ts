import type { Clock } from '@repo/billing-verticals-contract';
import { creationSweepModel, getDb, reconciliationInventoryModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { extractPostgresErrorCause } from '../../../../utils/postgres-error-cause.js';
import { authorizePendingSubscription } from '../../subscription/start-subscription.service.js';

export const CREATION_GRACE_MS = 5 * 60_000;
export const CREATION_RECREATE_AFTER_MS = 15 * 60_000;
// The provider identity matches start-subscription.service.ts and handle-unknown-authorization.service.ts.
const PROVIDER = 'MERCADO_PAGO' as const;
const logger = createLogger('billing-creations-sweep');

export interface CreationsSweepSummary {
    readonly rowsExamined: number;
    readonly linked: number;
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
            const { subscription, providerLink, newestCreateKey, userEmail, planName } = row;
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
                if (!userEmail?.trim()) {
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
                const found = await ports.provider.searchAuthorizations({ payerEmail: userEmail });
                const named = found.authorizations.filter(
                    (candidate) => candidate.reference === subscription.id
                );
                const pending = named.filter((candidate) => candidate.status === 'pending');
                if (providerLink) {
                    for (const candidate of pending) {
                        if (candidate.authorizationId === providerLink.providerId) continue;
                        await cancelAndCount(candidate.authorizationId);
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
                    for (const candidate of ordered) {
                        const read = await readById(candidate.authorizationId, ports);
                        if (read.reference !== subscription.id || read.status === 'cancelled')
                            continue;
                        winner = candidate.authorizationId;
                        break;
                    }
                    if (!winner) {
                        skippedRaced++;
                        continue;
                    }
                    const outcome = await linkWinner(subscription.id, winner);
                    if (outcome === 'RACED') {
                        skippedRaced++;
                        continue;
                    }
                    linked++;
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
                        payerEmail: userEmail,
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

async function linkWinner(subscriptionId: string, providerId: string): Promise<'LINKED' | 'RACED'> {
    return getDb().transaction(async (tx) => {
        const locked = await reconciliationInventoryModel.lockSubscriptionForLink({
            subscriptionId,
            tx
        });
        if (locked?.subscription.status !== 'PENDING_AUTHORIZATION' || locked.providerLink)
            return 'RACED';
        try {
            await tx.transaction((sp) =>
                reconciliationInventoryModel.insertProviderLink({
                    subscriptionId,
                    provider: PROVIDER,
                    providerId,
                    tx: sp
                })
            );
            return 'LINKED';
        } catch (error) {
            const cause = extractPostgresErrorCause(error);
            if (cause?.code === '23505') return 'RACED';
            throw error;
        }
    });
}
