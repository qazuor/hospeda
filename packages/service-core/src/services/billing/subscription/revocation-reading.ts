import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { eq, getDb, providerLinks, subscriptions } from '@repo/db';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';
import { z } from 'zod';
import type { Actor } from '../../../types';
import { isSystemActor } from '../../../utils/system-actor';
import type { RefundSource } from '../refund/refund-source';
import {
    type RevocablePayment,
    revocationRejection as reject,
    resolveRevokedPayment
} from './revocation-payment';

/** The administrative action S36 executes: one constant for the helper and the step (Coord-178). */
const ACTION = 'ACC_8' as const;

/** The states S36 leaves (TRANS:B:S36 «desde»; PAUSED with either reason). */
export const REVOCATION_ORIGINS = ['ACTIVE', 'GRACE_PERIOD', 'CANCEL_SCHEDULED', 'PAUSED'] as const;

/** One state S36 leaves. */
export type RevocationOrigin = (typeof REVOCATION_ORIGINS)[number];

/** The confirmation of action 8 with reason revocation: the three things it does (D-3). */
export interface SubscriptionRevocationPreview {
    readonly subscriptionId: string;
    readonly origin: RevocationOrigin;
    readonly payment: {
        readonly source: RefundSource['kind'];
        readonly id: string;
        readonly amount: number;
        readonly currency: string | null;
        readonly chargedAt: Date;
        readonly ownerSubscriptionId: string;
    };
    readonly windowEndsAt: Date;
    readonly effects: {
        /** False for a manual payer or a row without provider link: nothing to cancel. */
        readonly cancelsAuthorization: boolean;
        readonly endsServiceAt: 'NOW';
        readonly requestsRefund: true;
    };
}

const idSchema = z.uuid();

function isRevocationOrigin(status: string): status is RevocationOrigin {
    return (REVOCATION_ORIGINS as readonly string[]).includes(status);
}

/** Everything steps a–f decided, read inside one transaction. */
export interface RevocationReading {
    readonly subscriptionId: string;
    readonly userId: string | null;
    readonly vertical: string | null;
    readonly origin: RevocationOrigin;
    readonly authorizationId: string | null;
    readonly cardPayer: boolean;
    readonly payment: RevocablePayment;
    readonly windowEndsAt: Date;
}

/**
 * Steps a–f, shared by the preview and the act. With `lock` the subscription is read
 * `FOR UPDATE` (the act); without it (the read-only preview) it is a plain read. Any read
 * error throws: authorization fails closed, never on partial data.
 */
/** Reads the locked or preview state and validates S36 preconditions. */
export async function readRevocation(input: {
    readonly tx: DrizzleClient;
    readonly actor: Actor;
    readonly subscriptionId: string;
    readonly expectedPaymentId?: string;
    readonly now: Date;
    readonly lock: boolean;
}): Promise<RevocationReading> {
    const { tx } = input;
    // a. the row, locked by the act
    const query = tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId))
        .limit(1);
    const [subscription] = input.lock ? await query.for('update') : await query;
    if (!subscription) throw reject('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');

    // b. step 3 of the administrative action, with the subject read in THIS transaction
    const permitted = isAdministrativeActionPermitted({
        action: ACTION,
        actorPermissions: input.actor.permissions
    });
    const step = resolveAdministrativeActionStep({
        action: ACTION,
        actorId: input.actor.id,
        subjectId: subscription.userId,
        permitted,
        isSystemActor: isSystemActor(input.actor)
    });
    if (!step.allowed) throw reject('ADMINISTRATIVE_ACTION_FORBIDDEN', 'Forbidden');

    // c. only the contract (I-1), only from the four origins
    if (subscription.class !== 'PRINCIPAL')
        throw reject('REVOCATION_NOT_PRINCIPAL', 'Only a principal subscription is revoked');
    if (!isRevocationOrigin(subscription.status))
        throw reject(
            'REVOCATION_STATE_NOT_ALLOWED',
            `A ${subscription.status} subscription cannot be revoked`
        );

    // d–f. the last credited payment through `sucedida_por`, its window, the preview's payment
    const { payment, windowEndsAt } = await resolveRevokedPayment({
        tx,
        subscriptionId: subscription.id,
        now: input.now,
        expectedPaymentId: input.expectedPaymentId,
        lock: input.lock
    });

    const [link] = await tx
        .select({ providerId: providerLinks.providerId })
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, subscription.id))
        .limit(1);
    return {
        subscriptionId: subscription.id,
        userId: subscription.userId,
        vertical: subscription.vertical,
        origin: subscription.status,
        authorizationId: link?.providerId ?? null,
        cardPayer: subscription.paymentMethod === 'CARD',
        payment,
        windowEndsAt
    };
}

/** Reads the S36 preview without writing. */
export async function previewSubscriptionRevocation(
    input: { readonly actor: Actor; readonly subscriptionId: string },
    ports: { readonly clock: Clock }
): Promise<SubscriptionRevocationPreview> {
    if (!idSchema.safeParse(input.subscriptionId).success)
        throw reject('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
    const reading = await getDb().transaction(
        (tx) =>
            readRevocation({
                tx,
                actor: input.actor,
                subscriptionId: input.subscriptionId,
                now: ports.clock.now(),
                lock: false
            }),
        { accessMode: 'read only' }
    );
    return {
        subscriptionId: reading.subscriptionId,
        origin: reading.origin,
        payment: {
            source: reading.payment.source.kind,
            id: reading.payment.source.id,
            amount: reading.payment.amount,
            currency: reading.payment.currency,
            chargedAt: reading.payment.chargedAt,
            ownerSubscriptionId: reading.payment.ownerSubscriptionId
        },
        windowEndsAt: reading.windowEndsAt,
        effects: {
            cancelsAuthorization: reading.cardPayer && reading.authorizationId !== null,
            endsServiceAt: 'NOW',
            requestsRefund: true
        }
    };
}
