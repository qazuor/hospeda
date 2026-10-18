import {
    eq,
    providerLinks,
    reconciliationMarkModel,
    reconciliationTerminalReturnModel,
    subscriptions
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { liftReconciliationMarkByAdmin } from '../../../src/services/billing/reconciliation/lift-reconciliation-mark-by-admin.service.js';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import {
    decideTerminalStay,
    terminalHoldCutoffs
} from '../../../src/services/billing/reconciliation/sweep/terminal-hold.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import { liftOpenMarkAsAdmin, seedLiftAdmin } from './support/admin-lift-fixtures.js';
import { seedTerminalRow } from './support/terminal-return-fixtures.js';

const clock = { now: () => new Date('2026-11-01T10:00:00.000Z') };
const ids: string[] = [];
afterAll(closeServiceTestPool);
afterEach(async () => {
    const db = getServiceTestDb();
    for (const id of ids.splice(0)) {
        const mark = await reconciliationMarkModel.findOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: id },
            reason: 'TRANSICION_NO_DECLARADA'
        });
        if (mark)
            await liftOpenMarkAsAdmin({
                subscriptionId: id,
                reason: 'TRANSICION_NO_DECLARADA',
                clock
            });
        await db.update(subscriptions).set({ status: 'ACTIVE' }).where(eq(subscriptions.id, id));
    }
});

describe('TEST:1697:9 AC:1697:4 terminal return reads a lifted mark', () => {
    it('(b) an admin lift removes OPEN_MARK from the seeded terminal row', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const seeded = await seedTerminalRow({ status: 'CANCELLED', fake });
        const subscriptionId = seeded.subscription.id;
        ids.push(subscriptionId);
        const seenAt = clock.now();
        await getServiceTestDb()
            .update(providerLinks)
            .set({ cancelledSeenAt: seenAt })
            .where(eq(providerLinks.subscriptionId, subscriptionId));
        const opened = await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId },
            reason: 'TRANSICION_NO_DECLARADA',
            actor: { type: 'admin', id: seeded.subscription.userId! },
            correlationId: crypto.randomUUID()
        });
        const now = new Date(seenAt.getTime() - 60_000);
        const holdCutoffs = terminalHoldCutoffs({
            now,
            window16Days: 7
        });
        const before = (
            await reconciliationTerminalReturnModel.listTerminalReturnPage({
                limit: 10_000,
                holdCutoffs
            })
        ).find(({ subscription }) => subscription.id === subscriptionId);
        expect(before).toBeDefined();
        expect(before?.hasOpenMark).toBe(true);
        const decide = (row: NonNullable<typeof before>) =>
            decideTerminalStay({
                hasOpenMark: row.hasOpenMark,
                hasOpenRetention: row.hasOpenRetention,
                rejectionTerminal: row.rejectionTerminal,
                cancelledSeenAt: seenAt,
                now,
                window16Days: 7
            });
        expect(decide(before!)).toBe('OPEN_MARK');
        await liftReconciliationMarkByAdmin(
            {
                actor: await seedLiftAdmin(),
                markId: opened.mark.id,
                expectedVersion: opened.mark.version,
                resolveWithoutRefund: []
            },
            { clock }
        );
        const after = (
            await reconciliationTerminalReturnModel.listTerminalReturnPage({
                limit: 10_000,
                holdCutoffs
            })
        ).find(({ subscription }) => subscription.id === subscriptionId);
        expect(after).toBeDefined();
        expect(after?.hasOpenMark).toBe(false);
        expect(decide(after!)).toBeNull();
    });
});
