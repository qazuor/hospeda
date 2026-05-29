import { CronRunModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { CronRunService } from '../../../src/services/cronRun/cronRun.service.js';
import type { Actor } from '../../../src/types/index.js';
import { createActor } from '../../factories/actorFactory.js';
import { expectForbiddenError, expectSuccess } from '../../helpers/assertions.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';
import { asMock } from '../../utils/test-utils.js';

/** Builds a fully-populated cron_runs row for mock returns. */
const makeRow = (overrides: Record<string, unknown> = {}) => ({
    id: '11111111-1111-4111-8111-111111111111',
    jobName: 'dunning',
    status: 'success',
    startedAt: new Date('2026-05-29T06:00:00.000Z'),
    finishedAt: new Date('2026-05-29T06:00:01.000Z'),
    durationMs: 1000,
    processed: 3,
    errors: 0,
    executionMode: 'scheduled',
    dryRun: false,
    errorMessage: null,
    details: {},
    createdAt: new Date('2026-05-29T06:00:01.000Z'),
    ...overrides
});

describe('CronRunService', () => {
    let service: CronRunService;
    let modelMock: CronRunModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    let actorNoPerm: Actor;

    beforeEach(() => {
        modelMock = createTypedModelMock(CronRunModel, [
            'create',
            'listRuns',
            'findById',
            'getLatestRunPerJob',
            'getRecentFailures',
            'purgeOlderThan'
        ]);
        loggerMock = createLoggerMock();
        service = new CronRunService({ logger: loggerMock }, modelMock);
        actor = createActor({ permissions: [PermissionEnum.SYSTEM_MAINTENANCE_MODE] });
        actorNoPerm = createActor({ permissions: [] });
    });

    describe('recordRun', () => {
        it('inserts the run as-is when errorMessage is within the limit', async () => {
            asMock(modelMock.create).mockResolvedValue(makeRow());

            await service.recordRun({
                data: {
                    jobName: 'dunning',
                    status: 'success',
                    startedAt: new Date('2026-05-29T06:00:00.000Z'),
                    finishedAt: new Date('2026-05-29T06:00:01.000Z'),
                    durationMs: 1000,
                    processed: 3,
                    errors: 0,
                    executionMode: 'scheduled',
                    dryRun: false
                }
            });

            const arg = asMock(modelMock.create).mock.calls[0]?.[0] as {
                jobName: string;
                errorMessage: string | null;
                details: Record<string, unknown>;
            };
            expect(arg.jobName).toBe('dunning');
            expect(arg.errorMessage).toBeNull();
            expect(arg.details).toEqual({});
        });

        it('truncates an oversized errorMessage and keeps the full text in details', async () => {
            asMock(modelMock.create).mockResolvedValue(makeRow());
            const longMessage = 'x'.repeat(2500);

            await service.recordRun({
                data: {
                    jobName: 'dunning',
                    status: 'failed',
                    startedAt: new Date(),
                    finishedAt: new Date(),
                    durationMs: 5,
                    processed: 0,
                    errors: 1,
                    executionMode: 'manual',
                    dryRun: false,
                    errorMessage: longMessage
                }
            });

            const arg = asMock(modelMock.create).mock.calls[0]?.[0] as {
                errorMessage: string;
                details: Record<string, unknown>;
            };
            expect(arg.errorMessage).toHaveLength(2000);
            expect(arg.details.errorMessageFull).toBe(longMessage);
        });
    });

    describe('listRuns', () => {
        it('rejects an actor without SYSTEM_MAINTENANCE_MODE', async () => {
            const result = await service.listRuns({ actor: actorNoPerm });
            expectForbiddenError(result);
            expect(asMock(modelMock.listRuns)).not.toHaveBeenCalled();
        });

        it('returns the paginated page for a permitted actor', async () => {
            asMock(modelMock.listRuns).mockResolvedValue({ items: [makeRow()], total: 1 });

            const result = await service.listRuns({
                actor,
                filter: { jobName: 'dunning', page: 1, pageSize: 50 }
            });

            expectSuccess(result);
            expect(result.data?.total).toBe(1);
            expect(result.data?.items).toHaveLength(1);
            expect(asMock(modelMock.listRuns)).toHaveBeenCalledWith(
                expect.objectContaining({ jobName: 'dunning' })
            );
        });
    });

    describe('getById', () => {
        it('returns null when the run does not exist', async () => {
            asMock(modelMock.findById).mockResolvedValue(null);

            const result = await service.getById({
                actor,
                id: '22222222-2222-4222-8222-222222222222'
            });

            expectSuccess(result);
            expect(result.data).toBeNull();
        });

        it('rejects an actor without permission', async () => {
            const result = await service.getById({
                actor: actorNoPerm,
                id: '22222222-2222-4222-8222-222222222222'
            });
            expectForbiddenError(result);
        });
    });

    describe('getSummary', () => {
        it('counts jobs whose latest run was not a success', async () => {
            asMock(modelMock.getLatestRunPerJob).mockResolvedValue([
                makeRow({ jobName: 'a', status: 'success' }),
                makeRow({ jobName: 'b', status: 'failed' }),
                makeRow({ jobName: 'c', status: 'timeout' })
            ]);
            asMock(modelMock.getRecentFailures).mockResolvedValue([
                makeRow({ jobName: 'b', status: 'failed' })
            ]);

            const result = await service.getSummary({ actor });

            expectSuccess(result);
            expect(result.data?.lastRuns).toHaveLength(3);
            expect(result.data?.recentFailures).toHaveLength(1);
            expect(result.data?.failingJobsCount).toBe(2);
            expect(result.data?.generatedAt).toBeInstanceOf(Date);
        });

        it('rejects an actor without permission', async () => {
            const result = await service.getSummary({ actor: actorNoPerm });
            expectForbiddenError(result);
        });
    });

    describe('purgeOld', () => {
        it('purges with default 60/180 day windows and returns the deleted count', async () => {
            asMock(modelMock.purgeOlderThan).mockResolvedValue(7);

            const deleted = await service.purgeOld();

            expect(deleted).toBe(7);
            const arg = asMock(modelMock.purgeOlderThan).mock.calls[0]?.[0] as {
                successBefore: Date;
                failedBefore: Date;
            };
            const now = Date.now();
            const successAgeDays = (now - arg.successBefore.getTime()) / 86_400_000;
            const failedAgeDays = (now - arg.failedBefore.getTime()) / 86_400_000;
            expect(successAgeDays).toBeCloseTo(60, 0);
            expect(failedAgeDays).toBeCloseTo(180, 0);
        });

        it('honours custom retention windows', async () => {
            asMock(modelMock.purgeOlderThan).mockResolvedValue(0);

            await service.purgeOld({ successRetentionDays: 10, failedRetentionDays: 20 });

            const arg = asMock(modelMock.purgeOlderThan).mock.calls[0]?.[0] as {
                successBefore: Date;
                failedBefore: Date;
            };
            const now = Date.now();
            expect((now - arg.successBefore.getTime()) / 86_400_000).toBeCloseTo(10, 0);
            expect((now - arg.failedBefore.getTime()) / 86_400_000).toBeCloseTo(20, 0);
        });
    });
});
