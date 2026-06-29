/**
 * Tests for SearchHistoryService.list
 *
 * Covers: returns entries capped to planLimit, empty list, model error.
 */
import { UserSearchHistoryModel } from '@repo/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { SearchHistoryService } from '../../../src/services/userSearchHistory/userSearchHistory.service';
import { createActor } from '../../factories/actorFactory';
import { createMockSearchHistoryEntry } from '../../factories/userSearchHistoryFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('SearchHistoryService.list', () => {
    let service: SearchHistoryService;
    let modelMock: UserSearchHistoryModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    const userId = getMockId('user');
    const actor = createActor({ id: userId });
    const entry = createMockSearchHistoryEntry({ userId });

    beforeEach(() => {
        modelMock = createTypedModelMock(UserSearchHistoryModel);
        loggerMock = createLoggerMock();
        service = new SearchHistoryService({ logger: loggerMock }, modelMock);

        asMock(modelMock.findAll).mockResolvedValue({ items: [entry], total: 1 });
    });

    it('should return entries and total (success)', async () => {
        const result = await service.list(actor, { planLimit: 50 });
        expectSuccess(result);
        expect(result.data?.entries).toHaveLength(1);
        expect(result.data?.entries[0]).toEqual(entry);
        expect(result.data?.total).toBe(1);
    });

    it('should pass planLimit as pageSize to the model', async () => {
        await service.list(actor, { planLimit: 10 });

        const calls = asMock(modelMock.findAll).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const callArgs = calls[0] as unknown[];
        expect(callArgs[1]).toMatchObject({ pageSize: 10 });
    });

    it('should return empty entries when there are no entries', async () => {
        asMock(modelMock.findAll).mockResolvedValue({ items: [], total: 0 });

        const result = await service.list(actor, { planLimit: 50 });
        expectSuccess(result);
        expect(result.data?.entries).toHaveLength(0);
        expect(result.data?.total).toBe(0);
    });

    it('should return INTERNAL_ERROR when model.findAll throws', async () => {
        asMock(modelMock.findAll).mockRejectedValue(new Error('DB error'));

        const result = await service.list(actor, { planLimit: 50 });
        expectInternalError(result);
    });

    it('should request entries sorted newest-first', async () => {
        await service.list(actor, { planLimit: 50 });

        const calls = asMock(modelMock.findAll).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const callArgs = calls[0] as unknown[];
        expect(callArgs[1]).toMatchObject({ sortBy: 'createdAt', sortOrder: 'desc' });
    });
});
