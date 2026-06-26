import { describe, expect, it } from 'vitest';
import {
    AuditLogEntrySchema,
    CreateAuditLogEntrySchema
} from '../../../src/entities/auditLogEntry/index.js';

describe('AuditLogEntrySchema', () => {
    const base = {
        id: '22222222-2222-4222-8222-222222222222',
        logType: 'audit',
        eventType: 'billing.mutation',
        severity: 'critical',
        message: 'billing.mutation',
        loggedAt: '2026-06-03T10:00:00.000Z',
        createdAt: '2026-06-03T10:00:00.100Z'
    };

    it('accepts a minimal valid entry (optional context fields omitted)', () => {
        const result = AuditLogEntrySchema.safeParse(base);
        expect(result.success).toBe(true);
    });

    it('accepts a fully-populated entry and coerces dates', () => {
        const result = AuditLogEntrySchema.safeParse({
            ...base,
            actorId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            actorRole: 'ADMIN',
            targetId: 'promo_code:pc-1',
            ip: '1.2.3.4',
            method: 'POST',
            path: '/api/v1/admin/billing',
            statusCode: 200,
            data: { action: 'create' }
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.loggedAt).toBeInstanceOf(Date);
        }
    });

    it('rejects an invalid logType', () => {
        const result = AuditLogEntrySchema.safeParse({ ...base, logType: 'system' });
        expect(result.success).toBe(false);
    });

    it('rejects an invalid severity', () => {
        const result = AuditLogEntrySchema.safeParse({ ...base, severity: 'fatal' });
        expect(result.success).toBe(false);
    });

    it('rejects a non-UUID actorId', () => {
        const result = AuditLogEntrySchema.safeParse({ ...base, actorId: 'anonymous' });
        expect(result.success).toBe(false);
    });
});

describe('CreateAuditLogEntrySchema', () => {
    const base = {
        logType: 'security',
        eventType: 'auth.login.failed',
        severity: 'critical',
        message: 'auth.login.failed',
        loggedAt: '2026-06-03T10:00:00.000Z'
    };

    it('accepts a minimal valid create input', () => {
        expect(CreateAuditLogEntrySchema.safeParse(base).success).toBe(true);
    });

    it('rejects an eventType longer than 50 chars', () => {
        const result = CreateAuditLogEntrySchema.safeParse({ ...base, eventType: 'x'.repeat(51) });
        expect(result.success).toBe(false);
    });

    it('rejects an invalid logType', () => {
        expect(CreateAuditLogEntrySchema.safeParse({ ...base, logType: 'nope' }).success).toBe(
            false
        );
    });
});
