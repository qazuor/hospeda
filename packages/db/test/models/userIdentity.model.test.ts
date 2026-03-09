import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserIdentityModel } from '../../src/models/user/userIdentity.model';

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('UserIdentityModel', () => {
    let model: UserIdentityModel;

    beforeEach(() => {
        model = new UserIdentityModel();
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(UserIdentityModel);
        });
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (model as unknown as { getTableName(): string }).getTableName();
            expect(tableName).toBe('user_auth_identities');
        });
    });
});
