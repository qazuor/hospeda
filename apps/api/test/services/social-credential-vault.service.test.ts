/**
 * Tests for social-credential-vault service (HOS-64 / SPEC-297a G-4, T-017).
 *
 * ## Coverage
 *
 * createSocialCredential:
 *   1. Rejects invalid input (bad key, empty plaintext, non-uuid actorId) with VALIDATION_ERROR.
 *   2. encryptSecret is called with the plaintext.
 *   3. The inserted row carries ciphertext, NOT the plaintext.
 *   4. An audit row with action 'created', actorId, and key is inserted.
 *   5. Returns success with { id, key }.
 *   6. Returns VALIDATION_ERROR when an active credential already exists (pre-check).
 *   7. Returns VALIDATION_ERROR on a 23505 unique-violation race (post-check).
 *   8. Propagates as INTERNAL_ERROR (transaction rolled back) when the audit insert fails.
 *
 * rotateSocialCredential:
 *   9. Rejects invalid input with VALIDATION_ERROR.
 *  10. encryptSecret is called with the new plaintext.
 *  11. Updates ciphertext in-place on the existing row (not the plaintext).
 *  12. Inserts an audit row with action 'rotated'.
 *  13. Returns success with { id, key }.
 *  14. Returns NOT_FOUND when no active credential exists.
 *
 * updateSocialCredentialMetadata:
 *  15. Updates the label field and inserts an audit row with action 'updated'.
 *  16. Returns NOT_FOUND when no active credential exists.
 *
 * deleteSocialCredential:
 *  17. Sets deletedAt/deletedById and inserts an audit row with action 'deleted'.
 *  18. Returns NOT_FOUND when no active credential exists (including already-deleted).
 *
 * listSocialCredentials:
 *  19. Returns masked items — never ciphertext/iv/authTag.
 *  20. Excludes soft-deleted rows by default.
 *
 * getDecryptedSocialCredential:
 *  21. Returns the decrypted plaintext via decryptSecret.
 *  22. Returns NOT_FOUND when no active credential exists.
 *  23. Never logs the plaintext (security check).
 *
 * @module test/services/social-credential-vault.service
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state (vi.hoisted runs before vi.mock factories)
// ---------------------------------------------------------------------------

const {
    mockEncryptSecret,
    mockDecryptSecret,
    mockWithTransaction,
    mockGetDb,
    mockDbSelectChain,
    mockDbInsert,
    mockDbInsertValues,
    mockDbUpdate,
    mockDbUpdateSet,
    mockDbUpdateSetWhere,
    mockDbSelectWhere,
    mockDbSelectLimit,
    mockApiLogger
} = vi.hoisted(() => {
    const mockDbInsertValuesReturning = vi.fn().mockResolvedValue([{ id: 'new-cred-uuid' }]);
    const mockDbInsertValues = vi.fn().mockReturnValue({
        returning: mockDbInsertValuesReturning
    });
    const mockDbInsert = vi.fn().mockReturnValue({ values: mockDbInsertValues });

    const mockDbUpdateSetWhere = vi.fn().mockResolvedValue({ rowCount: 1 });
    const mockDbUpdateSet = vi.fn().mockReturnValue({ where: mockDbUpdateSetWhere });
    const mockDbUpdate = vi.fn().mockReturnValue({ set: mockDbUpdateSet });

    const mockDbSelectLimit = vi.fn().mockResolvedValue([]);
    const mockDbSelectWhere = vi.fn().mockReturnValue({ limit: mockDbSelectLimit });
    const mockDbSelectFrom = vi.fn().mockReturnValue({ where: mockDbSelectWhere });
    const mockDbSelectChain = vi.fn().mockReturnValue({ from: mockDbSelectFrom });

    const mockGetDb = vi.fn().mockReturnValue({
        select: mockDbSelectChain,
        insert: mockDbInsert,
        update: mockDbUpdate
    });

    // withTransaction: immediately calls the callback with a tx mock
    const mockWithTransaction = vi
        .fn()
        .mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
            const tx = {
                insert: mockDbInsert,
                update: mockDbUpdate,
                select: mockDbSelectChain
            };
            await cb(tx);
        });

    const mockEncryptSecret = vi.fn().mockReturnValue({
        ciphertext: 'MOCK_CIPHERTEXT',
        iv: 'MOCK_IV',
        authTag: 'MOCK_AUTHTAG'
    });

    const mockDecryptSecret = vi.fn().mockReturnValue({ plaintext: 'decrypted-secret-value' });

    const mockApiLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        error: vi.fn()
    };

    return {
        mockEncryptSecret,
        mockDecryptSecret,
        mockWithTransaction,
        mockGetDb,
        mockDbSelectChain,
        mockDbInsert,
        mockDbInsertValues,
        mockDbUpdate,
        mockDbUpdateSet,
        mockDbUpdateSetWhere,
        mockDbSelectWhere,
        mockDbSelectLimit,
        mockApiLogger
    };
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
    withTransaction: mockWithTransaction,
    socialCredentials: {
        id: 'id',
        key: 'key',
        ciphertext: 'ciphertext',
        iv: 'iv',
        authTag: 'authTag',
        label: 'label',
        deletedAt: 'deletedAt',
        deletedById: 'deletedById',
        updatedAt: 'updatedAt'
    },
    socialCredentialAudit: {
        id: 'id',
        actorId: 'actorId',
        action: 'action',
        key: 'key',
        ipAddress: 'ipAddress',
        createdAt: 'createdAt'
    }
}));

vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return {
        ...actual,
        and: vi.fn((...args: unknown[]) => ({ _and: args })),
        eq: vi.fn((col: unknown, val: unknown) => ({ _eq: { col, val } })),
        isNull: vi.fn((col: unknown) => ({ _isNull: col }))
    };
});

vi.mock('../../src/utils/social-vault.js', () => ({
    encryptSecret: mockEncryptSecret,
    decryptSecret: mockDecryptSecret
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: mockApiLogger
}));

// ---------------------------------------------------------------------------
// Import SUT (after mocks)
// ---------------------------------------------------------------------------

import {
    createSocialCredential,
    deleteSocialCredential,
    getDecryptedSocialCredential,
    listSocialCredentials,
    rotateSocialCredential,
    updateSocialCredentialMetadata
} from '../../src/services/social-credential-vault.service';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ACTOR_ID = 'a0000000-0000-4000-8000-000000000001';
const KEY = 'make_webhook_url' as const;
const PLAINTEXT = 'https://hook.make.com/super-secret-webhook';
const IP_ADDRESS = '192.168.1.1';

// Active credential row returned by select
const ACTIVE_CREDENTIAL_ROW = { id: 'cred-uuid-existing' };

// ---------------------------------------------------------------------------
// Helper: reset all mock state between tests
// ---------------------------------------------------------------------------

function resetAllMocks(): void {
    vi.clearAllMocks();

    // Default select: no active credentials (empty result)
    mockDbSelectLimit.mockResolvedValue([]);
    mockDbSelectWhere.mockReturnValue({ limit: mockDbSelectLimit });

    const mockDbSelectFrom = vi.fn().mockReturnValue({ where: mockDbSelectWhere });
    mockDbSelectChain.mockReturnValue({ from: mockDbSelectFrom });

    mockGetDb.mockReturnValue({
        select: mockDbSelectChain,
        insert: mockDbInsert,
        update: mockDbUpdate
    });

    mockWithTransaction.mockImplementation(async function (cb: (tx: unknown) => Promise<void>) {
        const tx = {
            insert: mockDbInsert,
            update: mockDbUpdate,
            select: mockDbSelectChain
        };
        await cb(tx);
    });

    mockEncryptSecret.mockReturnValue({
        ciphertext: 'MOCK_CIPHERTEXT',
        iv: 'MOCK_IV',
        authTag: 'MOCK_AUTHTAG'
    });

    mockDecryptSecret.mockReturnValue({ plaintext: 'decrypted-secret-value' });

    const returningMock = vi.fn().mockResolvedValue([{ id: 'new-cred-uuid' }]);
    mockDbInsertValues.mockReturnValue({ returning: returningMock });
    mockDbInsert.mockReturnValue({ values: mockDbInsertValues });

    mockDbUpdateSetWhere.mockResolvedValue({ rowCount: 1 });
    mockDbUpdateSet.mockReturnValue({ where: mockDbUpdateSetWhere });
    mockDbUpdate.mockReturnValue({ set: mockDbUpdateSet });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createSocialCredential', () => {
    beforeEach(resetAllMocks);
    afterEach(() => vi.clearAllMocks());

    describe('input validation', () => {
        it('should return VALIDATION_ERROR for an unknown key and not touch the DB', async () => {
            const result = await createSocialCredential({
                key: 'not_a_real_key' as unknown as typeof KEY,
                plaintext: PLAINTEXT,
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('VALIDATION_ERROR');
            expect(mockGetDb).not.toHaveBeenCalled();
            expect(mockEncryptSecret).not.toHaveBeenCalled();
        });

        it('should return VALIDATION_ERROR for an empty plaintext', async () => {
            const result = await createSocialCredential({
                key: KEY,
                plaintext: '',
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            expect(result.error?.code).toBe('VALIDATION_ERROR');
            expect(mockEncryptSecret).not.toHaveBeenCalled();
        });

        it('should return VALIDATION_ERROR for a non-uuid actorId', async () => {
            const result = await createSocialCredential({
                key: KEY,
                plaintext: PLAINTEXT,
                actorId: 'not-a-uuid',
                ipAddress: IP_ADDRESS
            });

            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('when no active credential exists', () => {
        it('should call encryptSecret with the plaintext', async () => {
            mockDbSelectLimit.mockResolvedValue([]);

            await createSocialCredential({
                key: KEY,
                plaintext: PLAINTEXT,
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            expect(mockEncryptSecret).toHaveBeenCalledOnce();
            expect(mockEncryptSecret).toHaveBeenCalledWith({ plaintext: PLAINTEXT });
        });

        it('should insert a row carrying ciphertext — not the plaintext', async () => {
            mockDbSelectLimit.mockResolvedValue([]);

            const capturedValues: unknown[] = [];
            mockDbInsertValues.mockImplementation(function (vals: unknown) {
                capturedValues.push(vals);
                const returningMock = vi.fn().mockResolvedValue([{ id: 'new-cred-uuid' }]);
                return { returning: returningMock };
            });

            await createSocialCredential({
                key: KEY,
                plaintext: PLAINTEXT,
                label: 'Prod Make.com webhook',
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            const credentialInsertValues = capturedValues[0] as Record<string, unknown>;
            expect(credentialInsertValues).toBeDefined();
            expect(credentialInsertValues.ciphertext).toBe('MOCK_CIPHERTEXT');
            expect(credentialInsertValues.iv).toBe('MOCK_IV');
            expect(credentialInsertValues.authTag).toBe('MOCK_AUTHTAG');
            expect(JSON.stringify(credentialInsertValues)).not.toContain(PLAINTEXT);
        });

        it('should insert an audit row with action "created", actorId, and key', async () => {
            mockDbSelectLimit.mockResolvedValue([]);

            const allInsertedValues: unknown[] = [];
            mockDbInsertValues.mockImplementation(function (vals: unknown) {
                allInsertedValues.push(vals);
                const returningMock = vi.fn().mockResolvedValue([{ id: 'new-cred-uuid' }]);
                return { returning: returningMock };
            });

            await createSocialCredential({
                key: KEY,
                plaintext: PLAINTEXT,
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            const auditValues = allInsertedValues[1] as Record<string, unknown>;
            expect(auditValues).toBeDefined();
            expect(auditValues.action).toBe('created');
            expect(auditValues.actorId).toBe(ACTOR_ID);
            expect(auditValues.key).toBe(KEY);
        });

        it('should return success with { id, key }', async () => {
            mockDbSelectLimit.mockResolvedValue([]);
            const returningMock = vi.fn().mockResolvedValue([{ id: 'new-cred-uuid' }]);
            mockDbInsertValues.mockReturnValue({ returning: returningMock });

            const result = await createSocialCredential({
                key: KEY,
                plaintext: PLAINTEXT,
                actorId: ACTOR_ID,
                ipAddress: null
            });

            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe('new-cred-uuid');
            expect(result.data?.key).toBe(KEY);
            expect(result.error).toBeUndefined();
        });
    });

    describe('when an active credential already exists', () => {
        it('should return VALIDATION_ERROR and not call encryptSecret (pre-check)', async () => {
            mockDbSelectLimit.mockResolvedValue([ACTIVE_CREDENTIAL_ROW]);

            const result = await createSocialCredential({
                key: KEY,
                plaintext: PLAINTEXT,
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('VALIDATION_ERROR');
            expect(result.data).toBeUndefined();
            expect(mockEncryptSecret).not.toHaveBeenCalled();
            expect(mockWithTransaction).not.toHaveBeenCalled();
        });

        it('should map a 23505 unique-violation race to VALIDATION_ERROR (post-check)', async () => {
            mockDbSelectLimit.mockResolvedValue([]);
            mockWithTransaction.mockImplementation(async function () {
                const pgError = new Error('duplicate key value violates unique constraint');
                (pgError as Error & { code: string }).code = '23505';
                throw pgError;
            });

            const result = await createSocialCredential({
                key: KEY,
                plaintext: PLAINTEXT,
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('VALIDATION_ERROR');
            expect(result.data).toBeUndefined();
        });
    });

    describe('when the audit insert fails inside the transaction', () => {
        it('should return INTERNAL_ERROR (transaction rolled back, not a partial success)', async () => {
            mockDbSelectLimit.mockResolvedValue([]);

            let credentialInsertCalls = 0;
            mockWithTransaction.mockImplementation(async function (
                cb: (tx: unknown) => Promise<void>
            ) {
                const tx = {
                    insert: vi.fn().mockImplementation((table: unknown) => {
                        if (table && (table as { key?: unknown }).key === 'key') {
                            // Distinguish credential vs audit insert isn't possible via
                            // the mocked table shape alone (both use `key: 'key'`), so
                            // count calls: first insert = credential, second = audit.
                            credentialInsertCalls += 1;
                            if (credentialInsertCalls === 1) {
                                return {
                                    values: vi.fn().mockReturnValue({
                                        returning: vi
                                            .fn()
                                            .mockResolvedValue([{ id: 'new-cred-uuid' }])
                                    })
                                };
                            }
                        }
                        return {
                            values: vi.fn().mockImplementation(() => {
                                throw new Error('audit insert failed');
                            })
                        };
                    }),
                    select: mockDbSelectChain
                };
                await cb(tx);
            });

            const result = await createSocialCredential({
                key: KEY,
                plaintext: PLAINTEXT,
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('INTERNAL_ERROR');
            expect(result.data).toBeUndefined();
        });
    });
});

describe('rotateSocialCredential', () => {
    beforeEach(resetAllMocks);
    afterEach(() => vi.clearAllMocks());

    const NEW_PLAINTEXT = 'https://hook.make.com/rotated-webhook';

    describe('input validation', () => {
        it('should return VALIDATION_ERROR for an unknown key and not touch the DB', async () => {
            const result = await rotateSocialCredential({
                key: 'not_a_real_key' as unknown as typeof KEY,
                newPlaintext: NEW_PLAINTEXT,
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            expect(result.error?.code).toBe('VALIDATION_ERROR');
            expect(mockGetDb).not.toHaveBeenCalled();
            expect(mockEncryptSecret).not.toHaveBeenCalled();
        });

        it('should return VALIDATION_ERROR for an empty newPlaintext', async () => {
            const result = await rotateSocialCredential({
                key: KEY,
                newPlaintext: '',
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            expect(result.error?.code).toBe('VALIDATION_ERROR');
            expect(mockEncryptSecret).not.toHaveBeenCalled();
        });
    });

    describe('when an active credential exists', () => {
        beforeEach(() => {
            mockDbSelectLimit.mockResolvedValue([ACTIVE_CREDENTIAL_ROW]);
        });

        it('should call encryptSecret with the new plaintext', async () => {
            await rotateSocialCredential({
                key: KEY,
                newPlaintext: NEW_PLAINTEXT,
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            expect(mockEncryptSecret).toHaveBeenCalledOnce();
            expect(mockEncryptSecret).toHaveBeenCalledWith({ plaintext: NEW_PLAINTEXT });
        });

        it('should update ciphertext in-place — not the plaintext', async () => {
            const capturedSetValues: unknown[] = [];
            mockDbUpdateSet.mockImplementation(function (vals: unknown) {
                capturedSetValues.push(vals);
                return { where: mockDbUpdateSetWhere };
            });

            await rotateSocialCredential({
                key: KEY,
                newPlaintext: NEW_PLAINTEXT,
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            const updatePayload = capturedSetValues[0] as Record<string, unknown>;
            expect(updatePayload.ciphertext).toBe('MOCK_CIPHERTEXT');
            expect(updatePayload.iv).toBe('MOCK_IV');
            expect(updatePayload.authTag).toBe('MOCK_AUTHTAG');
            expect(JSON.stringify(updatePayload)).not.toContain(NEW_PLAINTEXT);
        });

        it('should insert an audit row with action "rotated"', async () => {
            const allInsertedValues: unknown[] = [];
            mockDbInsertValues.mockImplementation(function (vals: unknown) {
                allInsertedValues.push(vals);
                return { returning: vi.fn().mockResolvedValue([]) };
            });

            await rotateSocialCredential({
                key: KEY,
                newPlaintext: NEW_PLAINTEXT,
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            const auditValues = allInsertedValues[0] as Record<string, unknown>;
            expect(auditValues).toBeDefined();
            expect(auditValues.action).toBe('rotated');
            expect(auditValues.actorId).toBe(ACTOR_ID);
            expect(auditValues.key).toBe(KEY);
        });

        it('should return success with { id, key }', async () => {
            const result = await rotateSocialCredential({
                key: KEY,
                newPlaintext: NEW_PLAINTEXT,
                actorId: ACTOR_ID,
                ipAddress: null
            });

            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(ACTIVE_CREDENTIAL_ROW.id);
            expect(result.data?.key).toBe(KEY);
            expect(result.error).toBeUndefined();
        });
    });

    describe('when no active credential exists', () => {
        it('should return NOT_FOUND', async () => {
            mockDbSelectLimit.mockResolvedValue([]);

            const result = await rotateSocialCredential({
                key: KEY,
                newPlaintext: NEW_PLAINTEXT,
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('NOT_FOUND');
            expect(result.data).toBeUndefined();
            expect(mockEncryptSecret).not.toHaveBeenCalled();
            expect(mockWithTransaction).not.toHaveBeenCalled();
        });
    });
});

describe('updateSocialCredentialMetadata', () => {
    beforeEach(resetAllMocks);
    afterEach(() => vi.clearAllMocks());

    describe('when an active credential exists', () => {
        beforeEach(() => {
            mockDbSelectLimit.mockResolvedValue([ACTIVE_CREDENTIAL_ROW]);
        });

        it('should update the label field', async () => {
            const capturedSetValues: unknown[] = [];
            mockDbUpdateSet.mockImplementation(function (vals: unknown) {
                capturedSetValues.push(vals);
                return { where: mockDbUpdateSetWhere };
            });

            await updateSocialCredentialMetadata({
                key: KEY,
                label: 'Updated label',
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            const updatePayload = capturedSetValues[0] as Record<string, unknown>;
            expect(updatePayload.label).toBe('Updated label');
        });

        it('should insert an audit row with action "updated"', async () => {
            const allInsertedValues: unknown[] = [];
            mockDbInsertValues.mockImplementation(function (vals: unknown) {
                allInsertedValues.push(vals);
                return { returning: vi.fn().mockResolvedValue([]) };
            });

            await updateSocialCredentialMetadata({
                key: KEY,
                label: 'Updated label',
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            const auditValues = allInsertedValues[0] as Record<string, unknown>;
            expect(auditValues.action).toBe('updated');
            expect(auditValues.actorId).toBe(ACTOR_ID);
            expect(auditValues.key).toBe(KEY);
        });

        it('should return success with { id, key }', async () => {
            const result = await updateSocialCredentialMetadata({
                key: KEY,
                label: 'Updated label',
                actorId: ACTOR_ID,
                ipAddress: null
            });

            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(ACTIVE_CREDENTIAL_ROW.id);
            expect(result.data?.key).toBe(KEY);
            expect(result.error).toBeUndefined();
        });
    });

    describe('when no active credential exists', () => {
        it('should return NOT_FOUND', async () => {
            mockDbSelectLimit.mockResolvedValue([]);

            const result = await updateSocialCredentialMetadata({
                key: KEY,
                label: 'Updated label',
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('NOT_FOUND');
            expect(result.data).toBeUndefined();
            expect(mockWithTransaction).not.toHaveBeenCalled();
        });
    });
});

describe('deleteSocialCredential', () => {
    beforeEach(resetAllMocks);
    afterEach(() => vi.clearAllMocks());

    describe('when an active credential exists', () => {
        beforeEach(() => {
            mockDbSelectLimit.mockResolvedValue([ACTIVE_CREDENTIAL_ROW]);
        });

        it('should set deletedAt and deletedById on the credential row', async () => {
            const capturedSetValues: unknown[] = [];
            mockDbUpdateSet.mockImplementation(function (vals: unknown) {
                capturedSetValues.push(vals);
                return { where: mockDbUpdateSetWhere };
            });

            await deleteSocialCredential({
                key: KEY,
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            const updatePayload = capturedSetValues[0] as Record<string, unknown>;
            expect(updatePayload.deletedAt).toBeInstanceOf(Date);
            expect(updatePayload.deletedById).toBe(ACTOR_ID);
        });

        it('should insert an audit row with action "deleted"', async () => {
            const allInsertedValues: unknown[] = [];
            mockDbInsertValues.mockImplementation(function (vals: unknown) {
                allInsertedValues.push(vals);
                return { returning: vi.fn().mockResolvedValue([]) };
            });

            await deleteSocialCredential({
                key: KEY,
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            const auditValues = allInsertedValues[0] as Record<string, unknown>;
            expect(auditValues.action).toBe('deleted');
            expect(auditValues.actorId).toBe(ACTOR_ID);
            expect(auditValues.key).toBe(KEY);
        });

        it('should return success with { key }', async () => {
            const result = await deleteSocialCredential({
                key: KEY,
                actorId: ACTOR_ID,
                ipAddress: null
            });

            expect(result.data).toBeDefined();
            expect(result.data?.key).toBe(KEY);
            expect(result.error).toBeUndefined();
        });
    });

    describe('when no active credential exists (never created, or already deleted)', () => {
        it('should return NOT_FOUND', async () => {
            mockDbSelectLimit.mockResolvedValue([]);

            const result = await deleteSocialCredential({
                key: KEY,
                actorId: ACTOR_ID,
                ipAddress: IP_ADDRESS
            });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('NOT_FOUND');
            expect(result.data).toBeUndefined();
            expect(mockWithTransaction).not.toHaveBeenCalled();
        });
    });
});

describe('listSocialCredentials', () => {
    beforeEach(resetAllMocks);
    afterEach(() => vi.clearAllMocks());

    const ROW = {
        id: 'cred-uuid-1',
        key: KEY,
        label: 'Prod webhook',
        // Real SELECTs never fetch these columns for this function — included
        // here only to prove the mapping step can't leak them even if it did.
        ciphertext: 'SHOULD_NEVER_APPEAR',
        iv: 'SHOULD_NEVER_APPEAR',
        authTag: 'SHOULD_NEVER_APPEAR',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
        deletedAt: null
    };

    it('should return masked items — never ciphertext/iv/authTag', async () => {
        mockDbSelectWhere.mockReturnValue(
            Object.assign(Promise.resolve([ROW]), { limit: mockDbSelectLimit })
        );

        const result = await listSocialCredentials({});

        expect(result.data).toBeDefined();
        expect(result.data?.total).toBe(1);
        const item = result.data?.items[0];
        expect(item).toBeDefined();
        expect(JSON.stringify(item)).not.toContain('SHOULD_NEVER_APPEAR');
        expect(item).not.toHaveProperty('ciphertext');
        expect(item).not.toHaveProperty('iv');
        expect(item).not.toHaveProperty('authTag');
        expect(item?.id).toBe(ROW.id);
        expect(item?.key).toBe(ROW.key);
        expect(item?.label).toBe(ROW.label);
    });

    it('should exclude soft-deleted rows by default (non-undefined where condition)', async () => {
        mockDbSelectWhere.mockReturnValue(
            Object.assign(Promise.resolve([]), { limit: mockDbSelectLimit })
        );

        await listSocialCredentials();

        expect(mockDbSelectWhere).toHaveBeenCalledOnce();
        const conditionArg = mockDbSelectWhere.mock.calls[0]?.[0];
        expect(conditionArg).toBeDefined();
    });
});

describe('getDecryptedSocialCredential', () => {
    beforeEach(resetAllMocks);
    afterEach(() => vi.clearAllMocks());

    const ENCRYPTED_ROW = {
        ciphertext: 'STORED_CIPHERTEXT',
        iv: 'STORED_IV',
        authTag: 'STORED_AUTHTAG'
    };

    describe('when an active credential exists', () => {
        beforeEach(() => {
            mockDbSelectLimit.mockResolvedValue([ENCRYPTED_ROW]);
        });

        it('should call decryptSecret with the stored encrypted values', async () => {
            await getDecryptedSocialCredential({ key: KEY });

            expect(mockDecryptSecret).toHaveBeenCalledOnce();
            expect(mockDecryptSecret).toHaveBeenCalledWith({
                ciphertext: ENCRYPTED_ROW.ciphertext,
                iv: ENCRYPTED_ROW.iv,
                authTag: ENCRYPTED_ROW.authTag
            });
        });

        it('should return the decrypted plaintext', async () => {
            const result = await getDecryptedSocialCredential({ key: KEY });

            expect(result.data).toBeDefined();
            expect(result.data?.plaintext).toBe('decrypted-secret-value');
            expect(result.data?.key).toBe(KEY);
            expect(result.error).toBeUndefined();
        });

        it('should NOT log the plaintext in any logger call (security check)', async () => {
            await getDecryptedSocialCredential({ key: KEY });

            const allLoggerCalls = [
                ...mockApiLogger.info.mock.calls,
                ...mockApiLogger.warn.mock.calls,
                ...mockApiLogger.debug.mock.calls,
                ...mockApiLogger.error.mock.calls
            ];

            for (const callArgs of allLoggerCalls) {
                expect(JSON.stringify(callArgs)).not.toContain('decrypted-secret-value');
            }
        });
    });

    describe('when no active credential exists', () => {
        it('should return NOT_FOUND', async () => {
            mockDbSelectLimit.mockResolvedValue([]);

            const result = await getDecryptedSocialCredential({ key: KEY });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('NOT_FOUND');
            expect(result.data).toBeUndefined();
            expect(mockDecryptSecret).not.toHaveBeenCalled();
        });
    });
});
