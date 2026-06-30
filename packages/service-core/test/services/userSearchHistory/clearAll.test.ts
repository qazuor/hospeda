/**
 * Tests for SearchHistoryService.clearAll
 *
 * Covers: non-empty clear, zero-entry no-op, model error.
 *
 * Note: clearAll no longer performs a pre-count round-trip — it calls
 * hardDelete directly and returns the deleted row count (0 for no-op).
 */
import { UserSearchHistoryModel } from '@repo/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { SearchHistoryService } from '../../../src/services/userSearchHistory/userSearchHistory.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('SearchHistoryService.clearAll', () => {
    let service: SearchHistoryService;
    let modelMock: UserSearchHistoryModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    const userId = getMockId('user');
    const actor = createActor({ id: userId });

    beforeEach(() => {
        modelMock = createTypedModelMock(UserSearchHistoryModel);
        loggerMock = createLoggerMock();
        service = new SearchHistoryService({ logger: loggerMock }, modelMock);
    });

    it('should delete all entries and return count (success)', async () => {
        asMock(modelMock.hardDelete).mockResolvedValue(3);

        const result = await service.clearAll(actor);
        expectSuccess(result);
        expect(result.data?.deleted).toBe(3);
        expect(asMock(modelMock.hardDelete)).toHaveBeenCalledOnce();
        // count is no longer called — hardDelete return value is used directly
        expect(asMock(modelMock.count)).not.toHaveBeenCalled();
    });

    it('should return deleted: 0 when there are no entries (no-op via hardDelete)', async () => {
        asMock(modelMock.hardDelete).mockResolvedValue(0);

        const result = await service.clearAll(actor);
        expectSuccess(result);
        expect(result.data?.deleted).toBe(0);
        // hardDelete IS called; the zero-deleted result is the no-op signal
        expect(asMock(modelMock.hardDelete)).toHaveBeenCalledOnce();
    });

    it('should return INTERNAL_ERROR when model.hardDelete throws', async () => {
        asMock(modelMock.hardDelete).mockRejectedValue(new Error('DB failure'));

        const result = await service.clearAll(actor);
        expectInternalError(result);
    });
});
