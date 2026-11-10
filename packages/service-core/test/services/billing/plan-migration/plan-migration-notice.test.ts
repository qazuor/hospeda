import { type DrizzleClient, emailOutboxModel } from '@repo/db';
import { getLocalDateString } from '@repo/utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    enqueuePlanMigrationNotice,
    PLAN_MIGRATION_ANNOUNCED_TEMPLATE,
    planMigrationNoticeDedupKey
} from '../../../../src/services/billing/plan-migration/plan-migration-notice.js';

afterEach(() => vi.restoreAllMocks());

describe('TEST:B12:3 AC:B12:3 el correo del anuncio usa una clave estable por fila y día local', () => {
    it('uses the same key for two clocks on the announcement day', () => {
        const input = {
            recipientUserId: '1a111111-1111-4111-8111-111111111111',
            template: PLAN_MIGRATION_ANNOUNCED_TEMPLATE,
            planMigrationSubscriptionId: '2b222222-2222-4222-8222-222222222222',
            milestone: 'mig:announce'
        };
        const first = planMigrationNoticeDedupKey({
            ...input,
            targetDate: getLocalDateString({ instant: new Date('2026-10-11T12:00:00.000Z') })
        });
        const second = planMigrationNoticeDedupKey({
            ...input,
            targetDate: getLocalDateString({ instant: new Date('2026-10-11T20:00:00.000Z') })
        });
        expect(first).toBe(second);
        expect(first).toBe(
            `${input.recipientUserId}|${input.template}|pms:${input.planMigrationSubscriptionId}:mig:announce:2026-10-11`
        );
    });

    it('repeating the enqueue passes the same key and transaction to the outbox', async () => {
        const seen = new Set<string>();
        const enqueue = vi.spyOn(emailOutboxModel, 'enqueue').mockImplementation(async (input) => {
            const enqueued = !seen.has(input.dedupKey);
            seen.add(input.dedupKey);
            return { enqueued, row: null };
        });
        const tx = {} as DrizzleClient;
        const input = {
            tx,
            template: PLAN_MIGRATION_ANNOUNCED_TEMPLATE,
            row: {
                id: '2b222222-2222-4222-8222-222222222222',
                recipientUserId: '1a111111-1111-4111-8111-111111111111',
                recipientEmail: 'customer@example.test'
            },
            milestone: 'mig:announce',
            targetDate: '2026-10-11',
            payload: {
                planMigrationId: '3c333333-3333-4333-8333-333333333333',
                planMigrationSubscriptionId: '2b222222-2222-4222-8222-222222222222',
                subscriptionId: '4d444444-4444-4444-8444-444444444444',
                vertical: 'accommodation',
                planName: 'Plan actual',
                targetPlanName: 'Plan nuevo',
                direction: 'UP' as const,
                currentAmountMinor: 100000,
                newAmountMinor: 150000,
                currency: 'ARS',
                applicationDate: '2027-01-11',
                losesPromo: false,
                variant: 'SCHEDULED' as const,
                deadlinesVersion: 1
            }
        };
        expect(await enqueuePlanMigrationNotice(input)).toEqual({ enqueued: true });
        expect(await enqueuePlanMigrationNotice(input)).toEqual({ enqueued: false });
        expect(enqueue).toHaveBeenCalledTimes(2);
        expect(
            enqueue.mock.calls.map(([mail, passedTx]) => ({ key: mail.dedupKey, tx: passedTx }))
        ).toEqual([
            {
                key: planMigrationNoticeDedupKey({
                    recipientUserId: input.row.recipientUserId,
                    template: input.template,
                    planMigrationSubscriptionId: input.row.id,
                    milestone: input.milestone,
                    targetDate: input.targetDate
                }),
                tx
            },
            {
                key: planMigrationNoticeDedupKey({
                    recipientUserId: input.row.recipientUserId,
                    template: input.template,
                    planMigrationSubscriptionId: input.row.id,
                    milestone: input.milestone,
                    targetDate: input.targetDate
                }),
                tx
            }
        ]);
    });
});
