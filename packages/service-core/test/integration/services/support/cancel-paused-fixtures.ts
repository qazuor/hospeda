import { courtesyGrants, coverageLosses, inArray, subscriptionPauses } from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { getServiceTestDb } from '../helpers.js';
import {
    cancelActiveNow,
    retireCancelActiveRows,
    seedCancelActive
} from './cancel-active-fixtures.js';

const ids: string[] = [];
const owners: string[] = [];
/** Shared fixed clock for S22 integration cases. */
export const pausedNow = cancelActiveNow;

/** Seeds an open pause in the shape written by S8, on a real card or manual principal. */
export async function seedPausedCancellation(input: {
    readonly fake: FakePaymentProvider;
    readonly reason?: 'CUSTOMER_REQUEST' | 'COURTESY';
    readonly status?: string;
    readonly paymentMethod?: 'CARD' | 'MANUAL';
    readonly credit?: { readonly firstChargeAt: Date; readonly windowEndsAt: Date };
}) {
    const seeded = await seedCancelActive({
        fake: input.fake,
        status: input.status ?? 'PAUSED',
        paymentMethod: input.paymentMethod,
        payment: 'none',
        credit: input.credit
    });
    ids.push(seeded.subscriptionId);
    owners.push(seeded.userId);
    if (input.status === undefined || input.status === 'PAUSED') {
        const startsAt = new Date(pausedNow.getTime() - 24 * 60 * 60 * 1000);
        const expectedEndAt = new Date('2026-12-01T00:00:00.000Z');
        await getServiceTestDb()
            .insert(subscriptionPauses)
            .values({
                subscriptionId: seeded.subscriptionId,
                reason: input.reason ?? 'CUSTOMER_REQUEST',
                requestedMonths: 2,
                startsAt,
                expectedEndAt
            });
        if (input.reason === 'COURTESY')
            await getServiceTestDb().insert(courtesyGrants).values({
                beneficiaryUserId: seeded.userId,
                grantedBy: seeded.userId,
                subscriptionId: seeded.subscriptionId,
                months: 2,
                startsAt,
                endsAt: expectedEndAt,
                reason: 'S22 integration fixture'
            });
    }
    return seeded;
}

/** Retires only this test file's paused rows and their owned side effects. */
export async function retirePausedCancellationRows(): Promise<void> {
    const db = getServiceTestDb();
    const subs = ids.splice(0);
    const users = owners.splice(0);
    if (subs.length) {
        await db.delete(courtesyGrants).where(inArray(courtesyGrants.subscriptionId, subs));
        await db.delete(subscriptionPauses).where(inArray(subscriptionPauses.subscriptionId, subs));
    }
    if (users.length) await db.delete(coverageLosses).where(inArray(coverageLosses.userId, users));
    await retireCancelActiveRows();
}
