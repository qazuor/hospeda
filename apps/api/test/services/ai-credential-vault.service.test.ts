/**
 * Tests for ai-credential-vault service (SPEC-173 T-022).
 *
 * ## Coverage
 *
 * create:
 *   1. encryptSecret is called with the plaintext key.
 *   2. The inserted row carries ciphertext, NOT the plaintext (AC-3 store half).
 *   3. An audit row with action 'created', actorId, and providerId is inserted.
 *   4. Returns VALIDATION_ERROR when an active credential already exists.
 *
 * rotate:
 *   5. Updates ciphertext in-place and inserts audit 'rotated'.
 *   6. Returns NOT_FOUND when no active credential exists.
 *
 * delete:
 *   7. Sets deletedAt + deletedById and inserts audit 'deleted'.
 *   8. Returns NOT_FOUND when no active credential exists.
 *
 * getDecrypted:
 *   9. Returns plaintext via decryptSecret.
 *  10. Returns NOT_FOUND when no active credential exists.
 *  11. Plaintext is NOT present in any apiLogger call (security check).
 *
 * @module test/services/ai-credential-vault.service
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
    // ---- insert chain: .values().returning() ----
    const mockDbInsertValuesReturning = vi.fn().mockResolvedValue([{ id: 'new-cred-uuid' }]);
    const mockDbInsertValues = vi.fn().mockReturnValue({
        returning: mockDbInsertValuesReturning
    });
    const mockDbInsert = vi.fn().mockReturnValue({ values: mockDbInsertValues });

    // ---- insert chain for audit (no .returning()) ----
    // The audit insert uses .values() without .returning().
    // We need mockDbInsert to be callable for both credential and audit inserts.
    // The first call gets the credential chain; subsequent calls in the tx get the audit chain.
    // We'll reset per-test where needed.

    // ---- update chain: .set().where() ----
    const mockDbUpdateSetWhere = vi.fn().mockResolvedValue({ rowCount: 1 });
    const mockDbUpdateSet = vi.fn().mockReturnValue({ where: mockDbUpdateSetWhere });
    const mockDbUpdate = vi.fn().mockReturnValue({ set: mockDbUpdateSet });

    // ---- select chain: .from().where().limit() ----
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

    const mockDecryptSecret = vi.fn().mockReturnValue({ plaintext: 'sk-decrypted-key' });

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
        mockApiLogger,
        mockDbInsertValuesReturning: mockDbInsertValuesReturning
    };
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
    withTransaction: mockWithTransaction,
    aiProviderCredentials: {
        id: 'id',
        providerId: 'providerId',
        ciphertext: 'ciphertext',
        iv: 'iv',
        authTag: 'authTag',
        label: 'label',
        metadata: 'metadata',
        deletedAt: 'deletedAt',
        deletedById: 'deletedById',
        updatedAt: 'updatedAt'
    },
    aiCredentialAudit: {
        id: 'id',
        actorId: 'actorId',
        action: 'action',
        providerId: 'providerId',
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

vi.mock('../../src/utils/ai-vault.js', () => ({
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
    createAiProviderCredential,
    deleteAiProviderCredential,
    getDecryptedAiProviderCredential,
    rotateAiProviderCredential
} from '../../src/services/ai-credential-vault.service';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const MOCK_ACTOR = {
    id: 'actor-uuid-0001',
    role: 'SUPER_ADMIN' as const,
    permissions: [] as never[]
} as Parameters<typeof createAiProviderCredential>[0]['actor'];

const PROVIDER_ID = 'openai';
const PLAINTEXT_KEY = 'sk-live-test-key-do-not-log';
const NEW_PLAINTEXT_KEY = 'sk-live-rotated-key';
const IP_ADDRESS = '192.168.1.1';

// Active credential row returned by select
const ACTIVE_CREDENTIAL_ROW = { id: 'cred-uuid-existing' };

// Row returned for getDecrypted query
const ENCRYPTED_CREDENTIAL_ROW = {
    ciphertext: 'STORED_CIPHERTEXT',
    iv: 'STORED_IV',
    authTag: 'STORED_AUTHTAG'
};

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

    // Default db object
    mockGetDb.mockReturnValue({
        select: mockDbSelectChain,
        insert: mockDbInsert,
        update: mockDbUpdate
    });

    // Default withTransaction: calls callback with tx that has insert/update
    mockWithTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
        const tx = {
            insert: mockDbInsert,
            update: mockDbUpdate,
            select: mockDbSelectChain
        };
        await cb(tx);
    });

    // Default encrypt
    mockEncryptSecret.mockReturnValue({
        ciphertext: 'MOCK_CIPHERTEXT',
        iv: 'MOCK_IV',
        authTag: 'MOCK_AUTHTAG'
    });

    // Default decrypt
    mockDecryptSecret.mockReturnValue({ plaintext: 'sk-decrypted-key' });

    // Default insert chain: credential insert returns [{ id }]
    const returningMock = vi.fn().mockResolvedValue([{ id: 'new-cred-uuid' }]);
    mockDbInsertValues.mockReturnValue({ returning: returningMock });
    mockDbInsert.mockReturnValue({ values: mockDbInsertValues });

    // Default update chain
    mockDbUpdateSetWhere.mockResolvedValue({ rowCount: 1 });
    mockDbUpdateSet.mockReturnValue({ where: mockDbUpdateSetWhere });
    mockDbUpdate.mockReturnValue({ set: mockDbUpdateSet });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createAiProviderCredential', () => {
    beforeEach(resetAllMocks);
    afterEach(() => vi.clearAllMocks());

    describe('when no active credential exists', () => {
        it('should call encryptSecret with the plaintext key', async () => {
            // Arrange — select returns empty (no existing credential)
            mockDbSelectLimit.mockResolvedValue([]);

            // Act
            await createAiProviderCredential({
                actor: MOCK_ACTOR,
                ipAddress: IP_ADDRESS,
                providerId: PROVIDER_ID,
                plaintextKey: PLAINTEXT_KEY
            });

            // Assert — encryptSecret called with the plaintext
            expect(mockEncryptSecret).toHaveBeenCalledOnce();
            expect(mockEncryptSecret).toHaveBeenCalledWith({ plaintext: PLAINTEXT_KEY });
        });

        it('should insert a row carrying ciphertext — not the plaintext (AC-3)', async () => {
            // Arrange
            mockDbSelectLimit.mockResolvedValue([]);

            // Capture what was passed to insert().values()
            const capturedValues: unknown[] = [];
            mockDbInsertValues.mockImplementation((vals: unknown) => {
                capturedValues.push(vals);
                const returningMock = vi.fn().mockResolvedValue([{ id: 'new-cred-uuid' }]);
                return { returning: returningMock };
            });

            // Act
            await createAiProviderCredential({
                actor: MOCK_ACTOR,
                ipAddress: IP_ADDRESS,
                providerId: PROVIDER_ID,
                plaintextKey: PLAINTEXT_KEY,
                label: 'prod key'
            });

            // Assert — credential insert values contain ciphertext, NOT plaintextKey
            const credentialInsertValues = capturedValues[0] as Record<string, unknown>;
            expect(credentialInsertValues).toBeDefined();
            expect(credentialInsertValues.ciphertext).toBe('MOCK_CIPHERTEXT');
            expect(credentialInsertValues.iv).toBe('MOCK_IV');
            expect(credentialInsertValues.authTag).toBe('MOCK_AUTHTAG');
            // Plaintext must NOT appear in any field
            expect(JSON.stringify(credentialInsertValues)).not.toContain(PLAINTEXT_KEY);
        });

        it('should insert an audit row with action "created", actorId, and providerId', async () => {
            // Arrange
            mockDbSelectLimit.mockResolvedValue([]);

            const allInsertedValues: unknown[] = [];
            mockDbInsertValues.mockImplementation((vals: unknown) => {
                allInsertedValues.push(vals);
                const returningMock = vi.fn().mockResolvedValue([{ id: 'new-cred-uuid' }]);
                return { returning: returningMock };
            });

            // Act
            await createAiProviderCredential({
                actor: MOCK_ACTOR,
                ipAddress: IP_ADDRESS,
                providerId: PROVIDER_ID,
                plaintextKey: PLAINTEXT_KEY
            });

            // Assert — second insert (audit row)
            const auditValues = allInsertedValues[1] as Record<string, unknown>;
            expect(auditValues).toBeDefined();
            expect(auditValues.action).toBe('created');
            expect(auditValues.actorId).toBe(MOCK_ACTOR.id);
            expect(auditValues.providerId).toBe(PROVIDER_ID);
        });

        it('should return success with { id, providerId }', async () => {
            // Arrange
            mockDbSelectLimit.mockResolvedValue([]);
            const returningMock = vi.fn().mockResolvedValue([{ id: 'new-cred-uuid' }]);
            mockDbInsertValues.mockReturnValue({ returning: returningMock });

            // Act
            const result = await createAiProviderCredential({
                actor: MOCK_ACTOR,
                ipAddress: null,
                providerId: PROVIDER_ID,
                plaintextKey: PLAINTEXT_KEY
            });

            // Assert
            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe('new-cred-uuid');
            expect(result.data?.providerId).toBe(PROVIDER_ID);
            expect(result.error).toBeUndefined();
        });
    });

    describe('when an active credential already exists', () => {
        it('should return VALIDATION_ERROR and not call encryptSecret', async () => {
            // Arrange — select returns an existing row
            mockDbSelectLimit.mockResolvedValue([ACTIVE_CREDENTIAL_ROW]);

            // Act
            const result = await createAiProviderCredential({
                actor: MOCK_ACTOR,
                ipAddress: IP_ADDRESS,
                providerId: PROVIDER_ID,
                plaintextKey: PLAINTEXT_KEY
            });

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('VALIDATION_ERROR');
            expect(result.data).toBeUndefined();
            expect(mockEncryptSecret).not.toHaveBeenCalled();
            expect(mockWithTransaction).not.toHaveBeenCalled();
        });
    });
});

describe('rotateAiProviderCredential', () => {
    beforeEach(resetAllMocks);
    afterEach(() => vi.clearAllMocks());

    describe('when an active credential exists', () => {
        beforeEach(() => {
            mockDbSelectLimit.mockResolvedValue([ACTIVE_CREDENTIAL_ROW]);
        });

        it('should call encryptSecret with the new plaintext key', async () => {
            // Arrange — select returns an existing credential
            // Act
            await rotateAiProviderCredential({
                actor: MOCK_ACTOR,
                ipAddress: IP_ADDRESS,
                providerId: PROVIDER_ID,
                newPlaintextKey: NEW_PLAINTEXT_KEY
            });

            // Assert
            expect(mockEncryptSecret).toHaveBeenCalledOnce();
            expect(mockEncryptSecret).toHaveBeenCalledWith({ plaintext: NEW_PLAINTEXT_KEY });
        });

        it('should update ciphertext in-place on the existing row', async () => {
            // Arrange — capture what was passed to update().set()
            const capturedSetValues: unknown[] = [];
            mockDbUpdateSet.mockImplementation((vals: unknown) => {
                capturedSetValues.push(vals);
                return { where: mockDbUpdateSetWhere };
            });

            // Act
            await rotateAiProviderCredential({
                actor: MOCK_ACTOR,
                ipAddress: IP_ADDRESS,
                providerId: PROVIDER_ID,
                newPlaintextKey: NEW_PLAINTEXT_KEY
            });

            // Assert — set() received the new ciphertext fields, not the plaintext
            const updatePayload = capturedSetValues[0] as Record<string, unknown>;
            expect(updatePayload.ciphertext).toBe('MOCK_CIPHERTEXT');
            expect(updatePayload.iv).toBe('MOCK_IV');
            expect(updatePayload.authTag).toBe('MOCK_AUTHTAG');
            expect(JSON.stringify(updatePayload)).not.toContain(NEW_PLAINTEXT_KEY);
        });

        it('should insert an audit row with action "rotated"', async () => {
            // Arrange — capture all insert().values() calls
            const allInsertedValues: unknown[] = [];
            mockDbInsertValues.mockImplementation((vals: unknown) => {
                allInsertedValues.push(vals);
                const returningMock = vi.fn().mockResolvedValue([]);
                return { returning: returningMock };
            });

            // Act
            await rotateAiProviderCredential({
                actor: MOCK_ACTOR,
                ipAddress: IP_ADDRESS,
                providerId: PROVIDER_ID,
                newPlaintextKey: NEW_PLAINTEXT_KEY
            });

            // Assert — audit insert
            const auditValues = allInsertedValues[0] as Record<string, unknown>;
            expect(auditValues).toBeDefined();
            expect(auditValues.action).toBe('rotated');
            expect(auditValues.actorId).toBe(MOCK_ACTOR.id);
            expect(auditValues.providerId).toBe(PROVIDER_ID);
        });

        it('should return success with { id, providerId }', async () => {
            // Act
            const result = await rotateAiProviderCredential({
                actor: MOCK_ACTOR,
                ipAddress: null,
                providerId: PROVIDER_ID,
                newPlaintextKey: NEW_PLAINTEXT_KEY
            });

            // Assert
            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(ACTIVE_CREDENTIAL_ROW.id);
            expect(result.data?.providerId).toBe(PROVIDER_ID);
            expect(result.error).toBeUndefined();
        });
    });

    describe('when no active credential exists', () => {
        it('should return NOT_FOUND', async () => {
            // Arrange — select returns empty
            mockDbSelectLimit.mockResolvedValue([]);

            // Act
            const result = await rotateAiProviderCredential({
                actor: MOCK_ACTOR,
                ipAddress: IP_ADDRESS,
                providerId: PROVIDER_ID,
                newPlaintextKey: NEW_PLAINTEXT_KEY
            });

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('NOT_FOUND');
            expect(result.data).toBeUndefined();
            expect(mockEncryptSecret).not.toHaveBeenCalled();
            expect(mockWithTransaction).not.toHaveBeenCalled();
        });
    });
});

describe('deleteAiProviderCredential', () => {
    beforeEach(resetAllMocks);
    afterEach(() => vi.clearAllMocks());

    describe('when an active credential exists', () => {
        beforeEach(() => {
            mockDbSelectLimit.mockResolvedValue([ACTIVE_CREDENTIAL_ROW]);
        });

        it('should set deletedAt and deletedById on the credential row', async () => {
            // Arrange — capture update().set() payload
            const capturedSetValues: unknown[] = [];
            mockDbUpdateSet.mockImplementation((vals: unknown) => {
                capturedSetValues.push(vals);
                return { where: mockDbUpdateSetWhere };
            });

            // Act
            await deleteAiProviderCredential({
                actor: MOCK_ACTOR,
                ipAddress: IP_ADDRESS,
                providerId: PROVIDER_ID
            });

            // Assert — soft-delete fields set
            const updatePayload = capturedSetValues[0] as Record<string, unknown>;
            expect(updatePayload.deletedAt).toBeInstanceOf(Date);
            expect(updatePayload.deletedById).toBe(MOCK_ACTOR.id);
        });

        it('should insert an audit row with action "deleted"', async () => {
            // Arrange — capture insert().values() calls
            const allInsertedValues: unknown[] = [];
            mockDbInsertValues.mockImplementation((vals: unknown) => {
                allInsertedValues.push(vals);
                const returningMock = vi.fn().mockResolvedValue([]);
                return { returning: returningMock };
            });

            // Act
            await deleteAiProviderCredential({
                actor: MOCK_ACTOR,
                ipAddress: IP_ADDRESS,
                providerId: PROVIDER_ID
            });

            // Assert — audit row
            const auditValues = allInsertedValues[0] as Record<string, unknown>;
            expect(auditValues).toBeDefined();
            expect(auditValues.action).toBe('deleted');
            expect(auditValues.actorId).toBe(MOCK_ACTOR.id);
            expect(auditValues.providerId).toBe(PROVIDER_ID);
        });

        it('should return success with { providerId }', async () => {
            // Act
            const result = await deleteAiProviderCredential({
                actor: MOCK_ACTOR,
                ipAddress: null,
                providerId: PROVIDER_ID
            });

            // Assert
            expect(result.data).toBeDefined();
            expect(result.data?.providerId).toBe(PROVIDER_ID);
            expect(result.error).toBeUndefined();
        });
    });

    describe('when no active credential exists', () => {
        it('should return NOT_FOUND', async () => {
            // Arrange — select returns empty
            mockDbSelectLimit.mockResolvedValue([]);

            // Act
            const result = await deleteAiProviderCredential({
                actor: MOCK_ACTOR,
                ipAddress: IP_ADDRESS,
                providerId: PROVIDER_ID
            });

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('NOT_FOUND');
            expect(result.data).toBeUndefined();
            expect(mockWithTransaction).not.toHaveBeenCalled();
        });
    });
});

describe('getDecryptedAiProviderCredential', () => {
    beforeEach(resetAllMocks);
    afterEach(() => vi.clearAllMocks());

    describe('when an active credential exists', () => {
        beforeEach(() => {
            mockDbSelectLimit.mockResolvedValue([ENCRYPTED_CREDENTIAL_ROW]);
        });

        it('should call decryptSecret with the stored encrypted values', async () => {
            // Act
            await getDecryptedAiProviderCredential({ providerId: PROVIDER_ID });

            // Assert
            expect(mockDecryptSecret).toHaveBeenCalledOnce();
            expect(mockDecryptSecret).toHaveBeenCalledWith({
                ciphertext: ENCRYPTED_CREDENTIAL_ROW.ciphertext,
                iv: ENCRYPTED_CREDENTIAL_ROW.iv,
                authTag: ENCRYPTED_CREDENTIAL_ROW.authTag
            });
        });

        it('should return the decrypted plaintext key', async () => {
            // Act
            const result = await getDecryptedAiProviderCredential({ providerId: PROVIDER_ID });

            // Assert
            expect(result.data).toBeDefined();
            expect(result.data?.plaintextKey).toBe('sk-decrypted-key');
            expect(result.data?.providerId).toBe(PROVIDER_ID);
            expect(result.error).toBeUndefined();
        });

        it('should NOT log the plaintext key in any logger call (security check)', async () => {
            // Act
            await getDecryptedAiProviderCredential({ providerId: PROVIDER_ID });

            // Assert — inspect every logger call for the plaintext value
            const allLoggerCalls = [
                ...mockApiLogger.info.mock.calls,
                ...mockApiLogger.warn.mock.calls,
                ...mockApiLogger.debug.mock.calls,
                ...mockApiLogger.error.mock.calls
            ];

            for (const callArgs of allLoggerCalls) {
                expect(JSON.stringify(callArgs)).not.toContain('sk-decrypted-key');
            }
        });
    });

    describe('when no active credential exists', () => {
        it('should return NOT_FOUND', async () => {
            // Arrange — select returns empty
            mockDbSelectLimit.mockResolvedValue([]);

            // Act
            const result = await getDecryptedAiProviderCredential({ providerId: PROVIDER_ID });

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('NOT_FOUND');
            expect(result.data).toBeUndefined();
            expect(mockDecryptSecret).not.toHaveBeenCalled();
        });
    });
});
