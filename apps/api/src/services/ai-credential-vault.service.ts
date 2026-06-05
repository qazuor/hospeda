/**
 * AI Credential Vault Service (SPEC-173 T-022).
 *
 * Manages AI provider API keys in the credential vault: create, rotate, delete,
 * and decrypt. Each mutation writes one encrypted row in `ai_provider_credentials`
 * and one append-only audit row in `ai_credential_audit`, both in a single
 * database transaction.
 *
 * ## Design decisions (owner-approved 2026-06-04)
 *
 * - Plain module in `apps/api/src/services/` — does NOT extend `BaseService`.
 *   No other `apps/api` service does; matches the style of `ai-cost-alert.service.ts`
 *   and `billing-usage.service.ts`.
 * - Returns `ServiceOutput<T>` from `@repo/service-core` for shape consistency
 *   with the rest of the API surface.
 * - Rotation = UPDATE IN-PLACE (overwrite ciphertext/iv/authTag on the same row,
 *   bump `updatedAt`) + audit `'rotated'`. The old ciphertext is overwritten and
 *   is not left decryptable.
 * - No permission check here — the route guard in T-026 enforces
 *   `AI_SETTINGS_MANAGE`; the service receives `actor` only for `actorId` in the
 *   audit row.
 * - ONE active credential per `providerId` (`deletedAt IS NULL`). `create` fails
 *   with `VALIDATION_ERROR` when an active credential already exists for that
 *   `providerId`; the caller must rotate instead.
 * - Never log plaintext keys or ciphertext at info/warn/error level (§5.5).
 *
 * @module services/ai-credential-vault
 */

import { aiCredentialAudit, aiProviderCredentials, getDb, withTransaction } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import type { AiCredentialMasked } from '@repo/schemas';
import type { Actor, ServiceOutput } from '@repo/service-core';
import { and, eq, isNull } from 'drizzle-orm';
import { encryptSecret } from '../utils/ai-vault.js';
import { decryptSecret } from '../utils/ai-vault.js';
import { apiLogger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Input for listing AI provider credentials (masked — no secrets).
 */
export interface ListAiProviderCredentialsInput {
    /** When `true`, soft-deleted rows are included in the result. Default `false`. */
    readonly includeDeleted?: boolean;
}

/**
 * Input for creating a new AI provider credential.
 */
export interface CreateAiProviderCredentialInput {
    /** Actor performing the action (used for audit `actorId`). */
    readonly actor: Actor;
    /** IP address of the request, for audit trail (null when unavailable). */
    readonly ipAddress: string | null;
    /** AI provider identifier (e.g. `openai`, `anthropic`, `stub`). */
    readonly providerId: string;
    /** Plaintext API key to encrypt and store. NEVER logged. */
    readonly plaintextKey: string;
    /** Optional human-readable label for the key. */
    readonly label?: string;
    /** Optional arbitrary metadata blob. */
    readonly metadata?: Record<string, unknown>;
}

/**
 * Input for rotating an existing AI provider credential.
 */
export interface RotateAiProviderCredentialInput {
    /** Actor performing the action. */
    readonly actor: Actor;
    /** IP address of the request. */
    readonly ipAddress: string | null;
    /** AI provider identifier whose active credential to rotate. */
    readonly providerId: string;
    /** New plaintext API key. NEVER logged. */
    readonly newPlaintextKey: string;
}

/**
 * Input for soft-deleting an AI provider credential.
 */
export interface DeleteAiProviderCredentialInput {
    /** Actor performing the action. */
    readonly actor: Actor;
    /** IP address of the request. */
    readonly ipAddress: string | null;
    /** AI provider identifier whose active credential to delete. */
    readonly providerId: string;
}

/**
 * Input for reading and decrypting an active AI provider credential.
 * No actor — read path has no audit; used by the engine wiring (T-019).
 */
export interface GetDecryptedAiProviderCredentialInput {
    /** AI provider identifier to look up. */
    readonly providerId: string;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * Returned by `createAiProviderCredential` and `rotateAiProviderCredential`.
 */
export interface CredentialMutationResult {
    readonly id: string;
    readonly providerId: string;
}

/**
 * Returned by `deleteAiProviderCredential`.
 */
export interface CredentialDeleteResult {
    readonly providerId: string;
}

/**
 * Returned by `getDecryptedAiProviderCredential`.
 */
export interface DecryptedCredentialResult {
    readonly providerId: string;
    /** Plaintext API key. MUST NOT be logged. */
    readonly plaintextKey: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds the standard error output shape.
 *
 * @param code - `ServiceErrorCode` for this error.
 * @param message - Human-readable error message.
 * @returns Failure `ServiceOutput<never>`.
 */
function errorOutput<T>(code: ServiceErrorCode, message: string): ServiceOutput<T> {
    return { error: { code, message } };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Lists AI provider credentials, returning only the masked (non-secret) subset.
 *
 * The fields `ciphertext`, `iv`, and `authTag` are NEVER included in the result.
 * Only metadata safe to surface in the admin UI is returned.
 *
 * @param input - `{ includeDeleted?: boolean }` — defaults to active rows only.
 * @returns `ServiceOutput` with `{ items, total }` on success.
 *
 * @example
 * ```ts
 * const result = await listAiProviderCredentials({ includeDeleted: false });
 * if (result.data) {
 *   console.log(result.data.total);
 * }
 * ```
 */
export async function listAiProviderCredentials(
    input: ListAiProviderCredentialsInput
): Promise<ServiceOutput<{ items: AiCredentialMasked[]; total: number }>> {
    const { includeDeleted = false } = input;

    try {
        const db = getDb();

        const condition = includeDeleted ? undefined : isNull(aiProviderCredentials.deletedAt);

        // Select only masked fields — NEVER ciphertext, iv, or authTag.
        const rows = condition
            ? await db
                  .select({
                      id: aiProviderCredentials.id,
                      providerId: aiProviderCredentials.providerId,
                      label: aiProviderCredentials.label,
                      metadata: aiProviderCredentials.metadata,
                      createdAt: aiProviderCredentials.createdAt,
                      updatedAt: aiProviderCredentials.updatedAt,
                      deletedAt: aiProviderCredentials.deletedAt
                  })
                  .from(aiProviderCredentials)
                  .where(condition)
            : await db
                  .select({
                      id: aiProviderCredentials.id,
                      providerId: aiProviderCredentials.providerId,
                      label: aiProviderCredentials.label,
                      metadata: aiProviderCredentials.metadata,
                      createdAt: aiProviderCredentials.createdAt,
                      updatedAt: aiProviderCredentials.updatedAt,
                      deletedAt: aiProviderCredentials.deletedAt
                  })
                  .from(aiProviderCredentials);

        // Serialize Date → ISO string to match AiCredentialMaskedSchema.
        const items: AiCredentialMasked[] = rows.map((row) => ({
            id: row.id,
            providerId: row.providerId,
            label: row.label ?? null,
            metadata: row.metadata ?? null,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null
        }));

        return { data: { items, total: items.length } };
    } catch (error) {
        apiLogger.error(
            { error: error instanceof Error ? error.message : String(error) },
            'ai-credential-vault: unexpected error in listAiProviderCredentials'
        );
        return errorOutput<{ items: AiCredentialMasked[]; total: number }>(
            ServiceErrorCode.INTERNAL_ERROR,
            'Unexpected error while listing credentials'
        );
    }
}

/**
 * Creates a new encrypted AI provider credential.
 *
 * Encrypts `plaintextKey` with AES-256-GCM and persists the ciphertext, IV, and
 * auth tag to `ai_provider_credentials`. An audit row (`action: 'created'`) is
 * inserted atomically in the same transaction.
 *
 * Fails with `VALIDATION_ERROR` when an active credential already exists for
 * `providerId` — call `rotateAiProviderCredential` instead.
 *
 * @param input - Create input including actor, providerId, and plaintextKey.
 * @returns `ServiceOutput` with `{ id, providerId }` on success.
 *
 * @example
 * ```ts
 * const result = await createAiProviderCredential({
 *   actor,
 *   ipAddress: '127.0.0.1',
 *   providerId: 'openai',
 *   plaintextKey: 'sk-...',
 *   label: 'Production OpenAI key',
 * });
 * if (result.data) {
 *   console.log(result.data.id);
 * }
 * ```
 */
export async function createAiProviderCredential(
    input: CreateAiProviderCredentialInput
): Promise<ServiceOutput<CredentialMutationResult>> {
    const { actor, ipAddress, providerId, plaintextKey, label, metadata } = input;

    try {
        const db = getDb();

        // 1. Check: no active credential for this providerId.
        const existing = await db
            .select({ id: aiProviderCredentials.id })
            .from(aiProviderCredentials)
            .where(
                and(
                    eq(aiProviderCredentials.providerId, providerId),
                    isNull(aiProviderCredentials.deletedAt)
                )
            )
            .limit(1);

        if (existing.length > 0) {
            return errorOutput<CredentialMutationResult>(
                ServiceErrorCode.VALIDATION_ERROR,
                `An active credential already exists for provider '${providerId}'. Use rotate instead.`
            );
        }

        // 2. Encrypt. Never log the plaintext or ciphertext at info level.
        const { ciphertext, iv, authTag } = encryptSecret({ plaintext: plaintextKey });

        // 3. Transactional insert: credential + audit.
        let createdId: string | undefined;

        await withTransaction(async (tx) => {
            const [inserted] = await tx
                .insert(aiProviderCredentials)
                .values({
                    providerId,
                    ciphertext,
                    iv,
                    authTag,
                    ...(label !== undefined ? { label } : {}),
                    ...(metadata !== undefined ? { metadata } : {})
                })
                .returning({ id: aiProviderCredentials.id });

            createdId = inserted?.id;

            await tx.insert(aiCredentialAudit).values({
                actorId: actor.id,
                action: 'created',
                providerId,
                ipAddress: ipAddress ?? null
            });
        });

        if (createdId === undefined) {
            return errorOutput<CredentialMutationResult>(
                ServiceErrorCode.INTERNAL_ERROR,
                'Credential insert did not return an ID'
            );
        }

        apiLogger.info(
            { providerId, credentialId: createdId, actorId: actor.id },
            'ai-credential-vault: credential created'
        );

        return { data: { id: createdId, providerId } };
    } catch (error) {
        // Race-safe duplicate guard: if two concurrent requests slip past the
        // SELECT check above simultaneously, the DB enforces uniqueness via the
        // partial unique index on (provider_id WHERE deleted_at IS NULL).
        // Postgres signals this as error code 23505 (unique_violation).
        // Map it to the same VALIDATION_ERROR the SELECT check returns so the
        // caller receives a consistent response regardless of the race outcome.
        const pgCode =
            error !== null &&
            typeof error === 'object' &&
            'code' in error &&
            typeof (error as { code: unknown }).code === 'string'
                ? (error as { code: string }).code
                : undefined;
        if (pgCode === '23505') {
            return errorOutput<CredentialMutationResult>(
                ServiceErrorCode.VALIDATION_ERROR,
                `An active credential already exists for provider '${providerId}'. Use rotate instead.`
            );
        }
        apiLogger.error(
            {
                providerId,
                actorId: actor.id,
                error: error instanceof Error ? error.message : String(error)
            },
            'ai-credential-vault: unexpected error in createAiProviderCredential'
        );
        return errorOutput<CredentialMutationResult>(
            ServiceErrorCode.INTERNAL_ERROR,
            'Unexpected error while creating credential'
        );
    }
}

/**
 * Rotates the active AI provider credential by overwriting its ciphertext in-place.
 *
 * Encrypts `newPlaintextKey`, overwrites `ciphertext`, `iv`, and `authTag` on the
 * existing row (and bumps `updatedAt`), then inserts an audit row
 * (`action: 'rotated'`) — all in one transaction. The previous ciphertext is
 * permanently overwritten and not recoverable.
 *
 * Fails with `NOT_FOUND` when no active credential exists for `providerId`.
 *
 * @param input - Rotate input including actor, providerId, and newPlaintextKey.
 * @returns `ServiceOutput` with `{ id, providerId }` on success.
 */
export async function rotateAiProviderCredential(
    input: RotateAiProviderCredentialInput
): Promise<ServiceOutput<CredentialMutationResult>> {
    const { actor, ipAddress, providerId, newPlaintextKey } = input;

    try {
        const db = getDb();

        // 1. Find the active credential.
        const active = await db
            .select({ id: aiProviderCredentials.id })
            .from(aiProviderCredentials)
            .where(
                and(
                    eq(aiProviderCredentials.providerId, providerId),
                    isNull(aiProviderCredentials.deletedAt)
                )
            )
            .limit(1);

        if (active.length === 0) {
            return errorOutput<CredentialMutationResult>(
                ServiceErrorCode.NOT_FOUND,
                `No active credential found for provider '${providerId}'`
            );
        }

        const credentialId = active[0]?.id;
        if (credentialId === undefined) {
            return errorOutput<CredentialMutationResult>(
                ServiceErrorCode.INTERNAL_ERROR,
                'Active credential row did not return an ID'
            );
        }

        // 2. Encrypt new key.
        const { ciphertext, iv, authTag } = encryptSecret({ plaintext: newPlaintextKey });

        // 3. Transactional update: overwrite ciphertext + audit.
        await withTransaction(async (tx) => {
            await tx
                .update(aiProviderCredentials)
                .set({
                    ciphertext,
                    iv,
                    authTag,
                    updatedAt: new Date()
                })
                .where(eq(aiProviderCredentials.id, credentialId));

            await tx.insert(aiCredentialAudit).values({
                actorId: actor.id,
                action: 'rotated',
                providerId,
                ipAddress: ipAddress ?? null
            });
        });

        apiLogger.info(
            { providerId, credentialId, actorId: actor.id },
            'ai-credential-vault: credential rotated'
        );

        return { data: { id: credentialId, providerId } };
    } catch (error) {
        apiLogger.error(
            {
                providerId,
                actorId: actor.id,
                error: error instanceof Error ? error.message : String(error)
            },
            'ai-credential-vault: unexpected error in rotateAiProviderCredential'
        );
        return errorOutput<CredentialMutationResult>(
            ServiceErrorCode.INTERNAL_ERROR,
            'Unexpected error while rotating credential'
        );
    }
}

/**
 * Soft-deletes the active AI provider credential for a provider.
 *
 * Sets `deletedAt` and `deletedById` on the credential row and inserts an audit
 * row (`action: 'deleted'`) in one transaction. The row remains in the database
 * but is no longer active.
 *
 * Fails with `NOT_FOUND` when no active credential exists for `providerId`.
 *
 * @param input - Delete input including actor, providerId, and ipAddress.
 * @returns `ServiceOutput` with `{ providerId }` on success.
 */
export async function deleteAiProviderCredential(
    input: DeleteAiProviderCredentialInput
): Promise<ServiceOutput<CredentialDeleteResult>> {
    const { actor, ipAddress, providerId } = input;

    try {
        const db = getDb();

        // 1. Find the active credential.
        const active = await db
            .select({ id: aiProviderCredentials.id })
            .from(aiProviderCredentials)
            .where(
                and(
                    eq(aiProviderCredentials.providerId, providerId),
                    isNull(aiProviderCredentials.deletedAt)
                )
            )
            .limit(1);

        if (active.length === 0) {
            return errorOutput<CredentialDeleteResult>(
                ServiceErrorCode.NOT_FOUND,
                `No active credential found for provider '${providerId}'`
            );
        }

        const credentialId = active[0]?.id;
        if (credentialId === undefined) {
            return errorOutput<CredentialDeleteResult>(
                ServiceErrorCode.INTERNAL_ERROR,
                'Active credential row did not return an ID'
            );
        }

        const now = new Date();

        // 2. Transactional soft-delete + audit.
        await withTransaction(async (tx) => {
            await tx
                .update(aiProviderCredentials)
                .set({
                    deletedAt: now,
                    deletedById: actor.id,
                    updatedAt: now
                })
                .where(eq(aiProviderCredentials.id, credentialId));

            await tx.insert(aiCredentialAudit).values({
                actorId: actor.id,
                action: 'deleted',
                providerId,
                ipAddress: ipAddress ?? null
            });
        });

        apiLogger.info(
            { providerId, credentialId, actorId: actor.id },
            'ai-credential-vault: credential deleted'
        );

        return { data: { providerId } };
    } catch (error) {
        apiLogger.error(
            {
                providerId,
                actorId: actor.id,
                error: error instanceof Error ? error.message : String(error)
            },
            'ai-credential-vault: unexpected error in deleteAiProviderCredential'
        );
        return errorOutput<CredentialDeleteResult>(
            ServiceErrorCode.INTERNAL_ERROR,
            'Unexpected error while deleting credential'
        );
    }
}

/**
 * Reads and decrypts the active AI provider credential for `providerId`.
 *
 * Read-only path — no audit row is written. Used by the AI engine wiring (T-019)
 * to supply the plaintext key at call time.
 *
 * **SECURITY**: The returned `plaintextKey` MUST NOT be logged anywhere in the
 * call stack. This function itself never logs the plaintext.
 *
 * Fails with `NOT_FOUND` when no active credential exists for `providerId`.
 *
 * @param input - Object containing the `providerId` to look up.
 * @returns `ServiceOutput` with `{ providerId, plaintextKey }` on success.
 *
 * @example
 * ```ts
 * const result = await getDecryptedAiProviderCredential({ providerId: 'openai' });
 * if (result.data) {
 *   // Use result.data.plaintextKey — NEVER log it.
 * }
 * ```
 */
export async function getDecryptedAiProviderCredential(
    input: GetDecryptedAiProviderCredentialInput
): Promise<ServiceOutput<DecryptedCredentialResult>> {
    const { providerId } = input;

    try {
        const db = getDb();

        const rows = await db
            .select({
                ciphertext: aiProviderCredentials.ciphertext,
                iv: aiProviderCredentials.iv,
                authTag: aiProviderCredentials.authTag
            })
            .from(aiProviderCredentials)
            .where(
                and(
                    eq(aiProviderCredentials.providerId, providerId),
                    isNull(aiProviderCredentials.deletedAt)
                )
            )
            .limit(1);

        if (rows.length === 0) {
            return errorOutput<DecryptedCredentialResult>(
                ServiceErrorCode.NOT_FOUND,
                `No active credential found for provider '${providerId}'`
            );
        }

        const row = rows[0];
        if (row === undefined) {
            return errorOutput<DecryptedCredentialResult>(
                ServiceErrorCode.NOT_FOUND,
                `No active credential found for provider '${providerId}'`
            );
        }

        const { plaintext } = decryptSecret({
            ciphertext: row.ciphertext,
            iv: row.iv,
            authTag: row.authTag
        });

        // Log only the providerId — NEVER log the plaintext key.
        apiLogger.debug({ providerId }, 'ai-credential-vault: credential decrypted for engine');

        return { data: { providerId, plaintextKey: plaintext } };
    } catch (error) {
        apiLogger.error(
            {
                providerId,
                error: error instanceof Error ? error.message : String(error)
            },
            'ai-credential-vault: unexpected error in getDecryptedAiProviderCredential'
        );
        return errorOutput<DecryptedCredentialResult>(
            ServiceErrorCode.INTERNAL_ERROR,
            'Unexpected error while decrypting credential'
        );
    }
}
