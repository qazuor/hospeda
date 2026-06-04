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

    describe('failure behavior (no entry is ever dropped)', () => {
        it('should not throw when recordEntry rejects', async () => {
            const { service, recordEntry } = makeServiceMock();
            recordEntry.mockRejectedValue(new Error('db down'));
            const handler = createAppLogSinkHandler(service);

            expect(() => handler(makeEntry())).not.toThrow();
            await flush();
        });

        it('should still attempt subsequent entries after a failure', async () => {
            const { service, recordEntry } = makeServiceMock();
            recordEntry.mockRejectedValue(new Error('db down'));
            const handler = createAppLogSinkHandler(service);

            handler(makeEntry());
            await flush();

            handler(makeEntry({ message: 'second' }));
            await flush();

            // The feedback loop is prevented by the quiet insert path, not by
            // dropping entries — every WARN/ERROR must be attempted.
            expect(recordEntry).toHaveBeenCalledTimes(2);
        });

        it('should report failures to stderr, throttled to one report per window', async () => {
            const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
            const { service, recordEntry } = makeServiceMock();
            recordEntry.mockRejectedValue(new Error('db down'));
            const handler = createAppLogSinkHandler(service);

            handler(makeEntry());
            await flush();
            handler(makeEntry({ message: 'second' }));
            await flush();

            // Both inserts attempted, but only the first failure is reported
            // within the throttle window.
            expect(recordEntry).toHaveBeenCalledTimes(2);
            expect(stderr).toHaveBeenCalledTimes(1);
            expect(String(stderr.mock.calls[0]?.[0])).toContain('app-log-sink');
        });
    });
});
