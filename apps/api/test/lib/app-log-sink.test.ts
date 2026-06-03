/**
 * Tests for the logger db-sink handler (SPEC-184 T-010).
 *
 * The handler is exercised directly via `createAppLogSinkHandler` with an
 * injected service mock — registration on the real hook registry happens in
 * `registerAppLogDbSink`, which is bootstrap-only and not under test here.
 */
import type { LogEntry } from '@repo/logger';
import type { AppLogEntryService } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppLogSinkHandler } from '../../src/lib/app-log-sink';

const makeEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    ts: '2026-06-03T12:00:00.000Z',
    level: 'ERROR',
    message: 'boom',
    ...overrides
});

/** Builds a service mock whose recordEntry resolves (or rejects) as configured. */
const makeServiceMock = () => {
    const recordEntry = vi.fn().mockResolvedValue({});
    return { service: { recordEntry } as unknown as AppLogEntryService, recordEntry };
};

/** Flushes the microtask queue so fire-and-forget .catch() handlers run. */
const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

describe('createAppLogSinkHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('volume guard', () => {
        it.each(['INFO', 'LOG', 'DEBUG'] as const)('should ignore %s entries', (level) => {
            const { service, recordEntry } = makeServiceMock();
            const handler = createAppLogSinkHandler(service);

            handler(makeEntry({ level }));

            expect(recordEntry).not.toHaveBeenCalled();
        });

        it.each(['WARN', 'ERROR'] as const)('should persist %s entries', (level) => {
            const { service, recordEntry } = makeServiceMock();
            const handler = createAppLogSinkHandler(service);

            handler(makeEntry({ level }));

            expect(recordEntry).toHaveBeenCalledOnce();
        });
    });

    describe('entry mapping', () => {
        it('should map all LogEntry fields to the create input', () => {
            const { service, recordEntry } = makeServiceMock();
            const handler = createAppLogSinkHandler(service);

            handler(
                makeEntry({
                    level: 'WARN',
                    category: 'API',
                    label: 'request',
                    message: 'slow request',
                    data: { durationMs: 1500 }
                })
            );

            expect(recordEntry).toHaveBeenCalledWith({
                data: {
                    level: 'WARN',
                    category: 'API',
                    label: 'request',
                    message: 'slow request',
                    data: { durationMs: 1500 },
                    loggedAt: new Date('2026-06-03T12:00:00.000Z')
                }
            });
        });

        it('should default category and label to null when absent', () => {
            const { service, recordEntry } = makeServiceMock();
            const handler = createAppLogSinkHandler(service);

            handler(makeEntry());

            const arg = recordEntry.mock.calls[0]?.[0] as { data: Record<string, unknown> };
            expect(arg.data.category).toBeNull();
            expect(arg.data.label).toBeNull();
            expect(arg.data.data).toBeUndefined();
        });

        it('should wrap a non-object data payload under { value }', () => {
            const { service, recordEntry } = makeServiceMock();
            const handler = createAppLogSinkHandler(service);

            handler(makeEntry({ data: [1, 2, 3] }));

            const arg = recordEntry.mock.calls[0]?.[0] as { data: { data: unknown } };
            expect(arg.data.data).toEqual({ value: [1, 2, 3] });
        });
    });

    describe('failure cooldown (feedback-loop guard)', () => {
        it('should not throw when recordEntry rejects', async () => {
            const { service, recordEntry } = makeServiceMock();
            recordEntry.mockRejectedValue(new Error('db down'));
            const handler = createAppLogSinkHandler(service);

            expect(() => handler(makeEntry())).not.toThrow();
            await flush();
        });

        it('should skip subsequent entries during the cooldown window', async () => {
            const { service, recordEntry } = makeServiceMock();
            recordEntry.mockRejectedValue(new Error('db down'));
            const handler = createAppLogSinkHandler(service);

            handler(makeEntry());
            await flush(); // let the .catch() set the cooldown

            handler(makeEntry({ message: 'second' }));

            expect(recordEntry).toHaveBeenCalledTimes(1);
        });

        it('should keep separate cooldown state per handler instance', async () => {
            const failing = makeServiceMock();
            failing.recordEntry.mockRejectedValue(new Error('db down'));
            const failingHandler = createAppLogSinkHandler(failing.service);
            failingHandler(makeEntry());
            await flush();

            const healthy = makeServiceMock();
            const healthyHandler = createAppLogSinkHandler(healthy.service);
            healthyHandler(makeEntry());

            expect(healthy.recordEntry).toHaveBeenCalledOnce();
        });
    });
});
