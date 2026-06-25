/**
 * Tests for the audit-log persister (SPEC-162).
 *
 * The persister is exercised directly via `createAuditLogPersister` with an
 * injected service mock — registration with the audit logger happens in
 * `registerAuditLogPersistence`, which is bootstrap-only and not under test here.
 */
import type { CreateAuditLogEntry } from '@repo/schemas';
import type { AuditLogEntryService } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuditLogPersister } from '../../src/lib/audit-log-sink';

const makeRecord = (overrides: Partial<CreateAuditLogEntry> = {}): CreateAuditLogEntry => ({
    logType: 'audit',
    eventType: 'billing.mutation',
    severity: 'critical',
    message: 'billing.mutation',
    loggedAt: new Date('2026-06-03T12:00:00.000Z'),
    ...overrides
});

/** Builds a service mock whose recordEntry resolves (or rejects) as configured. */
const makeServiceMock = () => {
    const recordEntry = vi.fn().mockResolvedValue({});
    return { service: { recordEntry } as unknown as AuditLogEntryService, recordEntry };
};

/** Flushes the microtask queue so fire-and-forget .catch() handlers run. */
const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

describe('createAuditLogPersister', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('forwards the record to recordEntry', () => {
        const { service, recordEntry } = makeServiceMock();
        const persist = createAuditLogPersister(service);

        const record = makeRecord({ logType: 'security', eventType: 'auth.login.failed' });
        persist(record);

        expect(recordEntry).toHaveBeenCalledWith({ data: record });
    });

    describe('failure behavior (no entry is ever dropped)', () => {
        it('does not throw when recordEntry rejects', async () => {
            const { service, recordEntry } = makeServiceMock();
            recordEntry.mockRejectedValue(new Error('db down'));
            const persist = createAuditLogPersister(service);

            expect(() => persist(makeRecord())).not.toThrow();
            await flush();
        });

        it('still attempts subsequent entries after a failure', async () => {
            const { service, recordEntry } = makeServiceMock();
            recordEntry.mockRejectedValue(new Error('db down'));
            const persist = createAuditLogPersister(service);

            persist(makeRecord());
            await flush();
            persist(makeRecord({ message: 'second' }));
            await flush();

            expect(recordEntry).toHaveBeenCalledTimes(2);
        });

        it('reports failures to stderr, throttled to one report per window', async () => {
            const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
            const { service, recordEntry } = makeServiceMock();
            recordEntry.mockRejectedValue(new Error('db down'));
            const persist = createAuditLogPersister(service);

            persist(makeRecord());
            await flush();
            persist(makeRecord({ message: 'second' }));
            await flush();

            expect(recordEntry).toHaveBeenCalledTimes(2);
            expect(stderr).toHaveBeenCalledTimes(1);
            expect(String(stderr.mock.calls[0]?.[0])).toContain('audit-log-sink');
            stderr.mockRestore();
        });
    });
});
