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
 * @module test/services/social-credential-vault.service
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state (vi.hoisted runs before vi.mock factories)
// ---------------------------------------------------------------------------

const {
    mockEncryptSecret,
    mockWithTransaction,
    mockGetDb,
    mockDbSelectChain,
    mockDbInsert,
    mockDbInsertValues,
    mockDbSelectWhere,
    mockDbSelectLimit,
    mockApiLogger
} = vi.hoisted(() => {
    const mockDbInsertValuesReturning = vi.fn().mockResolvedValue([{ id: 'new-cred-uuid' }]);
    const mockDbInsertValues = vi.fn().mockReturnValue({
        returning: mockDbInsertValuesReturning
    });
    const mockDbInsert = vi.fn().mockReturnValue({ values: mockDbInsertValues });

    const mockDbSelectLimit = vi.fn().mockResolvedValue([]);
    const mockDbSelectWhere = vi.fn().mockReturnValue({ limit: mockDbSelectLimit });
    const mockDbSelectFrom = vi.fn().mockReturnValue({ where: mockDbSelectWhere });
    const mockDbSelectChain = vi.fn().mockReturnValue({ from: mockDbSelectFrom });

    const mockGetDb = vi.fn().mockReturnValue({
        select: mockDbSelectChain,
        insert: mockDbInsert
    });

    // withTransaction: immediately calls the callback with a tx mock
    const mockWithTransaction = vi
        .fn()
        .mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
            const tx = {
                insert: mockDbInsert,
                select: mockDbSelectChain
            };
            await cb(tx);
        });

    const mockEncryptSecret = vi.fn().mockReturnValue({
        ciphertext: 'MOCK_CIPHERTEXT',
        iv: 'MOCK_IV',
        authTag: 'MOCK_AUTHTAG'
    });

    const mockApiLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        error: vi.fn()
    };

    return {
        mockEncryptSecret,
        mockWithTransaction,
        mockGetDb,
        mockDbSelectChain,
        mockDbInsert,
        mockDbInsertValues,
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
    encryptSecret: mockEncryptSecret
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: mockApiLogger
}));

// ---------------------------------------------------------------------------
// Import SUT (after mocks)
// ---------------------------------------------------------------------------

import { createSocialCredential } from '../../src/services/social-credential-vault.service';

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
        insert: mockDbInsert
    });

    mockWithTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
        const tx = {
            insert: mockDbInsert,
            select: mockDbSelectChain
        };
        await cb(tx);
    });

    mockEncryptSecret.mockReturnValue({
        ciphertext: 'MOCK_CIPHERTEXT',
        iv: 'MOCK_IV',
        authTag: 'MOCK_AUTHTAG'
    });

    const returningMock = vi.fn().mockResolvedValue([{ id: 'new-cred-uuid' }]);
    mockDbInsertValues.mockReturnValue({ returning: returningMock });
    mockDbInsert.mockReturnValue({ values: mockDbInsertValues });
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
            mockDbInsertValues.mockImplementation((vals: unknown) => {
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
            mockDbInsertValues.mockImplementation((vals: unknown) => {
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
            mockWithTransaction.mockImplementation(async () => {
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
            mockWithTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
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
