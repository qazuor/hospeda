import { createAdjustableClock } from '@repo/test-clock';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createEmailOutboxSenderJob,
    type EmailOutboxSenderDeps,
    emailOutboxSenderJob,
    readEmailOutboxSenderNow
} from '../../src/cron/jobs/email-outbox-sender.job';
import type { CronJobContext } from '../../src/cron/types';
import { injectClock } from '../../src/utils/clock';

const STARTED_AT = new Date('2026-01-01T00:00:00.000Z');
const INJECTED_NOW = new Date('2026-02-10T00:00:00.000Z');

function context(): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: STARTED_AT,
        runId: 'run-test-clock',
        correlationId: '00000000-0000-4000-8000-000000000001',
        dryRun: false
    };
}

function deps() {
    const outbox = {
        recoverExpired: vi.fn(async () => []),
        claim: vi.fn(async () => []),
        markSent: vi.fn(async () => true),
        recordFailure: vi.fn(async () => 'failed' as const),
        markFailed: vi.fn(async () => true),
        getRecipientDeletedAt: vi.fn(async () => null)
    };
    const value: EmailOutboxSenderDeps = {
        outbox,
        log: {
            hasHardBounce: vi.fn(async () => false),
            countSentByClassSince: vi.fn(async () => 0),
            recordEmailAttempt: vi.fn(async () => ({}) as never)
        },
        isOptedOut: vi.fn(async () => false),
        render: () => ({ subject: 'subject', react: createElement('p', null, 'body') }),
        transport: { send: vi.fn(async () => ({ messageId: 'id' })) }
    };
    return { value, outbox };
}

describe('TEST:V4:23 support - the outbox sender reads the injected clock', () => {
    beforeEach(() => {
        injectClock({ clock: { now: () => STARTED_AT } });
    });

    it('uses readNow for recovery and claiming instead of ctx.startedAt', async () => {
        const { value, outbox } = deps();
        const job = createEmailOutboxSenderJob({
            buildDeps: () => value,
            readNow: () => INJECTED_NOW
        });
        await job.handler(context());
        expect(outbox.recoverExpired).toHaveBeenCalledWith({ now: INJECTED_NOW });
        expect(outbox.claim).toHaveBeenCalledWith(expect.objectContaining({ now: INJECTED_NOW }));
    });

    it('the registered job reads and follows the adjustable injected clock', async () => {
        const clock = createAdjustableClock({ start: INJECTED_NOW });
        const readClock = vi.fn(clock.now);
        injectClock({ clock: { now: readClock } });
        expect(emailOutboxSenderJob.name).toBe('email-outbox-sender');
        expect(readEmailOutboxSenderNow()).toEqual(INJECTED_NOW);
        const advanced = new Date('2026-02-11T00:00:00.000Z');
        clock.set({ at: advanced });
        expect(readEmailOutboxSenderNow()).toEqual(advanced);
        readClock.mockClear();
        await emailOutboxSenderJob.handler(context());
        expect(readClock).toHaveBeenCalledOnce();
    });
});
