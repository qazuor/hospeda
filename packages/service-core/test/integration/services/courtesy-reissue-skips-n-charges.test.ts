import { and, eq, isNull, subscriptionPauses, subscriptions } from '@repo/db';
import { addCalendarMonths } from '@repo/utils';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { reissueDeferredCourtesy } from '../../../src/services/billing/subscription/reissue-deferred-courtesy.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    retireReissueCourtesyCase,
    seedReissueCourtesyCase
} from './support/reissue-courtesy-fixtures.js';

const fixtures: Awaited<ReturnType<typeof seedReissueCourtesyCase>>[] = [];
afterEach(async () => {
    while (fixtures.length) {
        const fixture = fixtures.pop();
        if (fixture) await retireReissueCourtesyCase({ ids: fixture.ids });
    }
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('LISTA:B9 clause 6 (support) AC:B9b:11', () => {
    it('reissued N = 3 months skips exactly three monthly charges after successor credit', async () => {
        const fixture = await seedReissueCourtesyCase();
        fixtures.push(fixture);
        const creditEnd = new Date('2027-01-12T12:00:00.000Z');
        await getServiceTestDb()
            .update(subscriptions)
            .set({ firstChargeAt: creditEnd })
            .where(eq(subscriptions.id, fixture.ids.successor.id));
        const result = await reissueDeferredCourtesy(
            { successorSubscriptionId: fixture.ids.successor.id },
            fixture
        );
        expect(result).toMatchObject({ outcome: 'REISSUED', months: 3 });
        const [pause] = await getServiceTestDb()
            .select()
            .from(subscriptionPauses)
            .where(
                and(
                    eq(subscriptionPauses.subscriptionId, fixture.ids.successor.id),
                    isNull(subscriptionPauses.actualEndAt)
                )
            );
        expect(pause).toBeDefined();
        expect(pause?.expectedEndAt).toBeInstanceOf(Date);
        const chargeDates = Array.from({ length: 4 }, (_, months) =>
            addCalendarMonths({ from: creditEnd, months, dayOverflow: 'clamp' })
        );
        const skipped = chargeDates.filter(
            (date) => date >= pause!.startsAt && date < pause!.expectedEndAt!
        );
        expect(skipped).toEqual(chargeDates.slice(0, 3));
        expect(chargeDates[3]!.getTime()).toBeGreaterThanOrEqual(pause!.expectedEndAt!.getTime());
    });
});
