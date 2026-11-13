import {
    coverageLosses,
    emailOutbox,
    eq,
    inArray,
    providerLinks,
    subscriptionPauses,
    subscriptions,
    users
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createSuccessionCloser } from '../../../../src/services/billing/subscription/succession-closer.service.js';
import { getServiceTestDb } from '../helpers.js';
import { frozenClock, seedCoveragePlanVersion, seedCoverageUser } from './coverage-fixtures.js';
import { outboxBeforeCancelNotice } from './outbox-before-cancel-notice.js';

/** Fixed S17 clock used by every fixture. */
export const s17Now = new Date('2026-11-13T12:00:00.000Z');
const clock = frozenClock(s17Now);
const owned: {
    userId: string;
    predecessorId: string;
    successorId: string;
}[] = [];

/** Creates two real fake authorizations and S1/S2-shaped succession rows. */
export async function seedS17(input: {
    readonly predecessorStatus?:
        | 'ACTIVE'
        | 'GRACE_PERIOD'
        | 'CANCEL_SCHEDULED'
        | 'PAUSED'
        | 'SUSPENDED'
        | 'CANCELLED';
    readonly successorStatus?: 'ACTIVE' | 'PENDING_AUTHORIZATION';
    readonly predecessorCancelled?: boolean;
}) {
    const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
    const authorize = async (label: string) => {
        const created = await fake.authorize({
            reference: `s17-${label}-${crypto.randomUUID()}`,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'S17 integration',
            returnUrl: 'https://example.test/return',
            payerEmail: `s17-${crypto.randomUUID()}@example.test`
        });
        await fake.approve({ authorizationId: created.authorizationId });
        return created.authorizationId;
    };
    const predecessorAuthorizationId = await authorize('predecessor');
    const successorAuthorizationId = await authorize('successor');
    if (input.predecessorCancelled || input.predecessorStatus === 'SUSPENDED')
        await fake.cancel({ authorizationId: predecessorAuthorizationId });
    const db = getServiceTestDb();
    const ids = await db.transaction(async (tx) => {
        const { userId } = await seedCoverageUser(tx);
        const { planVersionId, billingOptionId } = await seedCoveragePlanVersion(
            tx,
            'accommodation'
        );
        const [predecessor] = await tx
            .insert(subscriptions)
            .values({
                userId,
                vertical: 'accommodation',
                planVersionId,
                billingOptionId,
                paymentMethod: 'CARD',
                class: 'PRINCIPAL',
                status: input.predecessorStatus ?? 'ACTIVE',
                ...(input.predecessorStatus === 'CANCEL_SCHEDULED'
                    ? { serviceEndsAt: new Date('2026-12-13T12:00:00Z') }
                    : {})
            })
            .returning({ id: subscriptions.id });
        if (!predecessor) throw new Error('S17 predecessor missing');
        const [successor] = await tx
            .insert(subscriptions)
            .values({
                userId,
                vertical: 'accommodation',
                planVersionId,
                billingOptionId,
                paymentMethod: 'CARD',
                class: 'PRINCIPAL',
                status: input.successorStatus ?? 'ACTIVE',
                succeedsId: predecessor.id
            })
            .returning({ id: subscriptions.id });
        if (!successor) throw new Error('S17 successor missing');
        await tx
            .update(subscriptions)
            .set({ succeededById: successor.id })
            .where(eq(subscriptions.id, predecessor.id));
        await tx.insert(providerLinks).values([
            {
                subscriptionId: predecessor.id,
                provider: 'MERCADO_PAGO',
                providerId: predecessorAuthorizationId
            },
            {
                subscriptionId: successor.id,
                provider: 'MERCADO_PAGO',
                providerId: successorAuthorizationId
            }
        ]);
        if (input.predecessorStatus === 'PAUSED')
            await tx.insert(subscriptionPauses).values({
                subscriptionId: predecessor.id,
                reason: 'CUSTOMER_REQUEST',
                requestedMonths: 2,
                startsAt: new Date('2026-11-12T12:00:00Z'),
                expectedEndAt: new Date('2027-01-12T12:00:00Z')
            });
        return {
            userId,
            predecessorId: predecessor.id,
            successorId: successor.id
        };
    });
    owned.push(ids);
    const calls: string[] = [];
    const provider = new Proxy(fake as PaymentProvider, {
        get(target, property, receiver) {
            if (property === 'cancel')
                return async (args: { readonly authorizationId: string }) => {
                    calls.push(args.authorizationId);
                    return fake.cancel(args);
                };
            const value: unknown = Reflect.get(target, property, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    });
    return { ...ids, fake, provider, calls, predecessorAuthorizationId, successorAuthorizationId };
}

/** Real S17 ports with a real outbox adapter and S18 closer. */
export function s17Ports(
    provider: PaymentProvider,
    notice: { readonly deliver?: boolean; readonly failWith?: string } = {}
) {
    return {
        provider,
        clock,
        beforeCancelNotice: outboxBeforeCancelNotice(notice),
        successionCloser: createSuccessionCloser({ clock }),
        coverageNotices: { emitCoverageChanged: async () => undefined }
    };
}

/** Deletes only rows seeded by this test file after each case. */
export async function retireS17(): Promise<void> {
    const db = getServiceTestDb();
    for (const row of owned.splice(0)) {
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, row.userId));
        await db.delete(coverageLosses).where(eq(coverageLosses.userId, row.userId));
        await db
            .delete(subscriptionPauses)
            .where(eq(subscriptionPauses.subscriptionId, row.predecessorId));
        await db
            .delete(providerLinks)
            .where(inArray(providerLinks.subscriptionId, [row.predecessorId, row.successorId]));
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', serviceEndsAt: s17Now })
            .where(eq(subscriptions.id, row.successorId));
        await db
            .update(subscriptions)
            .set({ succeededById: null })
            .where(eq(subscriptions.id, row.predecessorId));
        await db.delete(subscriptions).where(eq(subscriptions.id, row.successorId));
        await db.delete(subscriptions).where(eq(subscriptions.id, row.predecessorId));
        await db.delete(users).where(eq(users.id, row.userId));
    }
}
