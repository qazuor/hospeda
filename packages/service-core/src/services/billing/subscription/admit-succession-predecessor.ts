import type { Clock } from '@repo/billing-verticals-contract';
import { eq, getDb, providerLinks, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { getProviderNoticeMirror } from '../notice/provider-notice-mirror.js';
import type { MirrorDelegates } from '../notice/provider-notice-ports.js';
import { unregisteredMirrorDelegates } from '../notice/provider-notice-ports.js';
import { checkSuccessionTarget } from './succession-target-guard.js';

const logger = createLogger('succession-predecessor');

const ADMITTED_STATUSES = ['ACTIVE', 'CANCEL_SCHEDULED', 'SUSPENDED'] as const;

type AdmittedStatus = (typeof ADMITTED_STATUSES)[number];

/** The validated evidence used by the S1 succession writer. */
export interface AdmittedSuccessionPredecessor {
    readonly predecessorId: string;
    readonly predecessor: typeof subscriptions.$inferSelect;
    readonly basis:
        | 'ACTIVE_CARD_AUTHORIZED'
        | 'CANCEL_SCHEDULED'
        | 'CARD_SUSPENDED_CONFIRMED_CANCELLED';
    readonly authorization: 'authorized' | 'cancelled' | null;
}

/** Ports for the read-only succession admission gate. */
export interface AdmitSuccessionPredecessorPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly mirror?: MirrorDelegates;
}

/**
 * Reloads and validates a candidate predecessor before any succession write.
 * @throws {ServiceError} When the row, its status, or provider evidence is not admitted.
 */
export async function admitSuccessionPredecessor(
    input: { readonly predecessorSubscriptionId: string; readonly userId: string },
    ports: AdmitSuccessionPredecessorPorts
): Promise<AdmittedSuccessionPredecessor> {
    const [row] = await getDb()
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(subscriptions)
        .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.id, input.predecessorSubscriptionId))
        .limit(1);
    if (
        !row ||
        row.subscription.userId !== input.userId ||
        row.subscription.class !== 'PRINCIPAL'
    ) {
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            'Succession predecessor not found',
            undefined,
            'PREDECESSOR_NOT_FOUND'
        );
    }

    const predecessor = row.subscription;
    if (predecessor.succeedsId !== null) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'A succession cannot target another successor',
            undefined,
            'PREDECESSOR_IS_A_SUCCESSOR'
        );
    }

    const status = predecessor.status;
    if (!ADMITTED_STATUSES.includes(status as AdmittedStatus)) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Predecessor status is not admitted for succession',
            { status },
            'PREDECESSOR_STATUS_NOT_ADMITTED'
        );
    }
    if (predecessor.paymentMethod === 'MANUAL') {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Manual payer succession is not available',
            undefined,
            'MANUAL_PAYER_SUCCESSION_NOT_AVAILABLE'
        );
    }

    let basis: AdmittedSuccessionPredecessor['basis'];
    let authorization: AdmittedSuccessionPredecessor['authorization'] = null;
    if (status === 'ACTIVE') {
        if (predecessor.paymentMethod !== 'CARD') {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Card predecessor required',
                undefined,
                'PREDECESSOR_STATUS_NOT_ADMITTED'
            );
        }
        if (!row.providerLink) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Predecessor has no provider link',
                undefined,
                'PREDECESSOR_NO_PROVIDER_LINK'
            );
        }
        const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
        actStartInstant({ act });
        const read = await ports.provider.readAuthorization({
            authorizationId: row.providerLink.providerId
        });
        const { snapshot, readAt } = assertFreshForAct({ read, act });
        if (snapshot.status !== 'active') {
            const action = getProviderNoticeMirror()[snapshot.status].ACTIVE;
            if (action.kind === 'DELEGATE') {
                try {
                    await (ports.mirror ?? unregisteredMirrorDelegates).delegate({
                        pair: action.pair,
                        subscriptionId: predecessor.id,
                        readAt,
                        cancelledSeenAt: row.providerLink.cancelledSeenAt
                    });
                } catch (error) {
                    logger.error(
                        { predecessorId: predecessor.id, error },
                        'Succession mirror delegate failed'
                    );
                }
            }
            const reason =
                snapshot.status === 'paused'
                    ? 'LAST_CHARGE_NOT_ENTERED'
                    : 'PREAPPROVAL_NOT_AUTHORIZED';
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                snapshot.status === 'paused'
                    ? 'Your last payment did not go through; update your card'
                    : 'Preapproval is not authorized',
                { status: snapshot.status },
                reason
            );
        }
        basis = 'ACTIVE_CARD_AUTHORIZED';
        authorization = 'authorized';
    } else if (status === 'CANCEL_SCHEDULED') {
        basis = 'CANCEL_SCHEDULED';
    } else {
        if (predecessor.paymentMethod !== 'CARD') {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Manual payer succession is not available',
                undefined,
                'MANUAL_PAYER_SUCCESSION_NOT_AVAILABLE'
            );
        }
        if (!row.providerLink) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Predecessor has no provider link',
                undefined,
                'PREDECESSOR_NO_PROVIDER_LINK'
            );
        }
        const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
        actStartInstant({ act });
        const read = await ports.provider.readAuthorization({
            authorizationId: row.providerLink.providerId
        });
        const { snapshot } = assertFreshForAct({ read, act });
        if (snapshot.status !== 'cancelled') {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Suspended predecessor preapproval is still live',
                { status: snapshot.status },
                'SUSPENDED_PREAPPROVAL_STILL_LIVE'
            );
        }
        basis = 'CARD_SUSPENDED_CONFIRMED_CANCELLED';
        authorization = 'cancelled';
    }

    const target = await checkSuccessionTarget(
        { targetSubscriptionId: input.predecessorSubscriptionId },
        { provider: ports.provider, clock: ports.clock }
    );
    if (!target.allowed) {
        const reason = `PREDECESSOR_${target.reason}`;
        throw new ServiceError(
            target.reason === 'TARGET_NOT_FOUND'
                ? ServiceErrorCode.NOT_FOUND
                : ServiceErrorCode.VALIDATION_ERROR,
            'Succession predecessor cannot be targeted',
            { targetReason: target.reason },
            reason
        );
    }
    return { predecessorId: predecessor.id, predecessor, basis, authorization };
}
