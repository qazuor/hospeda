/**
 * Integration tests for the MercadoLibre OAuth token service (HOS-45 T-017).
 *
 * Unlike `ml-token.service.test.ts` (which mocks the credential repository
 * and the oauth client directly), this suite exercises `getValidMercadoLibreToken`
 * against the REAL `ml-credential.repository.ts` and the REAL `oauth-vault.ts`
 * AES-256-GCM encryption. Only the actual external network boundary —
 * `ml-oauth-client.ts`'s `refreshAccessToken` — is mocked.
 *
 * The Postgres layer (`getDb`/`withTransaction`/`externalOauthCredentials`
 * from `@repo/db`) is replaced with an in-memory fake row store, mirroring
 * the mock shape used by `ml-credential.repository.test.ts` (select/insert/
 * update chain), but here the fake ACTUALLY persists what is written so that
 * a subsequent read reflects it — proving the real encrypt → persist →
 * decrypt round trip works end to end, not just that a mock was called.
 *
 * ## Coverage
 *
 * 1. Refresh persists the rotated pair and a subsequent `getActiveMLCredential()`
 *    re-read returns the NEW values (real encryption round trip).
 * 2. Concurrency — two overlapping near-expiry calls share a single in-flight
 *    refresh even when going through the real repository/vault layer.
 * 3. Terminal failure isolation — a classified-terminal refresh failure never
 *    calls the persistence path; the previously-stored row is byte-for-byte
 *    unchanged afterward.
 *
 * @module test/services/mercadolibre-oauth/ml-token.service.integration
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory fake row store + hoisted mock state
// ---------------------------------------------------------------------------

/**
 * Shape of the single fake `external_oauth_credentials` row this suite
 * seeds/persists. Mirrors the encrypted columns `ml-credential.repository.ts`
 * reads/writes plus the bookkeeping columns it never touches directly.
 */
interface FakeCredentialRow {
    readonly id: string;
    readonly provider: string;
    readonly accessTokenCiphertext: string;
    readonly accessTokenIv: string;
    readonly accessTokenAuthTag: string;
    readonly refreshTokenCiphertext: string;
    readonly refreshTokenIv: string;
    readonly refreshTokenAuthTag: string;
    readonly expiresAt: Date;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly deletedAt: Date | null;
}

const { mockGetDb, mockWithTransaction, mockRefreshAccessToken, resetStore, getStoreRow } =
    vi.hoisted(() => {
        // Holds zero-or-one row — the entire fake table content for this suite.
        const store: { row: FakeCredentialRow | null } = { row: null };

        function selectChain() {
            return {
                from: () => ({
                    where: () => ({
                        limit: async (_n: number) => {
                            if (store.row === null || store.row.deletedAt !== null) {
                                return [];
                            }
                            return [{ ...store.row }];
                        }
                    })
                })
            };
        }

        function insertChain() {
            return {
                values: async (vals: Record<string, unknown>) => {
                    store.row = {
                        id: `fake-ml-cred-${Math.random().toString(36).slice(2)}`,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        deletedAt: null,
                        ...vals
                    } as FakeCredentialRow;
                    return undefined;
                }
            };
        }

        function updateChain() {
            return {
                set: (patch: Record<string, unknown>) => ({
                    where: async (_cond: unknown) => {
                        if (store.row !== null) {
                            store.row = { ...store.row, ...patch } as FakeCredentialRow;
                        }
                        return undefined;
                    }
                })
            };
        }

        function fakeDbHandle() {
            return {
                select: selectChain,
                insert: insertChain,
                update: updateChain
            };
        }

        const mockGetDb = vi.fn(() => fakeDbHandle());
        const mockWithTransaction = vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
            await cb(fakeDbHandle());
        });
        const mockRefreshAccessToken = vi.fn();

        function resetStore(row: FakeCredentialRow | null): void {
            store.row = row;
        }

        function getStoreRow(): FakeCredentialRow | null {
            return store.row;
        }

        return { mockGetDb, mockWithTransaction, mockRefreshAccessToken, resetStore, getStoreRow };
    });

// ---------------------------------------------------------------------------
// Mocks — ONLY the Postgres layer, drizzle helpers, env, logger, and the
// outbound ML HTTP call are mocked. `ml-credential.repository.ts` and
// `oauth-vault.ts` run for real.
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

vi.mock('../../../src/services/mercadolibre-oauth/ml-oauth-client.js', () => ({
    refreshAccessToken: mockRefreshAccessToken
}));

// The OAuth vault requires a real master key to run its real AES-256-GCM
// encrypt/decrypt — mocked here only to inject a throwaway test key, the
// same pattern `oauth-vault.test.ts` uses.
const mockEnv = vi.hoisted(() => ({
    env: {
        HOSPEDA_OAUTH_VAULT_MASTER_KEY: 'integration-test-vault-master-key-32-chars-x' as
            | string
            | undefined
    }
}));
vi.mock('../../../src/utils/env.js', () => mockEnv);

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        error: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Import SUT + real collaborators (after mocks)
// ---------------------------------------------------------------------------

import { getActiveMLCredential } from '../../../src/services/mercadolibre-oauth/ml-credential.repository.js';
import { getValidMercadoLibreToken } from '../../../src/services/mercadolibre-oauth/ml-token.service.js';
import { encryptSecret } from '../../../src/utils/oauth-vault.js';

// ---------------------------------------------------------------------------
// Test fixtures/helpers
// ---------------------------------------------------------------------------

/**
 * Encrypts a plaintext access/refresh token pair (via the REAL `encryptSecret`)
 * and builds a full {@link FakeCredentialRow} ready to seed the fake store,
 * matching exactly the column shape `ml-credential.repository.ts` expects.
 */
function seedRow(input: {
    readonly accessToken: string;
    readonly refreshToken: string;
    readonly expiresAt: Date;
    readonly id?: string;
}): FakeCredentialRow {
    const access = encryptSecret({ plaintext: input.accessToken });
    const refresh = encryptSecret({ plaintext: input.refreshToken });
    const now = new Date();

    return {
        id: input.id ?? 'seed-row-id',
        provider: 'mercadolibre',
        accessTokenCiphertext: access.ciphertext,
        accessTokenIv: access.iv,
        accessTokenAuthTag: access.authTag,
        refreshTokenCiphertext: refresh.ciphertext,
        refreshTokenIv: refresh.iv,
        refreshTokenAuthTag: refresh.authTag,
        expiresAt: input.expiresAt,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
    };
}

const NEAR_EXPIRY_MS = 60 * 1000; // 1 minute left — within the 5-minute refresh margin

describe('ml-token.service (integration — real repository + real vault)', () => {
    beforeEach(() => {
        mockRefreshAccessToken.mockReset();
        resetStore(null);
        mockEnv.env.HOSPEDA_OAUTH_VAULT_MASTER_KEY = 'integration-test-vault-master-key-32-chars-x';
    });

    describe('refresh persistence + re-read round trip', () => {
        it('should return the new access token and persist the rotated pair so a re-read reflects it', async () => {
            // Arrange
            resetStore(
                seedRow({
                    accessToken: 'old-access-token',
                    refreshToken: 'old-refresh-token',
                    expiresAt: new Date(Date.now() + NEAR_EXPIRY_MS)
                })
            );

            mockRefreshAccessToken.mockResolvedValue({
                accessToken: 'rotated-access-token',
                refreshToken: 'rotated-refresh-token',
                expiresIn: 21600,
                tokenType: 'bearer'
            });

            // Act
            const token = await getValidMercadoLibreToken();

            // Assert — returned token matches the mocked refresh result
            expect(token).toBe('rotated-access-token');
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
            expect(mockRefreshAccessToken).toHaveBeenCalledWith({
                refreshToken: 'old-refresh-token'
            });

            // Assert — re-reading through the REAL repository + vault proves
            // the persist-then-reread round trip actually works, not just
            // that upsertMLCredential was invoked.
            const reread = await getActiveMLCredential();
            expect(reread).not.toBeNull();
            expect(reread?.accessToken).toBe('rotated-access-token');
            expect(reread?.refreshToken).toBe('rotated-refresh-token');

            // The stored ciphertext must differ from the old ciphertext —
            // proving an actual re-encryption happened, not a stale row.
            const storedRow = getStoreRow();
            expect(storedRow?.accessTokenCiphertext).not.toBe(
                seedRow({
                    accessToken: 'old-access-token',
                    refreshToken: 'old-refresh-token',
                    expiresAt: new Date(Date.now() + NEAR_EXPIRY_MS)
                }).accessTokenCiphertext
            );
        });
    });

    describe('concurrency (single-flight through the real repository/vault layer)', () => {
        it('should call refreshAccessToken exactly once for two concurrent near-expiry calls', async () => {
            // Arrange
            resetStore(
                seedRow({
                    accessToken: 'concurrent-old-access',
                    refreshToken: 'concurrent-old-refresh',
                    expiresAt: new Date(Date.now() + NEAR_EXPIRY_MS)
                })
            );

            let releaseRefresh: (() => void) | undefined;
            const gate = new Promise<void>((resolve) => {
                releaseRefresh = resolve;
            });
            mockRefreshAccessToken.mockImplementation(async function () {
                await gate;
                return {
                    accessToken: 'concurrent-new-access',
                    refreshToken: 'concurrent-new-refresh',
                    expiresIn: 21600,
                    tokenType: 'bearer'
                };
            });

            // Act — fire two concurrent calls before the mocked refresh settles
            const call1 = getValidMercadoLibreToken();
            const call2 = getValidMercadoLibreToken();

            await vi.waitFor(() => {
                expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
            });
            releaseRefresh?.();

            const [token1, token2] = await Promise.all([call1, call2]);

            // Assert — both callers received the SAME rotated token, and the
            // single-flight guard held even through the real repo/vault layer.
            expect(token1).toBe('concurrent-new-access');
            expect(token2).toBe('concurrent-new-access');
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
        });
    });

    describe('terminal failure isolation', () => {
        it('should reject with a terminal MLTokenRefreshError and leave the persisted row unchanged', async () => {
            // Arrange
            const originalRow = seedRow({
                accessToken: 'pre-failure-access',
                refreshToken: 'pre-failure-refresh',
                expiresAt: new Date(Date.now() + NEAR_EXPIRY_MS)
            });
            resetStore(originalRow);

            const terminalError = Object.assign(
                new Error('MercadoLibre OAuth token request failed with status 400'),
                {
                    status: 400,
                    body: { error: 'invalid_grant' }
                }
            );
            mockRefreshAccessToken.mockRejectedValue(terminalError);

            // Act & Assert
            await expect(getValidMercadoLibreToken()).rejects.toMatchObject({
                name: 'MLTokenRefreshError',
                kind: 'terminal'
            });

            // Assert — the previously-persisted row is byte-for-byte
            // unchanged: no partial/corrupt overwrite happened on failure.
            expect(getStoreRow()).toEqual(originalRow);

            // And a re-read still decrypts to the ORIGINAL (pre-failure) pair.
            const reread = await getActiveMLCredential();
            expect(reread?.accessToken).toBe('pre-failure-access');
            expect(reread?.refreshToken).toBe('pre-failure-refresh');
        });
    });
});
