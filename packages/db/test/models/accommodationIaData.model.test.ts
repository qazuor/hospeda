import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { AccommodationIaDataModel } from '../../src/models/accommodation/accommodationIaData.model';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('AccommodationIaDataModel', () => {
    let model: AccommodationIaDataModel;

    beforeEach(() => {
        vi.spyOn(dbUtils, 'getDb');
        model = new AccommodationIaDataModel();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
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
