import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient, EnqueueEmailInput } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { PRE_EXPIRY_CAMPAIGN_OFFSETS_DAYS, RECOVERY_CAMPAIGN_OFFSETS_DAYS } from '@repo/verticals';
import { describe, expect, it, vi } from 'vitest';
import { apiLogger } from '../../../src/utils/logger';
import {
    buildTrialCampaignOutbox,
    TRIAL_CAMPAIGN_TEMPLATES,
    type TrialCampaignOutboxDependencies
} from '../../../src/utils/trial/trial-campaign-outbox';

vi.mock('@repo/db', async (importOriginal) => ({ ...(await importOriginal()) }));

const tx = {} as DrizzleClient;
const now = new Date('2026-10-10T12:00:00.000Z');
const clock: Clock = { now: () => now };
const dates = [10, 5, 2, 0].map(
    (days) => new Date(Date.parse('2026-10-20T02:00:00.000Z') - days * 86_400_000)
);

function harness(
    options: {
        readonly email?: string | null;
        readonly outcomes?: readonly ('inserted' | 'merged' | 'refused')[];
    } = {}
) {
    let outcomeIndex = 0;
    const enqueueOrMerge = vi.fn<TrialCampaignOutboxDependencies['enqueueOrMerge']>(async () => ({
        outcome: 'inserted'
    }));
    const enqueue = vi.fn(async (_input: EnqueueEmailInput, _transaction: DrizzleClient) => ({
        enqueued: true,
        row: null
    }));
    const withdraw = vi.fn<TrialCampaignOutboxDependencies['withdraw']>(async () => ({
        withdrawn: 0,
        cancelled: 0
    }));
    const readRecipient = vi.fn(async () => ({
        email: options.email === undefined ? 'person@example.test' : options.email,
        displayName: 'Test Person'
    }));
    enqueueOrMerge.mockImplementation(async () => ({
        outcome: options.outcomes?.[outcomeIndex++] ?? 'inserted'
    }));
    return {
        enqueueOrMerge,
        enqueue,
        withdraw,
        readRecipient,
        ports: buildTrialCampaignOutbox({
            tx,
            clock,
            deps: { enqueueOrMerge, enqueue, withdraw, readRecipient }
        })
    };
}

describe('trial campaign outbox adapter', () => {
    it('uses exactly the versioned deadline offsets and computes market date and midnight', async () => {
        expect(
            Object.keys(TRIAL_CAMPAIGN_TEMPLATES.PRE_EXPIRY)
                .map(Number)
                .sort((a, b) => a - b)
        ).toEqual([...PRE_EXPIRY_CAMPAIGN_OFFSETS_DAYS].sort((a, b) => a - b));
        expect(
            Object.keys(TRIAL_CAMPAIGN_TEMPLATES.RECOVERY)
                .map(Number)
                .sort((a, b) => a - b)
        ).toEqual([...RECOVERY_CAMPAIGN_OFFSETS_DAYS].sort((a, b) => a - b));
        const h = harness();
        await h.ports.scheduleExpiryCampaign({
            userId: 'user-1',
            vertical: VerticalEnum.ACCOMMODATION,
            endsAt: new Date('2026-10-20T02:00:00.000Z'),
            deadlinesVersion: 1,
            milestones: dates
        });
        const todayNotice = h.enqueueOrMerge.mock.calls.find(
            ([input]) => input.template === 'trial_ending_today'
        )?.[0];
        expect(todayNotice).toMatchObject({
            sendAfter: new Date('2026-10-19T03:00:00.000Z'),
            payload: { targetDate: '2026-10-19', milestone: 'pre:0d' }
        });
        expect(h.withdraw).toHaveBeenCalledBefore(h.enqueueOrMerge);
        expect(h.withdraw).toHaveBeenCalledWith(
            expect.objectContaining({ reason: 'trial-rescheduled', vertical: 'accommodation' })
        );
    });

    it('skips past target days and keeps today', async () => {
        const h = harness();
        await h.ports.scheduleExpiryCampaign({
            userId: 'u',
            vertical: VerticalEnum.ACCOMMODATION,
            endsAt: now,
            deadlinesVersion: 1,
            milestones: [
                new Date('2026-10-09T12:00:00Z'),
                now,
                new Date('2026-10-11T12:00:00Z'),
                new Date('2026-10-12T12:00:00Z')
            ]
        });
        expect(h.enqueueOrMerge.mock.calls.map(([input]) => input.payload.targetDate)).toEqual([
            '2026-10-10',
            '2026-10-11',
            '2026-10-12'
        ]);
    });

    it('does not withdraw recovery rows and cancels only the selected campaign templates and vertical', async () => {
        const h = harness();
        await h.ports.scheduleRecoveryCampaign({
            userId: 'u',
            vertical: VerticalEnum.GASTRONOMY,
            expiredAt: now,
            deadlinesVersion: 1,
            milestones: RECOVERY_CAMPAIGN_OFFSETS_DAYS.map(
                (days) => new Date(now.getTime() + days * 86_400_000)
            )
        });
        expect(h.withdraw).not.toHaveBeenCalled();
        await h.ports.cancelCampaign({
            userId: 'u',
            vertical: VerticalEnum.GASTRONOMY,
            campaign: 'RECOVERY'
        });
        expect(h.withdraw).toHaveBeenCalledWith(
            expect.objectContaining({
                templates: Object.values(TRIAL_CAMPAIGN_TEMPLATES.RECOVERY),
                vertical: 'gastronomy',
                reason: 'trial-converted'
            })
        );
    });

    it('uses a vertical-specific occurrence when a shared row was already claimed or sent', async () => {
        const h = harness({ outcomes: ['refused'] });
        await h.ports.scheduleExpiryCampaign({
            userId: 'user-id',
            vertical: VerticalEnum.EXPERIENCE,
            endsAt: now,
            deadlinesVersion: 2,
            milestones: [now, now, now, now]
        });
        expect(h.enqueue).toHaveBeenCalledWith(
            expect.objectContaining({
                dedupKey: expect.stringContaining('trial:user-id.experience:'),
                payload: expect.objectContaining({ verticals: ['experience'] })
            }),
            tx
        );
    });

    it('does not enqueue without an email and rejects a mismatched milestone count', async () => {
        const noEmail = harness({ email: null });
        const logSpy = vi.spyOn(apiLogger, 'warn');
        await noEmail.ports.scheduleRecoveryCampaign({
            userId: 'u',
            vertical: VerticalEnum.ACCOMMODATION,
            expiredAt: now,
            deadlinesVersion: 1,
            milestones: RECOVERY_CAMPAIGN_OFFSETS_DAYS.map(
                (days) => new Date(now.getTime() + days * 86_400_000)
            )
        });
        expect(noEmail.enqueueOrMerge).not.toHaveBeenCalled();
        expect(noEmail.readRecipient).toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'u', vertical: 'accommodation' }),
            expect.any(String)
        );
        expect(JSON.stringify(logSpy.mock.calls)).not.toContain('person@example.test');
        logSpy.mockRestore();
        const invalid = harness();
        await expect(
            invalid.ports.scheduleExpiryCampaign({
                userId: 'u',
                vertical: VerticalEnum.ACCOMMODATION,
                endsAt: now,
                deadlinesVersion: 1,
                milestones: []
            })
        ).rejects.toThrow();
    });
});
