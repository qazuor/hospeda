/**
 * Tests for SearchHistoryService.record
 *
 * Covers: opt-out skip, successful insert + trim, NOT_FOUND when user missing.
 */
import { UserModel, UserSearchHistoryModel } from '@repo/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { SearchHistoryService } from '../../../src/services/userSearchHistory/userSearchHistory.service';
import { createActor } from '../../factories/actorFactory';
import { createMockSearchHistoryEntry } from '../../factories/userSearchHistoryFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectInternalError, expectNotFoundError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('SearchHistoryService.record', () => {
    let service: SearchHistoryService;
    let modelMock: UserSearchHistoryModel;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    const userId = getMockId('user');
    const actor = createActor({ id: userId });
    const entry = createMockSearchHistoryEntry({ userId });
    const validInput = {
        queryText: 'playa',
        filters: null,
        resultCount: 5
    };

    beforeEach(() => {
        modelMock = createTypedModelMock(UserSearchHistoryModel);
        userModelMock = createTypedModelMock(UserModel);
        loggerMock = createLoggerMock();
        service = new SearchHistoryService({ logger: loggerMock }, modelMock, userModelMock);

        // Default: user exists with history enabled
        asMock(userModelMock.findById).mockResolvedValue({
            id: userId,
            settings: { searchHistoryEnabled: true }
        });
        asMock(modelMock.create).mockResolvedValue(entry);
        asMock(modelMock.raw).mockResolvedValue(undefined);
    });

    it('should record an entry when history is enabled (success)', async () => {
        const result = await service.record(actor, validInput);
        expectSuccess(result);
        expect(result.data?.recorded).toBe(true);
        expect(asMock(modelMock.create)).toHaveBeenCalledOnce();
        expect(asMock(modelMock.raw)).toHaveBeenCalledOnce();
    });

    it('should skip recording when searchHistoryEnabled is false', async () => {
        asMock(userModelMock.findById).mockResolvedValue({
            id: userId,
            settings: { searchHistoryEnabled: false }
        });

        const result = await service.record(actor, validInput);
        expectSuccess(result);
        expect(result.data?.recorded).toBe(false);
        expect(asMock(modelMock.create)).not.toHaveBeenCalled();
    });

    it('should treat absent settings as enabled', async () => {
        asMock(userModelMock.findById).mockResolvedValue({ id: userId, settings: null });

        const result = await service.record(actor, validInput);
        expectSuccess(result);
        expect(result.data?.recorded).toBe(true);
    });

    it('should return NOT_FOUND when the user does not exist', async () => {
        asMock(userModelMock.findById).mockResolvedValue(null);

        const result = await service.record(actor, validInput);
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR when model.create throws', async () => {
        asMock(modelMock.create).mockRejectedValue(new Error('DB error'));

        const result = await service.record(actor, validInput);
        expectInternalError(result);
    });

    it('should record with null queryText and null filters', async () => {
        const result = await service.record(actor, {
            queryText: null,
            filters: null,
            resultCount: null
        });
        expectSuccess(result);
        expect(result.data?.recorded).toBe(true);
    });
});
