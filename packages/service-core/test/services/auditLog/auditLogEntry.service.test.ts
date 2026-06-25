import { AuditLogEntryModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditLogEntryService } from '../../../src/services/auditLog/auditLogEntry.service.js';
import type { Actor } from '../../../src/types/index.js';
import { createActor } from '../../factories/actorFactory.js';
import { expectForbiddenError, expectSuccess } from '../../helpers/assertions.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';
import { asMock } from '../../utils/test-utils.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Builds a fully-populated audit_log_entries row for mock returns. */
const makeRow = (overrides: Record<string, unknown> = {}) => ({
    id: '22222222-2222-4222-8222-222222222222',
    logType: 'audit',
    eventType: 'billing.mutation',
    severity: 'critical',
    actorId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    actorRole: 'ADMIN',
    targetId: 'subscription:abc',
    ip: null,
    method: 'POST',
    path: '/api/v1/admin/billing',
    statusCode: 200,
    message: 'billing.mutation',
    data: null,
    loggedAt: new Date('2026-06-03T10:00:00.000Z'),
    createdAt: new Date('2026-06-03T10:00:00.100Z'),
    ...overrides
});

describe('AuditLogEntryService', () => {
    let service: AuditLogEntryService;
    let modelMock: AuditLogEntryModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let auditActor: Actor;
    let securityActor: Actor;
    let actorNoPerm: Actor;

    beforeEach(() => {
        modelMock = createTypedModelMock(AuditLogEntryModel, [
            'createQuiet',
            'listEntries',
            'purgeOlderThan'
        ]);
        loggerMock = createLoggerMock();
        service = new AuditLogEntryService({ logger: loggerMock }, modelMock);
        auditActor = createActor({ permissions: [PermissionEnum.AUDIT_LOG_VIEW] });
        securityActor = createActor({ permissions: [PermissionEnum.SECURITY_LOG_VIEW] });
        actorNoPerm = createActor({ permissions: [] });
    });

    describe('recordEntry', () => {
        it('inserts the entry as-is when the message is within the limit', async () => {
            asMock(modelMock.createQuiet).mockResolvedValue(makeRow());

            await service.recordEntry({
                data: {
                    logType: 'audit',
                    eventType: 'billing.mutation',
                    severity: 'critical',
                    actorId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
                    message: 'billing.mutation',
                    loggedAt: new Date('2026-06-03T10:00:00.000Z')
                }
            });

            const arg = asMock(modelMock.createQuiet).mock.calls[0]?.[0] as {
                logType: string;
                eventType: string;
                severity: string;
                actorId: string | null;
                message: string;
                data: Record<string, unknown> | null;
            };
            expect(arg.logType).toBe('audit');
            expect(arg.eventType).toBe('billing.mutation');
            expect(arg.severity).toBe('critical');
            expect(arg.actorId).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
            expect(arg.message).toBe('billing.mutation');
            expect(arg.data).toBeNull();
        });

        it('truncates an oversized message and keeps the full text in data.messageFull', async () => {
            asMock(modelMock.createQuiet).mockResolvedValue(makeRow());
            const longMessage = 'x'.repeat(2500);

            await service.recordEntry({
                data: {
                    logType: 'security',
                    eventType: 'auth.login.failed',
                    severity: 'critical',
                    message: longMessage,
                    loggedAt: new Date()
                }
            });

            const arg = asMock(modelMock.createQuiet).mock.calls[0]?.[0] as {
                message: string;
                data: Record<string, unknown>;
            };
            expect(arg.message).toHaveLength(2000);
            expect(arg.data.messageFull).toBe(longMessage);
        });

        it('passes null optional fields when omitted', async () => {
            asMock(modelMock.createQuiet).mockResolvedValue(makeRow());

            await service.recordEntry({
                data: {
                    logType: 'security',
                    eventType: 'auth.lockout',
                    severity: 'critical',
                    message: 'auth.lockout',
                    loggedAt: new Date()
                }
            });

            const arg = asMock(modelMock.createQuiet).mock.calls[0]?.[0] as {
                actorId: string | null;
                ip: string | null;
                targetId: string | null;
                statusCode: number | null;
            };
            expect(arg.actorId).toBeNull();
            expect(arg.ip).toBeNull();
            expect(arg.targetId).toBeNull();
            expect(arg.statusCode).toBeNull();
        });

        it('rejects an invalid logType', async () => {
            await expect(
                service.recordEntry({
                    data: {
                        // 'system' is not a valid logType — schema must reject it
                        logType: 'system' as 'audit',
                        eventType: 'billing.mutation',
                        severity: 'info',
                        message: 'nope',
                        loggedAt: new Date()
                    }
                })
            ).rejects.toThrow();
        });
    });

    describe('listEntries', () => {
        it('rejects an audit query from an actor lacking AUDIT_LOG_VIEW', async () => {
            // securityActor holds only SECURITY_LOG_VIEW — must NOT see audit logs.
            const result = await service.listEntries({ actor: securityActor, logType: 'audit' });
            expectForbiddenError(result);
        });

        it('rejects a security query from an actor lacking SECURITY_LOG_VIEW', async () => {
            const result = await service.listEntries({ actor: auditActor, logType: 'security' });
            expectForbiddenError(result);
        });

        it('rejects any query from an actor with neither permission', async () => {
            const result = await service.listEntries({ actor: actorNoPerm, logType: 'audit' });
            expectForbiddenError(result);
        });

        it('returns audit entries for an actor with AUDIT_LOG_VIEW', async () => {
            asMock(modelMock.listEntries).mockResolvedValue({ items: [makeRow()], total: 1 });

            const result = await service.listEntries({
                actor: auditActor,
                logType: 'audit',
                filter: { severity: 'critical', page: 1, pageSize: 50 }
            });

            expectSuccess(result);
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.total).toBe(1);
        });

        it('injects the route logType into the model query (not the client filter)', async () => {
            asMock(modelMock.listEntries).mockResolvedValue({ items: [], total: 0 });

            await service.listEntries({
                actor: securityActor,
                logType: 'security',
                filter: { page: 1, pageSize: 50 }
            });

            const arg = asMock(modelMock.listEntries).mock.calls[0]?.[0] as { logType: string };
            expect(arg.logType).toBe('security');
        });
    });

    describe('purgeOld', () => {
        it('purges with the default 90-day retention', async () => {
            asMock(modelMock.purgeOlderThan).mockResolvedValue(7);

            const deleted = await service.purgeOld();

            expect(deleted).toBe(7);
            const arg = asMock(modelMock.purgeOlderThan).mock.calls[0]?.[0] as { before: Date };
            const expected = Date.now() - 90 * MS_PER_DAY;
            expect(Math.abs(arg.before.getTime() - expected)).toBeLessThan(5000);
        });
    });
});
