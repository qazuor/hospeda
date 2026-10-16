import { coverageLosses, emailOutbox, eq, inArray, subscriptions } from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { getServiceTestDb } from '../helpers.js';
import {
    cancelActiveNow,
    retireCancelActiveRows,
    seedCancelActive
} from './cancel-active-fixtures.js';

const directRows: string[] = [];
const directUsers: string[] = [];

/** Commits a direct-cancellation row and any optional live successor. */
export async function seedDirectCancellation(input: {
    readonly fake: FakePaymentProvider;
    readonly status: 'SUSPENDED' | 'GRACE_PERIOD';
    readonly paymentMethod?: 'CARD' | 'MANUAL';
    readonly withLink?: boolean;
    readonly preapproval?: 'LIVE' | 'CANCELLED';
    readonly graceStartedAt?: Date;
    readonly graceEndsAt?: Date;
    readonly liveSuccessor?: boolean;
}) {
    const seeded = await seedCancelActive({
        fake: input.fake,
        status: input.status,
        paymentMethod: input.paymentMethod,
        withLink: input.withLink,
        payment: 'none'
    });
    directRows.push(seeded.subscriptionId);
    directUsers.push(seeded.userId);
    if (input.preapproval === 'CANCELLED')
        await input.fake.cancel({ authorizationId: seeded.authorizationId });
    if (input.status === 'GRACE_PERIOD') {
        await getServiceTestDb()
            .update(subscriptions)
            .set({
                graceStartedAt: input.graceStartedAt ?? new Date('2026-10-10T12:00:00.000Z'),
                graceEndsAt: input.graceEndsAt ?? new Date('2026-10-17T12:00:00.000Z')
            })
            .where(eq(subscriptions.id, seeded.subscriptionId));
    }
    let successorId: string | null = null;
    if (input.liveSuccessor) {
        const [predecessor] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId))
            .limit(1);
        if (!predecessor) throw new Error('direct cancellation predecessor missing');
        const [successor] = await getServiceTestDb()
            .insert(subscriptions)
            .values({
                userId: predecessor.userId,
                vertical: predecessor.vertical,
                planVersionId: predecessor.planVersionId,
                billingOptionId: predecessor.billingOptionId,
                paymentMethod: predecessor.paymentMethod,
                status: 'PENDING_AUTHORIZATION',
                class: 'PRINCIPAL',
                succeedsId: predecessor.id
            })
            .returning({ id: subscriptions.id });
        if (!successor) throw new Error('direct cancellation successor missing');
        successorId = successor.id;
        directRows.push(successor.id);
    }
    return { ...seeded, successorId };
}

/** Retires rows owned by these fixtures, then delegates cleanup of the shared S11 seed rows. */
export async function retireCancelDirectRows(): Promise<void> {
    const ids = directRows.splice(0);
    if (ids.length)
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED', serviceEndsAt: cancelActiveNow })
            .where(inArray(subscriptions.id, ids));
    const users = directUsers.splice(0);
    if (users.length) {
        await getServiceTestDb()
            .delete(emailOutbox)
            .where(inArray(emailOutbox.recipientUserId, users));
        await getServiceTestDb()
            .delete(coverageLosses)
            .where(inArray(coverageLosses.userId, users));
    }
    await retireCancelActiveRows();
}
