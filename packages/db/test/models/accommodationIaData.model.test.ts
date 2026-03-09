import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationIaDataModel } from '../../src/models/accommodation/accommodationIaData.model';

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('AccommodationIaDataModel', () => {
    let model: AccommodationIaDataModel;

    beforeEach(() => {
        model = new AccommodationIaDataModel();
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(AccommodationIaDataModel);
        });
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (model as unknown as { getTableName(): string }).getTableName();
            expect(tableName).toBe('accommodationIaData');
        });
    });
});
