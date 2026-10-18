import {
    and,
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutbox,
    eq,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { mirrorOurCancellationOnActive } from '../../../src/services/billing/notice/mirror-our-cancellation-on-active.js';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    complementNow,
    providerHarness,
    retireComplementRows,
    seedCommittedComplement
} from './support/complement-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

afterEach(retireComplementRows);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:1623:1 AC:B13a:17 R18 mirror notice', () => {
    it('a — enqueues one row with its payload and stable dedup key when recurring addons are cut', async () => {
        const harness = providerHarness();
        const seeded = await seedCommittedComplement({
            fake: harness.fake,
            principalStatus: 'ACTIVE',
            scopeType: 'VERTICAL_SUBSCRIPTION'
        });
        await outboxBeforeCancelNotice({ deliver: true }).beforeCancel({
            subscriptionId: seeded.principalId,
            userId: seeded.userId,
            kind: 'ARREARS_SUSPENSION'
        });
        await getServiceTestDb().transaction((tx) =>
            openReconciliationMark({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: seeded.complementId },
                reason: 'PAUSA_NO_APLICADA',
                actor: { type: 'job' },
                correlationId: crypto.randomUUID(),
                tx
            })
        );
        const result = await mirrorOurCancellationOnActive(
            { subscriptionId: seeded.principalId, readAt: complementNow, everyMonths: 1 },
            {
                clock: { now: () => complementNow },
                complements: seeded.policy,
                provider: harness.provider,
                beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true })
            }
        );
        expect(result.outcome).toBe('SCHEDULED');
        const [principal] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.principalId));
        const rows = await getServiceTestDb()
            .select()
            .from(emailOutbox)
            .where(
                and(
                    eq(emailOutbox.recipientUserId, seeded.userId),
                    eq(emailOutbox.template, 'billing.paid-after-cancellation')
                )
            );
        expect(rows).toHaveLength(1);
        expect(rows[0]?.payload).toEqual({
            subscriptionId: seeded.principalId,
            vertical: 'accommodation',
            serviceEndsAt: principal?.serviceEndsAt?.toISOString(),
            recurringAddonsCut: true
        });
        expect(rows[0]?.dedupKey).toBe(
            buildEmailDedupKey({
                recipient: seeded.userId,
                template: 'billing.paid-after-cancellation',
                occurrence: buildEventOccurrence({ eventId: seeded.principalId })
            })
        );
    });

    it('b — records false without a complement decision; c — NOT_OURS preserves the full template list; d — replay leaves one row', async () => {
        const harness = providerHarness();
        const seeded = await seedCommittedComplement({
            fake: harness.fake,
            principalStatus: 'ACTIVE',
            scopeType: 'VERTICAL_SUBSCRIPTION',
            complementStatus: 'CANCELLED'
        });
        const list = async () =>
            (
                await getServiceTestDb()
                    .select({ template: emailOutbox.template })
                    .from(emailOutbox)
                    .where(eq(emailOutbox.recipientUserId, seeded.userId))
            )
                .map((row) => row.template)
                .sort();
        const before = await list();
        const notOurs = await mirrorOurCancellationOnActive(
            { subscriptionId: seeded.principalId, readAt: complementNow, everyMonths: 1 },
            { clock: { now: () => complementNow } }
        );
        expect(notOurs.outcome).toBe('NOT_OURS');
        expect(await list()).toEqual(before);
        await outboxBeforeCancelNotice({ deliver: true }).beforeCancel({
            subscriptionId: seeded.principalId,
            userId: seeded.userId,
            kind: 'ARREARS_SUSPENSION'
        });
        const scheduled = await mirrorOurCancellationOnActive(
            { subscriptionId: seeded.principalId, readAt: complementNow, everyMonths: 1 },
            { clock: { now: () => complementNow }, complements: seeded.policy }
        );
        expect(scheduled.outcome).toBe('SCHEDULED');
        expect(await list()).toEqual(
            [...before, 'billing.arrears-suspension', 'billing.paid-after-cancellation'].sort()
        );
        const rows = await getServiceTestDb()
            .select()
            .from(emailOutbox)
            .where(
                and(
                    eq(emailOutbox.recipientUserId, seeded.userId),
                    eq(emailOutbox.template, 'billing.paid-after-cancellation')
                )
            );
        expect(rows[0]?.payload.recurringAddonsCut).toBe(false);
        const replay = await mirrorOurCancellationOnActive(
            { subscriptionId: seeded.principalId, readAt: complementNow, everyMonths: 1 },
            { clock: { now: () => complementNow } }
        );
        expect(replay.outcome).toBe('LOST_RACE');
        expect(
            await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.recipientUserId, seeded.userId),
                        eq(emailOutbox.template, 'billing.paid-after-cancellation')
                    )
                )
        ).toHaveLength(1);
    });
});
