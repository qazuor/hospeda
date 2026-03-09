import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationFaqModel } from '../../src/models/accommodation/accommodationFaq.model';

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('AccommodationFaqModel', () => {
    let model: AccommodationFaqModel;

    beforeEach(() => {
        model = new AccommodationFaqModel();
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(AccommodationFaqModel);
        });
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (model as unknown as { getTableName(): string }).getTableName();
            expect(tableName).toBe('accommodationFaqs');
        });
    });
});
