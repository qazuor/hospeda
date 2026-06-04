import { AppLogEntryModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppLogEntryService } from '../../../src/services/appLog/appLogEntry.service.js';
import type { Actor } from '../../../src/types/index.js';
import { createActor } from '../../factories/actorFactory.js';
import { expectForbiddenError, expectSuccess } from '../../helpers/assertions.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';
import { asMock } from '../../utils/test-utils.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Builds a fully-populated app_log_entries row for mock returns. */
const makeRow = (overrides: Record<string, unknown> = {}) => ({
    id: '22222222-2222-4222-8222-222222222222',
    level: 'ERROR',
    category: 'API',
    label: null,
    message: 'something failed',
    data: null,
    loggedAt: new Date('2026-06-03T10:00:00.000Z'),
    createdAt: new Date('2026-06-03T10:00:00.100Z'),
    ...overrides
});

describe('AppLogEntryService', () => {
    let service: AppLogEntryService;
    let modelMock: AppLogEntryModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    let actorNoPerm: Actor;

    beforeEach(() => {
        modelMock = createTypedModelMock(AppLogEntryModel, [
            'createQuiet',
            'listEntries',
            'purgeOlderThan'
        ]);
        loggerMock = createLoggerMock();
        service = new AppLogEntryService({ logger: loggerMock }, modelMock);
        actor = createActor({ permissions: [PermissionEnum.SYSTEM_MAINTENANCE_MODE] });
        actorNoPerm = createActor({ permissions: [] });
    });

    describe('recordEntry', () => {
        it('inserts the entry as-is when the message is within the limit', async () => {
            asMock(modelMock.createQuiet).mockResolvedValue(makeRow());

            await service.recordEntry({
                data: {
                    level: 'ERROR',
                    category: 'API',
                    message: 'something failed',
                    loggedAt: new Date('2026-06-03T10:00:00.000Z')
                }
            });

            const arg = asMock(modelMock.createQuiet).mock.calls[0]?.[0] as {
                level: string;
                category: string | null;
                label: string | null;
                message: string;
                data: Record<string, unknown> | null;
            };
            expect(arg.level).toBe('ERROR');
            expect(arg.category).toBe('API');
            expect(arg.label).toBeNull();
            expect(arg.message).toBe('something failed');
            expect(arg.data).toBeNull();
        });

        it('truncates an oversized message and keeps the full text in data.messageFull', async () => {
            asMock(modelMock.createQuiet).mockResolvedValue(makeRow());
            const longMessage = 'x'.repeat(2500);

            await service.recordEntry({
                data: {
                    level: 'WARN',
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

        it('rejects a non-persistable level (volume guard)', async () => {
            await expect(
                service.recordEntry({
                    data: {
                        // INFO is not a persistable level — schema must reject it
                        level: 'INFO' as 'WARN',
                        message: 'should not persist',
                        loggedAt: new Date()
                    }
                })
            ).rejects.toThrow();
        });
    });

    describe('listEntries', () => {
        it('rejects an actor without SYSTEM_MAINTENANCE_MODE', async () => {
            const result = await service.listEntries({ actor: actorNoPerm });
            expectForbiddenError(result);
        });

        it('returns the page of entries for an authorized actor', async () => {
            asMock(modelMock.listEntries).mockResolvedValue({
                items: [makeRow()],
                total: 1
            });

            const result = await service.listEntries({
                actor,
                filter: { level: 'ERROR', page: 1, pageSize: 50 }
            });

            expectSuccess(result);
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.total).toBe(1);
        });
    });

    describe('purgeOld', () => {
        it('purges with the default 30-day retention', async () => {
            asMock(modelMock.purgeOlderThan).mockResolvedValue(7);

            const deleted = await service.purgeOld();

            expect(deleted).toBe(7);
            const arg = asMock(modelMock.purgeOlderThan).mock.calls[0]?.[0] as { before: Date };
            const expected = Date.now() - 30 * MS_PER_DAY;
            expect(Math.abs(arg.before.getTime() - expected)).toBeLessThan(5000);
        });

        it('honors a custom retention window', async () => {
            asMock(modelMock.purgeOlderThan).mockResolvedValue(0);

            await service.purgeOld({ retentionDays: 7 });

            const arg = asMock(modelMock.purgeOlderThan).mock.calls[0]?.[0] as { before: Date };
            const expected = Date.now() - 7 * MS_PER_DAY;
            expect(Math.abs(arg.before.getTime() - expected)).toBeLessThan(5000);
        });
    });
});
