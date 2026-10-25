import { afterAll, describe, expect, it } from 'vitest';
import { sendGraceReminders } from '../../../src/services/billing/subscription/send-grace-reminders.service.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import { graceFixture } from './support/grace-fixtures.js';
import {
    configureGraceReminderSubscription,
    insertGraceReminderDeadline,
    readGraceReminderOutbox
} from './support/grace-reminder-fixtures.js';

afterAll(closeServiceTestPool);

const instant = (day: string) => new Date(`${day}T15:00:00.000Z`);

describe('TEST:1707:3-4 AC:1707:3-4 grace reminders', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'enqueues with the grace reminder configuration published by the empty-database migration',
        async () => {
            const fixture = await graceFixture();
            await configureGraceReminderSubscription({
                subscriptionId: fixture.started.subscriptionId,
                startedAt: instant('2099-03-01'),
                endsAt: instant('2099-03-20')
            });
            const result = await sendGraceReminders(
                { limit: 1000 },
                { clock: { now: () => instant('2099-03-17') } }
            );
            expect(result.enqueued).toBe(1);
            const rows = await readGraceReminderOutbox(fixture.started.subscriptionId);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.payload).toMatchObject({
                subscriptionId: fixture.started.subscriptionId,
                daysBefore: 3,
                deadlinesVersion: 2
            });
            await configureGraceReminderSubscription({
                subscriptionId: fixture.started.subscriptionId,
                startedAt: instant('2099-03-01'),
                endsAt: instant('2099-03-20'),
                status: 'SUSPENDED'
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'enqueues each frozen milestone once and ignores subscriptions outside grace',
        async () => {
            const fixture = await graceFixture();
            await insertGraceReminderDeadline({
                version: 81707001,
                createdAt: instant('2099-01-01'),
                daysBefore: [3, 1]
            });
            const startedAt = instant('2099-02-01');
            const endsAt = instant('2099-02-11');
            await insertGraceReminderDeadline({
                version: 81707002,
                createdAt: instant('2099-02-07'),
                daysBefore: [1]
            });
            await configureGraceReminderSubscription({
                subscriptionId: fixture.started.subscriptionId,
                startedAt,
                endsAt
            });
            let today = instant('2099-02-08');
            const run = (readRecipientEmail?: (userId: string) => Promise<string | null>) =>
                sendGraceReminders(
                    { limit: 1000 },
                    { clock: { now: () => today }, readRecipientEmail }
                );
            expect((await run()).enqueued).toBe(1);
            expect((await run()).alreadyEnqueued).toBe(1);
            let rows = await readGraceReminderOutbox(fixture.started.subscriptionId);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.dedupKey).toContain(`grace:-3d:2099-02-11`);
            expect(rows[0]?.payload).toMatchObject({
                subscriptionId: fixture.started.subscriptionId,
                daysBefore: 3,
                deadlinesVersion: 81707001
            });
            await insertGraceReminderDeadline({
                version: 81707003,
                createdAt: instant('2099-02-09'),
                daysBefore: [1]
            });
            today = instant('2099-02-10');
            expect((await run()).enqueued).toBe(1);
            rows = await readGraceReminderOutbox(fixture.started.subscriptionId);
            expect(rows).toHaveLength(2);
            expect(rows.map(({ dedupKey }) => dedupKey).join('\n')).toContain(
                'grace:-1d:2099-02-11'
            );
            await configureGraceReminderSubscription({
                subscriptionId: fixture.started.subscriptionId,
                startedAt,
                endsAt,
                status: 'ACTIVE'
            });
            expect((await run()).enqueued).toBe(0);
            expect(await readGraceReminderOutbox(fixture.started.subscriptionId)).toHaveLength(2);
            await configureGraceReminderSubscription({
                subscriptionId: fixture.started.subscriptionId,
                startedAt: instant('2099-02-01'),
                endsAt: instant('2099-02-11'),
                status: 'SUSPENDED'
            });
            expect((await run()).enqueued).toBe(0);
            expect(await readGraceReminderOutbox(fixture.started.subscriptionId)).toHaveLength(2);

            await configureGraceReminderSubscription({
                subscriptionId: fixture.started.subscriptionId,
                startedAt: instant('2099-02-01'),
                endsAt: instant('2099-02-09')
            });
            today = instant('2099-02-10');
            expect((await run()).enqueued).toBe(0);
            expect(await readGraceReminderOutbox(fixture.started.subscriptionId)).toHaveLength(2);

            await insertGraceReminderDeadline({
                version: 81707004,
                createdAt: instant('2099-02-12')
            });
            await configureGraceReminderSubscription({
                subscriptionId: fixture.started.subscriptionId,
                startedAt: instant('2099-02-13'),
                endsAt: instant('2099-02-20')
            });
            today = instant('2099-02-19');
            expect((await run()).noDeadline).toBe(1);
            expect(await readGraceReminderOutbox(fixture.started.subscriptionId)).toHaveLength(2);

            await insertGraceReminderDeadline({
                version: 81707005,
                createdAt: instant('2099-02-20'),
                daysBefore: [1]
            });
            await configureGraceReminderSubscription({
                subscriptionId: fixture.started.subscriptionId,
                startedAt: instant('2099-02-21'),
                endsAt: instant('2099-02-28')
            });
            today = instant('2099-02-27');
            expect((await run(async () => null)).skipped).toBe(1);
            expect(await readGraceReminderOutbox(fixture.started.subscriptionId)).toHaveLength(2);
        }
    );
});
