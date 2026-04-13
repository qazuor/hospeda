import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { UserIdentityModel } from '../../src/models/user/userIdentity.model';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('UserIdentityModel', () => {
    let model: UserIdentityModel;

    beforeEach(() => {
        vi.spyOn(dbUtils, 'getDb');
        model = new UserIdentityModel();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
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
