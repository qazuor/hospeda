import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserBookmarkModel } from '../../src/models/user/userBookmark.model';

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('UserBookmarkModel', () => {
    let model: UserBookmarkModel;

    beforeEach(() => {
        model = new UserBookmarkModel();
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(UserBookmarkModel);
        });
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (model as unknown as { getTableName(): string }).getTableName();
            expect(tableName).toBe('userBookmarks');
        });
    });
});
