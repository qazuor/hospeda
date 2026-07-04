/**
 * MercadoLibre OAuth credential repository (HOS-45 T-005).
 *
 * Reads and writes the single active `external_oauth_credentials` row for
 * the `mercadolibre` provider. This is a plain module — it does NOT extend
 * `BaseService` or `BaseModel` — and queries the raw Drizzle table directly,
 * mirroring the established precedent in `ai-credential-vault.service.ts`
 * (see that file's header for the full rationale).
 *
 * ## Design decisions
 *
 * - Two secrets per row (access token + refresh token), each with its own
 *   ciphertext/iv/authTag triplet, encrypted/decrypted independently via
 *   `oauth-vault.ts`.
 * - ONE active row per provider (`deletedAt IS NULL`), enforced by the
 *   table's partial unique index. Unlike the AI vault, this table has no
 *   audit-trail companion and no rotation history — refreshing a token is
 *   always an in-place `UPDATE`, never an insert-then-soft-delete cycle
 *   (approved scope, see the table's schema doc comment).
 * - `upsertMLCredential` wraps the check-then-write in `withTransaction` to
 *   avoid the race between the existence check and the insert. Token
 *   refreshes can legitimately run concurrently (e.g. two overlapping cron
 *   ticks), so a second layer of protection exists: if a concurrent insert
 *   still slips past the check and hits the partial unique index, Postgres
 *   raises a `23505` unique-violation, which is caught here and retried as
 *   an `UPDATE` rather than left to bubble as an unhandled error.
 * - Never log plaintext access/refresh tokens or ciphertext at any log
 *   level. Logging here is minimal and limited to `provider` + outcome.
 *
 * @module services/mercadolibre-oauth/ml-credential.repository
 */

import { externalOauthCredentials, getDb, withTransaction } from '@repo/db';
import { and, eq, isNull } from 'drizzle-orm';
import { apiLogger } from '../../utils/logger.js';
import { decryptSecret, encryptSecret } from '../../utils/oauth-vault.js';

/** The `provider` column value used for all MercadoLibre OAuth credential rows. */
const ML_PROVIDER = 'mercadolibre';

/** Postgres error code for a unique-constraint violation. */
const PG_UNIQUE_VIOLATION_CODE = '23505';

/**
 * Decrypted MercadoLibre OAuth credential pair, as returned by
 * {@link getActiveMLCredential}.
 */
export interface MLCredential {
    /** Decrypted OAuth access token. MUST NOT be logged. */
    readonly accessToken: string;
    /** Decrypted OAuth refresh token. MUST NOT be logged. */
    readonly refreshToken: string;
    /** Access token expiry timestamp, as reported by MercadoLibre. */
    readonly expiresAt: Date;
}

/**
 * Input for {@link upsertMLCredential}.
 */
export interface UpsertMLCredentialInput {
    /** Plaintext OAuth access token to encrypt and persist. MUST NOT be logged. */
    readonly accessToken: string;
    /** Plaintext OAuth refresh token to encrypt and persist. MUST NOT be logged. */
    readonly refreshToken: string;
    /** Access token expiry timestamp, as reported by MercadoLibre. */
    readonly expiresAt: Date;
}

/**
 * The six encrypted columns shared by the insert and update paths in
 * {@link upsertMLCredential}, keyed to the `external_oauth_credentials`
 * schema.
 */
interface EncryptedCredentialColumns {
    readonly accessTokenCiphertext: string;
    readonly accessTokenIv: string;
    readonly accessTokenAuthTag: string;
    readonly refreshTokenCiphertext: string;
    readonly refreshTokenIv: string;
    readonly refreshTokenAuthTag: string;
    readonly expiresAt: Date;
}

/**
 * The `and(eq(provider, ...), isNull(deletedAt))` condition used by every
 * query in this module to select the single active row for a provider.
 *
 * @returns The Drizzle `where` condition for the active MercadoLibre row.
 */
function activeMLCredentialCondition() {
    return and(
        eq(externalOauthCredentials.provider, ML_PROVIDER),
        isNull(externalOauthCredentials.deletedAt)
    );
}

/**
 * Encrypts the access and refresh tokens from an {@link UpsertMLCredentialInput}
 * into the six ciphertext/iv/authTag columns persisted on the table.
 *
 * @param input - The plaintext access/refresh tokens and expiry.
 * @returns The encrypted column values ready to insert or update.
 */
function encryptCredentialColumns(input: UpsertMLCredentialInput): EncryptedCredentialColumns {
    const { accessToken, refreshToken, expiresAt } = input;

    const accessTokenEncrypted = encryptSecret({ plaintext: accessToken });
    const refreshTokenEncrypted = encryptSecret({ plaintext: refreshToken });

    return {
        accessTokenCiphertext: accessTokenEncrypted.ciphertext,
        accessTokenIv: accessTokenEncrypted.iv,
        accessTokenAuthTag: accessTokenEncrypted.authTag,
        refreshTokenCiphertext: refreshTokenEncrypted.ciphertext,
        refreshTokenIv: refreshTokenEncrypted.iv,
        refreshTokenAuthTag: refreshTokenEncrypted.authTag,
        expiresAt
    };
}

/**
 * Type-guards an unknown thrown value as a Postgres unique-violation error
 * (error code `23505`).
 *
 * @param error - The unknown error caught from a Drizzle/pg call.
 * @returns `true` when `error.code === '23505'`.
 */
function isUniqueViolation(error: unknown): boolean {
    return (
        error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: unknown }).code === PG_UNIQUE_VIOLATION_CODE
    );
}

/**
 * Reads and decrypts the active MercadoLibre OAuth credential row.
 *
 * **SECURITY**: The returned `accessToken`/`refreshToken` MUST NOT be logged
 * anywhere in the call stack. This function itself never logs them.
 *
 * @returns The decrypted `{ accessToken, refreshToken, expiresAt }`, or
 * `null` when no active MercadoLibre credential row exists.
 *
 * @example
 * ```ts
 * const credential = await getActiveMLCredential();
 * if (credential) {
 *   // Use credential.accessToken — NEVER log it.
 * }
 * ```
 */
export async function getActiveMLCredential(): Promise<MLCredential | null> {
    const db = getDb();

    const rows = await db
        .select({
            accessTokenCiphertext: externalOauthCredentials.accessTokenCiphertext,
            accessTokenIv: externalOauthCredentials.accessTokenIv,
            accessTokenAuthTag: externalOauthCredentials.accessTokenAuthTag,
            refreshTokenCiphertext: externalOauthCredentials.refreshTokenCiphertext,
            refreshTokenIv: externalOauthCredentials.refreshTokenIv,
            refreshTokenAuthTag: externalOauthCredentials.refreshTokenAuthTag,
            expiresAt: externalOauthCredentials.expiresAt
        })
        .from(externalOauthCredentials)
        .where(activeMLCredentialCondition())
        .limit(1);

    const row = rows[0];
    if (row === undefined) {
        apiLogger.debug(
            { provider: ML_PROVIDER, outcome: 'not-found' },
            'ml-credential-repository: no active credential found'
        );
        return null;
    }

    const { plaintext: accessToken } = decryptSecret({
        ciphertext: row.accessTokenCiphertext,
        iv: row.accessTokenIv,
        authTag: row.accessTokenAuthTag
    });

    const { plaintext: refreshToken } = decryptSecret({
        ciphertext: row.refreshTokenCiphertext,
        iv: row.refreshTokenIv,
        authTag: row.refreshTokenAuthTag
    });

    apiLogger.debug(
        { provider: ML_PROVIDER, outcome: 'decrypted' },
        'ml-credential-repository: credential decrypted'
    );

    return { accessToken, refreshToken, expiresAt: row.expiresAt };
}

/**
 * Applies the fallback `UPDATE` after a concurrent-insert race is detected
 * in {@link upsertMLCredential}. Re-reads the (now-existing) active row and
 * overwrites its encrypted columns in place.
 *
 * @param encryptedColumns - The already-encrypted columns to persist.
 * @throws The original race error if no active row can be found on re-check
 * (would indicate the racing row was deleted between the unique-violation
 * and this re-check — extremely unlikely, but never silently swallowed).
 */
async function updateAfterConcurrentInsertRace(
    encryptedColumns: EncryptedCredentialColumns,
    originalError: unknown
): Promise<void> {
    apiLogger.info(
        { provider: ML_PROVIDER, outcome: 'race-fallback-update' },
        'ml-credential-repository: concurrent insert detected, falling back to update'
    );

    const db = getDb();
    const existing = await db
        .select({ id: externalOauthCredentials.id })
        .from(externalOauthCredentials)
        .where(activeMLCredentialCondition())
        .limit(1);

    const existingId = existing[0]?.id;
    if (existingId === undefined) {
        throw originalError;
    }

    await db
        .update(externalOauthCredentials)
        .set({ ...encryptedColumns, updatedAt: new Date() })
        .where(eq(externalOauthCredentials.id, existingId));

    apiLogger.info(
        { provider: ML_PROVIDER, outcome: 'updated' },
        'ml-credential-repository: credential updated after race fallback'
    );
}

/**
 * Creates or updates the single active MercadoLibre OAuth credential row.
 *
 * Encrypts both tokens, then checks whether an active row already exists:
 * - No active row → `INSERT` a new one.
 * - An active row exists → `UPDATE` its encrypted columns + `expiresAt` +
 *   `updatedAt` in place. There is no rotation history for this table.
 *
 * The check-then-write is wrapped in `withTransaction`. If a concurrent
 * caller's insert still races past the check (two near-simultaneous token
 * refreshes), the partial unique index on `provider WHERE deleted_at IS
 * NULL` raises a Postgres `23505` unique-violation; this is caught and
 * retried as an `UPDATE` instead of bubbling as an unhandled error.
 *
 * @param input - The plaintext access/refresh tokens and expiry to persist.
 *
 * @example
 * ```ts
 * await upsertMLCredential({
 *   accessToken: tokens.accessToken,
 *   refreshToken: tokens.refreshToken,
 *   expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
 * });
 * ```
 */
export async function upsertMLCredential(input: UpsertMLCredentialInput): Promise<void> {
    const encryptedColumns = encryptCredentialColumns(input);

    try {
        await withTransaction(async (tx) => {
            const existing = await tx
                .select({ id: externalOauthCredentials.id })
                .from(externalOauthCredentials)
                .where(activeMLCredentialCondition())
                .limit(1);

            const existingId = existing[0]?.id;

            if (existingId === undefined) {
                await tx.insert(externalOauthCredentials).values({
                    provider: ML_PROVIDER,
                    ...encryptedColumns
                });

                apiLogger.info(
                    { provider: ML_PROVIDER, outcome: 'created' },
                    'ml-credential-repository: credential created'
                );
                return;
            }

            await tx
                .update(externalOauthCredentials)
                .set({ ...encryptedColumns, updatedAt: new Date() })
                .where(eq(externalOauthCredentials.id, existingId));

            apiLogger.info(
                { provider: ML_PROVIDER, outcome: 'updated' },
                'ml-credential-repository: credential updated'
            );
        });
    } catch (error) {
        if (!isUniqueViolation(error)) {
            throw error;
        }

        await updateAfterConcurrentInsertRace(encryptedColumns, error);
    }
}
