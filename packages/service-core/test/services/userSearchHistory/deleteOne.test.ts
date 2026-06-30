/**
 * Tests for SearchHistoryService.deleteOne
 *
 * Covers: successful delete, NOT_FOUND, FORBIDDEN (cross-user), model error.
 */
import { UserSearchHistoryModel } from '@repo/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { SearchHistoryService } from '../../../src/services/userSearchHistory/userSearchHistory.service';
import { createActor } from '../../factories/actorFactory';
import {
    createMockSearchHistoryEntry,
    getMockSearchHistoryId
} from '../../factories/userSearchHistoryFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('SearchHistoryService.deleteOne', () => {
    let service: SearchHistoryService;
    let modelMock: UserSearchHistoryModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    const userId = getMockId('user');
    const actor = createActor({ id: userId });
    const entryId = getMockSearchHistoryId('entry-1');
    const entry = createMockSearchHistoryEntry({ id: entryId, userId });

    beforeEach(() => {
        modelMock = createTypedModelMock(UserSearchHistoryModel);
        loggerMock = createLoggerMock();
        service = new SearchHistoryService({ logger: loggerMock }, modelMock);

        asMock(modelMock.findById).mockResolvedValue(entry);
        asMock(modelMock.hardDelete).mockResolvedValue(1);
    });

    it('should hard-delete an owned entry (success)', async () => {
        const result = await service.deleteOne(actor, { id: entryId });
        expectSuccess(result);
        expect(result.data?.deleted).toBe(true);
        expect(asMock(modelMock.hardDelete)).toHaveBeenCalledOnce();
    });

    it('should return NOT_FOUND when the entry does not exist', async () => {
        asMock(modelMock.findById).mockResolvedValue(null);

        const result = await service.deleteOne(actor, { id: entryId });
        expectNotFoundError(result);
    });

    it('should return FORBIDDEN when the entry belongs to another user', async () => {
        const otherUserId = getMockId('user', 'other-user');
        const otherEntry = createMockSearchHistoryEntry({ id: entryId, userId: otherUserId });
        asMock(modelMock.findById).mockResolvedValue(otherEntry);

        const result = await service.deleteOne(actor, { id: entryId });
        expectForbiddenError(result);
    });

    it('should return INTERNAL_ERROR when model.hardDelete throws', async () => {
        asMock(modelMock.hardDelete).mockRejectedValue(new Error('DB failure'));

        const result = await service.deleteOne(actor, { id: entryId });
        expectInternalError(result);
    });
});
