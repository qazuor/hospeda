import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostSponsorModel } from '../../src/models/post/postSponsor.model';

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('PostSponsorModel', () => {
    let model: PostSponsorModel;

    beforeEach(() => {
        model = new PostSponsorModel();
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(PostSponsorModel);
        });
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (model as unknown as { getTableName(): string }).getTableName();
            expect(tableName).toBe('postSponsors');
        });
    });
});
