/**
 * Tests for the MercadoLibre OAuth credential repository (HOS-45 T-005).
 *
 * ## Coverage
 *
 * getActiveMLCredential:
 *   1. Returns `null` when no active row exists.
 *   2. Returns the decrypted `{ accessToken, refreshToken, expiresAt }` when
 *      a row exists, with `decryptSecret` called with the correct
 *      ciphertext/iv/authTag pair for each secret (never swapped).
 *
 * upsertMLCredential:
 *   3. Inserts a new row when none exists — `encryptSecret` called twice,
 *      insert values carry ciphertext, never plaintext.
 *   4. Updates the existing row in place when one exists (not a second insert).
 *   5. Falls back to an `UPDATE` when a concurrent insert triggers a `23505`
 *      unique-violation, instead of throwing.
 *
 * Regression:
 *   6. No plaintext token string ever appears in a DB-write call argument.
 *
 * @module test/services/mercadolibre-oauth/ml-credential.repository
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
    // ---- insert chain: .values() (no .returning(), resolves directly) ----
    const mockDbInsertValues = vi.fn().mockResolvedValue(undefined);
    const mockDbInsert = vi.fn().mockReturnValue({ values: mockDbInsertValues });

    // ---- update chain: .set().where() ----
    const mockDbUpdateSetWhere = vi.fn().mockResolvedValue(undefined);
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

    const mockDecryptSecret = vi.fn().mockReturnValue({ plaintext: 'decrypted-value' });

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
    externalOauthCredentials: {
        id: 'id',
        provider: 'provider',
        accessTokenCiphertext: 'accessTokenCiphertext',
        accessTokenIv: 'accessTokenIv',
        accessTokenAuthTag: 'accessTokenAuthTag',
        refreshTokenCiphertext: 'refreshTokenCiphertext',
        refreshTokenIv: 'refreshTokenIv',
        refreshTokenAuthTag: 'refreshTokenAuthTag',
        expiresAt: 'expiresAt',
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        deletedAt: 'deletedAt'
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

vi.mock('../../../src/utils/oauth-vault.js', () => ({
    encryptSecret: mockEncryptSecret,
    decryptSecret: mockDecryptSecret
}));

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: mockApiLogger
}));

// ---------------------------------------------------------------------------
// Import SUT (after mocks)
// ---------------------------------------------------------------------------

import {
    getActiveMLCredential,
    upsertMLCredential
} from '../../../src/services/mercadolibre-oauth/ml-credential.repository';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ACCESS_TOKEN = 'APP_USR-access-token-do-not-log';
const REFRESH_TOKEN = 'TG-refresh-token-do-not-log';
const EXPIRES_AT = new Date('2026-08-01T00:00:00.000Z');

// Active credential row returned by the existence-check select
const ACTIVE_ROW_ID = { id: 'ml-cred-uuid-existing' };

// Full encrypted row returned by getActiveMLCredential's select
const ENCRYPTED_ROW = {
    accessTokenCiphertext: 'STORED_ACCESS_CIPHERTEXT',
    accessTokenIv: 'STORED_ACCESS_IV',
    accessTokenAuthTag: 'STORED_ACCESS_AUTHTAG',
    refreshTokenCiphertext: 'STORED_REFRESH_CIPHERTEXT',
    refreshTokenIv: 'STORED_REFRESH_IV',
    refreshTokenAuthTag: 'STORED_REFRESH_AUTHTAG',
    expiresAt: EXPIRES_AT
};

// ---------------------------------------------------------------------------
// Helper: reset all mock state between tests
// ---------------------------------------------------------------------------

function resetAllMocks(): void {
    vi.clearAllMocks();

    // Default select: no active row (empty result)
    mockDbSelectLimit.mockResolvedValue([]);
    mockDbSelectWhere.mockReturnValue({ limit: mockDbSelectLimit });

    const mockDbSelectFrom = vi.fn().mockReturnValue({ where: mockDbSelectWhere });
    mockDbSelectChain.mockReturnValue({ from: mockDbSelectFrom });

    mockGetDb.mockReturnValue({
        select: mockDbSelectChain,
        insert: mockDbInsert,
        update: mockDbUpdate
    });

    mockWithTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
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

    mockDecryptSecret.mockReturnValue({ plaintext: 'decrypted-value' });

    mockDbInsertValues.mockResolvedValue(undefined);
    mockDbInsert.mockReturnValue({ values: mockDbInsertValues });

    mockDbUpdateSetWhere.mockResolvedValue(undefined);
    mockDbUpdateSet.mockReturnValue({ where: mockDbUpdateSetWhere });
    mockDbUpdate.mockReturnValue({ set: mockDbUpdateSet });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getActiveMLCredential', () => {
    beforeEach(resetAllMocks);
    afterEach(() => vi.clearAllMocks());

    describe('when no active row exists', () => {
        it('should return null', async () => {
            // Arrange
            mockDbSelectLimit.mockResolvedValue([]);

            // Act
            const result = await getActiveMLCredential();

            // Assert
            expect(result).toBeNull();
            expect(mockDecryptSecret).not.toHaveBeenCalled();
        });
    });

    describe('when an active row exists', () => {
        beforeEach(() => {
            mockDbSelectLimit.mockResolvedValue([ENCRYPTED_ROW]);
            mockDecryptSecret.mockImplementation(
                (input: { ciphertext: string; iv: string; authTag: string }) => {
                    if (input.ciphertext === ENCRYPTED_ROW.accessTokenCiphertext) {
                        return { plaintext: ACCESS_TOKEN };
                    }
                    if (input.ciphertext === ENCRYPTED_ROW.refreshTokenCiphertext) {
                        return { plaintext: REFRESH_TOKEN };
                    }
                    throw new Error(`Unexpected decryptSecret input: ${JSON.stringify(input)}`);
                }
            );
        });

        it('should call decryptSecret with the correct access-token ciphertext/iv/authTag triplet', async () => {
            // Act
            await getActiveMLCredential();

            // Assert
            expect(mockDecryptSecret).toHaveBeenCalledWith({
                ciphertext: ENCRYPTED_ROW.accessTokenCiphertext,
                iv: ENCRYPTED_ROW.accessTokenIv,
                authTag: ENCRYPTED_ROW.accessTokenAuthTag
            });
        });

        it('should call decryptSecret with the correct refresh-token ciphertext/iv/authTag triplet', async () => {
            // Act
            await getActiveMLCredential();

            // Assert
            expect(mockDecryptSecret).toHaveBeenCalledWith({
                ciphertext: ENCRYPTED_ROW.refreshTokenCiphertext,
                iv: ENCRYPTED_ROW.refreshTokenIv,
                authTag: ENCRYPTED_ROW.refreshTokenAuthTag
            });
        });

        it('should never call decryptSecret with a swapped access/refresh column pair', async () => {
            // Act
            await getActiveMLCredential();

            // Assert — neither call mixes an access-token field with a refresh-token field
            for (const call of mockDecryptSecret.mock.calls) {
                const [input] = call as [{ ciphertext: string; iv: string; authTag: string }];
                const isAccessTriplet =
                    input.ciphertext === ENCRYPTED_ROW.accessTokenCiphertext &&
                    input.iv === ENCRYPTED_ROW.accessTokenIv &&
                    input.authTag === ENCRYPTED_ROW.accessTokenAuthTag;
                const isRefreshTriplet =
                    input.ciphertext === ENCRYPTED_ROW.refreshTokenCiphertext &&
                    input.iv === ENCRYPTED_ROW.refreshTokenIv &&
                    input.authTag === ENCRYPTED_ROW.refreshTokenAuthTag;
                expect(isAccessTriplet || isRefreshTriplet).toBe(true);
            }
        });

        it('should return the decrypted { accessToken, refreshToken, expiresAt }', async () => {
            // Act
            const result = await getActiveMLCredential();

            // Assert
            expect(result).toEqual({
                accessToken: ACCESS_TOKEN,
                refreshToken: REFRESH_TOKEN,
                expiresAt: EXPIRES_AT
            });
        });
    });
});

describe('upsertMLCredential', () => {
    beforeEach(resetAllMocks);
    afterEach(() => vi.clearAllMocks());

    describe('when no active row exists', () => {
        beforeEach(() => {
            mockDbSelectLimit.mockResolvedValue([]);
        });

        it('should call encryptSecret once per secret (access + refresh)', async () => {
            // Act
            await upsertMLCredential({
                accessToken: ACCESS_TOKEN,
                refreshToken: REFRESH_TOKEN,
                expiresAt: EXPIRES_AT
            });

            // Assert
            expect(mockEncryptSecret).toHaveBeenCalledTimes(2);
            expect(mockEncryptSecret).toHaveBeenCalledWith({ plaintext: ACCESS_TOKEN });
            expect(mockEncryptSecret).toHaveBeenCalledWith({ plaintext: REFRESH_TOKEN });
        });

        it('should insert a new row with ciphertext, never plaintext', async () => {
            // Arrange
            const capturedValues: unknown[] = [];
            mockDbInsertValues.mockImplementation((vals: unknown) => {
                capturedValues.push(vals);
                return Promise.resolve(undefined);
            });

            // Act
            await upsertMLCredential({
                accessToken: ACCESS_TOKEN,
                refreshToken: REFRESH_TOKEN,
                expiresAt: EXPIRES_AT
            });

            // Assert
            expect(mockDbInsert).toHaveBeenCalledOnce();
            const insertedValues = capturedValues[0] as Record<string, unknown>;
            expect(insertedValues.provider).toBe('mercadolibre');
            expect(insertedValues.accessTokenCiphertext).toBe('MOCK_CIPHERTEXT');
            expect(insertedValues.refreshTokenCiphertext).toBe('MOCK_CIPHERTEXT');
            expect(JSON.stringify(insertedValues)).not.toContain(ACCESS_TOKEN);
            expect(JSON.stringify(insertedValues)).not.toContain(REFRESH_TOKEN);
            expect(mockDbUpdate).not.toHaveBeenCalled();
        });
    });

    describe('when an active row already exists', () => {
        beforeEach(() => {
            mockDbSelectLimit.mockResolvedValue([ACTIVE_ROW_ID]);
        });

        it('should update the existing row in place, not insert a new one', async () => {
            // Arrange
            const capturedSetValues: unknown[] = [];
            mockDbUpdateSet.mockImplementation((vals: unknown) => {
                capturedSetValues.push(vals);
                return { where: mockDbUpdateSetWhere };
            });

            // Act
            await upsertMLCredential({
                accessToken: ACCESS_TOKEN,
                refreshToken: REFRESH_TOKEN,
                expiresAt: EXPIRES_AT
            });

            // Assert
            expect(mockDbInsert).not.toHaveBeenCalled();
            expect(mockDbUpdate).toHaveBeenCalledOnce();
            const updatePayload = capturedSetValues[0] as Record<string, unknown>;
            expect(updatePayload.accessTokenCiphertext).toBe('MOCK_CIPHERTEXT');
            expect(updatePayload.refreshTokenCiphertext).toBe('MOCK_CIPHERTEXT');
            expect(updatePayload.updatedAt).toBeInstanceOf(Date);
            expect(JSON.stringify(updatePayload)).not.toContain(ACCESS_TOKEN);
            expect(JSON.stringify(updatePayload)).not.toContain(REFRESH_TOKEN);
        });
    });

    describe('when a concurrent insert races past the existence check (23505)', () => {
        it('should fall back to an UPDATE instead of throwing', async () => {
            // Arrange — the transactional path throws a unique-violation,
            // simulating a second caller's insert winning the race.
            mockWithTransaction.mockImplementation(async () => {
                const pgError = new Error('duplicate key value violates unique constraint');
                (pgError as unknown as { code: string }).code = '23505';
                throw pgError;
            });

            // The post-race re-check (via getDb(), not tx) finds the row the
            // racing insert created.
            mockDbSelectLimit.mockResolvedValue([ACTIVE_ROW_ID]);

            const capturedSetValues: unknown[] = [];
            mockDbUpdateSet.mockImplementation((vals: unknown) => {
                capturedSetValues.push(vals);
                return { where: mockDbUpdateSetWhere };
            });

            // Act — must resolve, not throw
            await expect(
                upsertMLCredential({
                    accessToken: ACCESS_TOKEN,
                    refreshToken: REFRESH_TOKEN,
                    expiresAt: EXPIRES_AT
                })
            ).resolves.toBeUndefined();

            // Assert — fell back to an update, not left unhandled
            expect(mockDbUpdate).toHaveBeenCalledOnce();
            const updatePayload = capturedSetValues[0] as Record<string, unknown>;
            expect(updatePayload.accessTokenCiphertext).toBe('MOCK_CIPHERTEXT');
            expect(JSON.stringify(updatePayload)).not.toContain(ACCESS_TOKEN);
            expect(JSON.stringify(updatePayload)).not.toContain(REFRESH_TOKEN);
        });

        it('should re-throw the original error when no row is found on re-check', async () => {
            // Arrange — race error thrown, but the post-race re-check finds
            // nothing (pathological case: row deleted mid-race).
            mockWithTransaction.mockImplementation(async () => {
                const pgError = new Error('duplicate key value violates unique constraint');
                (pgError as unknown as { code: string }).code = '23505';
                throw pgError;
            });
            mockDbSelectLimit.mockResolvedValue([]);

            // Act / Assert
            await expect(
                upsertMLCredential({
                    accessToken: ACCESS_TOKEN,
                    refreshToken: REFRESH_TOKEN,
                    expiresAt: EXPIRES_AT
                })
            ).rejects.toThrow('duplicate key value violates unique constraint');
        });

        it('should re-throw non-unique-violation errors without a fallback update', async () => {
            // Arrange
            mockWithTransaction.mockImplementation(async () => {
                throw new Error('connection reset');
            });

            // Act / Assert
            await expect(
                upsertMLCredential({
                    accessToken: ACCESS_TOKEN,
                    refreshToken: REFRESH_TOKEN,
                    expiresAt: EXPIRES_AT
                })
            ).rejects.toThrow('connection reset');
            expect(mockDbUpdate).not.toHaveBeenCalled();
        });
    });
});

describe('no plaintext token leakage (regression)', () => {
    beforeEach(resetAllMocks);
    afterEach(() => vi.clearAllMocks());

    it('should never pass a plaintext access or refresh token to a DB-write call argument', async () => {
        // Arrange — capture every insert().values() and update().set() payload
        const capturedInsertValues: unknown[] = [];
        const capturedUpdateValues: unknown[] = [];
        mockDbInsertValues.mockImplementation((vals: unknown) => {
            capturedInsertValues.push(vals);
            return Promise.resolve(undefined);
        });
        mockDbUpdateSet.mockImplementation((vals: unknown) => {
            capturedUpdateValues.push(vals);
            return { where: mockDbUpdateSetWhere };
        });

        // Act — exercise both insert (no existing row) and update (existing row) paths
        mockDbSelectLimit.mockResolvedValue([]);
        await upsertMLCredential({
            accessToken: ACCESS_TOKEN,
            refreshToken: REFRESH_TOKEN,
            expiresAt: EXPIRES_AT
        });

        mockDbSelectLimit.mockResolvedValue([ACTIVE_ROW_ID]);
        await upsertMLCredential({
            accessToken: ACCESS_TOKEN,
            refreshToken: REFRESH_TOKEN,
            expiresAt: EXPIRES_AT
        });

        // Assert — inspect every captured write payload for plaintext leakage
        const allWritePayloads = [...capturedInsertValues, ...capturedUpdateValues];
        expect(allWritePayloads.length).toBeGreaterThan(0);
        for (const payload of allWritePayloads) {
            const serialized = JSON.stringify(payload);
            expect(serialized).not.toContain(ACCESS_TOKEN);
            expect(serialized).not.toContain(REFRESH_TOKEN);
            // Only ciphertext/iv/authTag fields (and provider/expiresAt/updatedAt)
            // are allowed — no plaintext-carrying field names either.
            expect(payload).not.toHaveProperty('accessToken');
            expect(payload).not.toHaveProperty('refreshToken');
        }
    });
});
