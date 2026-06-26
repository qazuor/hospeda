import { describe, expect, it } from 'vitest';
import { AuditLogEntryFilterSchema } from '../../../src/entities/auditLogEntry/index.js';

describe('AuditLogEntryFilterSchema', () => {
    it('applies default page=1 and pageSize=50 when omitted', () => {
        const result = AuditLogEntryFilterSchema.parse({});
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(50);
    });

    it('coerces numeric strings for page/pageSize', () => {
        const result = AuditLogEntryFilterSchema.parse({ page: '3', pageSize: '25' });
        expect(result.page).toBe(3);
        expect(result.pageSize).toBe(25);
    });

    it('rejects a pageSize above 100', () => {
        expect(AuditLogEntryFilterSchema.safeParse({ pageSize: '101' }).success).toBe(false);
    });

    it('coerces fromDate/toDate to Date', () => {
        const result = AuditLogEntryFilterSchema.parse({
            fromDate: '2026-06-01',
            toDate: '2026-06-03'
        });
        expect(result.fromDate).toBeInstanceOf(Date);
        expect(result.toDate).toBeInstanceOf(Date);
    });

    it('accepts a valid severity', () => {
        expect(AuditLogEntryFilterSchema.safeParse({ severity: 'critical' }).success).toBe(true);
    });

    it('rejects an invalid severity', () => {
        expect(AuditLogEntryFilterSchema.safeParse({ severity: 'fatal' }).success).toBe(false);
    });

    it('rejects a non-UUID actorId', () => {
        expect(AuditLogEntryFilterSchema.safeParse({ actorId: 'anonymous' }).success).toBe(false);
    });

    it.each(['loggedAt:asc', 'loggedAt:desc', 'severity:asc', 'severity:desc'])(
        'accepts whitelisted sort %s',
        (sort) => {
            expect(AuditLogEntryFilterSchema.safeParse({ sort }).success).toBe(true);
        }
    );

    it.each(['message:desc', 'loggedAt:random', 'eventType:asc', 'loggedAt'])(
        'rejects invalid sort %s',
        (sort) => {
            expect(AuditLogEntryFilterSchema.safeParse({ sort }).success).toBe(false);
        }
    );

    it('does not expose a logType filter (route-injected, not client-supplied)', () => {
        // logType is intentionally absent from the client filter schema; unknown
        // keys are stripped by Zod object parsing, so the parsed result must not
        // carry a logType.
        const result = AuditLogEntryFilterSchema.parse({ logType: 'security' } as never);
        expect(result).not.toHaveProperty('logType');
    });
});
