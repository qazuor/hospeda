import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getRedisClient: vi.fn(),
    processRetries: vi.fn(),
    trySendNotification: vi.fn()
}));

vi.mock('../../src/utils/redis.js', () => ({ getRedisClient: mocks.getRedisClient }));
vi.mock('../../src/utils/notification-helper.js', () => ({
    trySendNotification: mocks.trySendNotification
}));
vi.mock('@repo/notifications', () => ({
    RetryService: class {
        processRetries = mocks.processRetries;
    }
}));

import { notificationScheduleJob } from '../../src/cron/jobs/notification-schedule.job';

const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('notification schedule after legacy billing removal', () => {
    it('keeps dry run read only', async () => {
        const result = await notificationScheduleJob.handler({
            logger,
            startedAt: new Date(),
            runId: 'run-00000000-test',
            correlationId: '00000000-0000-4000-8000-00000000c0de',
            dryRun: true
        });

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(mocks.getRedisClient).not.toHaveBeenCalled();
    });

    it('leaves queued notifications untouched when Redis is unavailable', async () => {
        mocks.getRedisClient.mockResolvedValue(null);
        const result = await notificationScheduleJob.handler({
            logger,
            startedAt: new Date(),
            runId: 'run-00000000-test',
            correlationId: '00000000-0000-4000-8000-00000000c0de',
            dryRun: false
        });

        expect(result.success).toBe(true);
        expect(mocks.processRetries).not.toHaveBeenCalled();
    });

    it('retries a due general notification and reports actual delivery', async () => {
        mocks.getRedisClient.mockResolvedValue({});
        mocks.trySendNotification.mockResolvedValue({ delivered: true, disposition: 'sent' });
        mocks.processRetries.mockImplementation(
            async (send: (payload: unknown) => Promise<unknown>) => {
                expect(await send({ type: 'general-message' })).toEqual({
                    success: true,
                    error: undefined
                });
                return { processed: 1, succeeded: 1, failed: 0, permanentlyFailed: 0 };
            }
        );
        const result = await notificationScheduleJob.handler({
            logger,
            startedAt: new Date(),
            runId: 'run-00000000-test',
            correlationId: '00000000-0000-4000-8000-00000000c0de',
            dryRun: false
        });

        expect(result.success).toBe(true);
        expect(result.processed).toBe(1);
        expect(result.errors).toBe(0);
    });

    it('does not mark a failed send as delivered', async () => {
        mocks.getRedisClient.mockResolvedValue({});
        mocks.trySendNotification.mockResolvedValue({
            delivered: false,
            disposition: 'send-failed'
        });
        mocks.processRetries.mockImplementation(
            async (send: (payload: unknown) => Promise<unknown>) => {
                expect(await send({ type: 'general-message' })).toEqual({
                    success: false,
                    error: 'send-failed'
                });
                return { processed: 1, succeeded: 0, failed: 1, permanentlyFailed: 0 };
            }
        );
        const result = await notificationScheduleJob.handler({
            logger,
            startedAt: new Date(),
            runId: 'run-00000000-test',
            correlationId: '00000000-0000-4000-8000-00000000c0de',
            dryRun: false
        });

        expect(result.errors).toBe(1);
    });
});
