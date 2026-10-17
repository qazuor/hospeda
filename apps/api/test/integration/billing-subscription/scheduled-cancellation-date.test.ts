import { and, emailOutbox, eq, getDb, subscriptions } from '@repo/db';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { beforeCancelNotice } from '../../../src/routes/billing-subscription/before-cancel-notice';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { retireSelfCancelRows, seedSelfState } from './self-cancel-fixtures';

const seededUsers = new Set<string>();

describe('TEST:1617:6 scheduled cancellation carries its committed service end', () => {
    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
    });
    afterEach(async () => {
        for (const userId of seededUsers)
            await getDb().delete(emailOutbox).where(eq(emailOutbox.recipientUserId, userId));
        seededUsers.clear();
        await retireSelfCancelRows();
    });
    afterAll(async () => testDb.teardown());

    it('includes serviceEndsAt only for SCHEDULED_CANCELLATION', async () => {
        const seeded = await seedSelfState('ACTIVE');
        seededUsers.add(seeded.ownerId);
        const serviceEndsAt = new Date('2026-11-05T12:00:00.000Z');
        await getDb()
            .update(subscriptions)
            .set({ serviceEndsAt })
            .where(eq(subscriptions.id, seeded.subscriptionId));

        expect(
            await beforeCancelNotice.beforeCancel({
                subscriptionId: seeded.subscriptionId,
                userId: seeded.ownerId,
                kind: 'SCHEDULED_CANCELLATION'
            })
        ).toBe('NOT_YET_SENT');
        const [scheduled] = await getDb()
            .select({ payload: emailOutbox.payload })
            .from(emailOutbox)
            .where(
                and(
                    eq(emailOutbox.recipientUserId, seeded.ownerId),
                    eq(emailOutbox.template, 'billing.scheduled-cancellation')
                )
            );
        expect(scheduled?.payload).toMatchObject({
            subscriptionId: seeded.subscriptionId,
            serviceEndsAt: serviceEndsAt.toISOString()
        });

        await beforeCancelNotice.beforeCancel({
            subscriptionId: seeded.subscriptionId,
            userId: seeded.ownerId,
            kind: 'DIRECT_CANCELLATION'
        });
        const [direct] = await getDb()
            .select({ payload: emailOutbox.payload })
            .from(emailOutbox)
            .where(
                and(
                    eq(emailOutbox.recipientUserId, seeded.ownerId),
                    eq(emailOutbox.template, 'billing.direct-cancellation')
                )
            );
        expect(direct?.payload).toStrictEqual({ subscriptionId: seeded.subscriptionId });
    });
});
