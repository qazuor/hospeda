/**
 * Social Credential Vault Service (HOS-64 / SPEC-297a G-4, T-017).
 *
 * Manages the 4 social automation secrets (`make_webhook_url`,
 * `make_api_key`, `ai_social_key`, `operator_pin`) in the credential vault:
 * create, rotate, update, delete, and decrypt. Each mutation writes one
 * encrypted row in `social_credentials` and one append-only audit row in
 * `social_credential_audit`, both in a single database transaction.
 *
 * Mirrors `ai-credential-vault.service.ts` (SPEC-173 T-022) file-for-file,
 * replacing `providerId` with `key`, with two deliberate differences:
 *
 * - Mutations take a plain `actorId` string instead of a full `Actor`
 *   object — the vault route layer (T-026/T-027) is the only caller and
 *   already has the actor resolved; passing just the ID keeps this module
 *   decoupled from `@repo/service-core`'s `Actor` type.
 * - Create/rotate input is Zod-validated (`key` restricted to the 4 known
 *   values, `plaintext` non-empty) since, unlike the AI vault's open-ended
 *   `providerId`, the social vault has a fixed, closed set of keys.
 *
 * ## Design decisions (carried over from SPEC-173, T-001 for the permission gate)
 *
 * - Plain module in `apps/api/src/services/` — does NOT extend `BaseService`.
 * - Returns `ServiceOutput<T>` from `@repo/service-core` for shape consistency
 *   with the rest of the API surface.
 * - Rotation = UPDATE IN-PLACE (overwrite ciphertext/iv/authTag on the same row,
 *   bump `updatedAt`) + audit `'rotated'`. The old ciphertext is overwritten and
 *   is not left decryptable.
 * - No permission check here — the route guard in T-026/T-027 enforces
 *   `SOCIAL_SETTINGS_MANAGE`; the service receives `actorId` only for the
 *   audit row.
 * - ONE active credential per `key` (`deletedAt IS NULL`). `create` fails
 *   with `VALIDATION_ERROR` when an active credential already exists for that
 *   `key`; the caller must rotate instead.
 * - Never log plaintext secrets or ciphertext at info/warn/error level.
 *
 * @module services/social-credential-vault
 */

import { getDb, socialCredentialAudit, socialCredentials, withTransaction } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import type { ServiceOutput } from '@repo/service-core';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { apiLogger } from '../utils/logger.js';
import { decryptSecret, encryptSecret } from '../utils/social-vault.js';

// ---------------------------------------------------------------------------
// Credential keys
// ---------------------------------------------------------------------------

/**
 * The fixed, closed set of secrets the social vault stores. Matches the
 * `key` column comment on `social_credentials`/`social_credential_audit`.
 */
export const SOCIAL_CREDENTIAL_KEYS = [
    'make_webhook_url',
    'make_api_key',
    'ai_social_key',
    'operator_pin'
] as const;

/** One of the 4 social credential keys. */
export type SocialCredentialKey = (typeof SOCIAL_CREDENTIAL_KEYS)[number];

// ---------------------------------------------------------------------------
// Input schemas / types
// ---------------------------------------------------------------------------

/**
 * Zod schema for {@link createSocialCredential} input. `key` is restricted to
 * the 4 known values; `plaintext` must be non-empty.
 */
const CreateSocialCredentialInputSchema = z.object({
    key: z.enum(SOCIAL_CREDENTIAL_KEYS),
    plaintext: z.string().min(1, 'plaintext must not be empty'),
    label: z.string().max(255).optional(),
    actorId: z.string().uuid(),
    ipAddress: z.string().nullable()
});

/** Input for creating a new social credential. */
export type CreateSocialCredentialInput = z.infer<typeof CreateSocialCredentialInputSchema>;

/**
 * Zod schema for {@link rotateSocialCredential} input. `key` is restricted to
 * the 4 known values; `newPlaintext` must be non-empty.
 */
const RotateSocialCredentialInputSchema = z.object({
    key: z.enum(SOCIAL_CREDENTIAL_KEYS),
    newPlaintext: z.string().min(1, 'newPlaintext must not be empty'),
    actorId: z.string().uuid(),
    ipAddress: z.string().nullable()
});

/** Input for rotating an existing social credential. */
export type RotateSocialCredentialInput = z.infer<typeof RotateSocialCredentialInputSchema>;

/**
 * Zod schema for {@link updateSocialCredentialMetadata} input. `key` is
 * restricted to the 4 known values; `label` is the only mutable metadata
 * field on `social_credentials`.
 */
const UpdateSocialCredentialMetadataInputSchema = z.object({
    key: z.enum(SOCIAL_CREDENTIAL_KEYS),
    label: z.string().max(255).optional(),
    actorId: z.string().uuid(),
    ipAddress: z.string().nullable()
});

/** Input for updating an existing social credential's metadata. */
export type UpdateSocialCredentialMetadataInput = z.infer<
    typeof UpdateSocialCredentialMetadataInputSchema
>;

/**
 * Zod schema for {@link deleteSocialCredential} input. `key` is restricted
 * to the 4 known values.
 */
const DeleteSocialCredentialInputSchema = z.object({
    key: z.enum(SOCIAL_CREDENTIAL_KEYS),
    actorId: z.string().uuid(),
    ipAddress: z.string().nullable()
});

/** Input for soft-deleting a social credential. */
export type DeleteSocialCredentialInput = z.infer<typeof DeleteSocialCredentialInputSchema>;

/** Input for listing social credentials (masked — no secrets). */
export interface ListSocialCredentialsInput {
    /** When `true`, soft-deleted rows are included in the result. Default `false`. */
    readonly includeDeleted?: boolean;
}

/** Input for reading and decrypting an active social credential. No actor —
 * read path has no audit; used by internal server-side callers only (T-021-T-024). */
export interface GetDecryptedSocialCredentialInput {
    /** Social credential key to look up. */
    readonly key: SocialCredentialKey;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/** Returned by `createSocialCredential`, `rotateSocialCredential`, and `updateSocialCredentialMetadata`. */
export interface SocialCredentialMutationResult {
    readonly id: string;
    readonly key: SocialCredentialKey;
}

/** Returned by `deleteSocialCredential`. */
export interface SocialCredentialDeleteResult {
    readonly key: SocialCredentialKey;
}

/**
 * Masked social credential shape returned by `listSocialCredentials`.
 * `ciphertext`, `iv`, and `authTag` are NEVER included.
 */
export interface SocialCredentialMasked {
    readonly id: string;
    readonly key: SocialCredentialKey;
    readonly label: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly deletedAt: string | null;
}

/** Returned by `getDecryptedSocialCredential`. */
export interface DecryptedSocialCredentialResult {
    readonly key: SocialCredentialKey;
    /** Plaintext secret. MUST NOT be logged. */
    readonly plaintext: string;
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

/**
 * Extracts a Postgres error code (e.g. `23505`) from an unknown thrown value,
 * duck-typed to avoid a hard dependency on the `pg` error class.
 *
 * @param error - The caught value.
 * @returns The Postgres error code, or `undefined` if not present.
 */
function getPgErrorCode(error: unknown): string | undefined {
    return error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        typeof (error as { code: unknown }).code === 'string'
        ? (error as { code: string }).code
        : undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a new encrypted social credential.
 *
 * Encrypts `plaintext` with AES-256-GCM and persists the ciphertext, IV, and
 * auth tag to `social_credentials`. An audit row (`action: 'created'`) is
 * inserted atomically in the same transaction.
 *
 * Fails with `VALIDATION_ERROR` when input fails Zod validation, or when an
 * active credential already exists for `key` — call `rotateSocialCredential`
 * instead.
 *
 * @param input - Create input including key, plaintext, actorId, and ipAddress.
 * @returns `ServiceOutput` with `{ id, key }` on success.
 *
 * @example
 * ```ts
 * const result = await createSocialCredential({
 *   key: 'make_webhook_url',
 *   plaintext: 'https://hook.make.com/...',
 *   actorId: actor.id,
 *   ipAddress: '127.0.0.1',
 * });
 * if (result.data) {
 *   console.log(result.data.id);
 * }
 * ```
 */
export async function createSocialCredential(
    input: CreateSocialCredentialInput
): Promise<ServiceOutput<SocialCredentialMutationResult>> {
    const parsed = CreateSocialCredentialInputSchema.safeParse(input);
    if (!parsed.success) {
        return errorOutput<SocialCredentialMutationResult>(
            ServiceErrorCode.VALIDATION_ERROR,
            parsed.error.issues.map((issue) => issue.message).join('; ')
        );
    }

    const { key, plaintext, label, actorId, ipAddress } = parsed.data;

    try {
        const db = getDb();

        // 1. Check: no active credential for this key.
        const existing = await db
            .select({ id: socialCredentials.id })
            .from(socialCredentials)
            .where(and(eq(socialCredentials.key, key), isNull(socialCredentials.deletedAt)))
            .limit(1);

        if (existing.length > 0) {
            return errorOutput<SocialCredentialMutationResult>(
                ServiceErrorCode.VALIDATION_ERROR,
                `An active credential already exists for key '${key}'. Use rotate instead.`
            );
        }

        // 2. Encrypt. Never log the plaintext or ciphertext at info level.
        const { ciphertext, iv, authTag } = encryptSecret({ plaintext });

        // 3. Transactional insert: credential + audit.
        let createdId: string | undefined;

        await withTransaction(async (tx) => {
            const [inserted] = await tx
                .insert(socialCredentials)
                .values({
                    key,
                    ciphertext,
                    iv,
                    authTag,
                    ...(label !== undefined ? { label } : {})
                })
                .returning({ id: socialCredentials.id });

            createdId = inserted?.id;

            await tx.insert(socialCredentialAudit).values({
                actorId,
                action: 'created',
                key,
                ipAddress: ipAddress ?? null
            });
        });

        if (createdId === undefined) {
            return errorOutput<SocialCredentialMutationResult>(
                ServiceErrorCode.INTERNAL_ERROR,
                'Credential insert did not return an ID'
            );
        }

        apiLogger.info(
            { key, credentialId: createdId, actorId },
            'social-credential-vault: credential created'
        );

        return { data: { id: createdId, key } };
    } catch (error) {
        // Race-safe duplicate guard: if two concurrent requests slip past the
        // SELECT check above simultaneously, the DB enforces uniqueness via the
        // partial unique index on (key WHERE deleted_at IS NULL). Postgres
        // signals this as error code 23505 (unique_violation). Map it to the
        // same VALIDATION_ERROR the SELECT check returns so the caller
        // receives a consistent response regardless of the race outcome.
        if (getPgErrorCode(error) === '23505') {
            return errorOutput<SocialCredentialMutationResult>(
                ServiceErrorCode.VALIDATION_ERROR,
                `An active credential already exists for key '${key}'. Use rotate instead.`
            );
        }
        apiLogger.error(
            {
                key,
                actorId,
                error: error instanceof Error ? error.message : String(error)
            },
            'social-credential-vault: unexpected error in createSocialCredential'
        );
        return errorOutput<SocialCredentialMutationResult>(
            ServiceErrorCode.INTERNAL_ERROR,
            'Unexpected error while creating credential'
        );
    }
}

/**
 * Rotates the active social credential by overwriting its ciphertext in-place.
 *
 * Encrypts `newPlaintext`, overwrites `ciphertext`, `iv`, and `authTag` on the
 * existing row (and bumps `updatedAt`), then inserts an audit row
 * (`action: 'rotated'`) — all in one transaction. The previous ciphertext is
 * permanently overwritten and not recoverable.
 *
 * Fails with `VALIDATION_ERROR` when input fails Zod validation, or with
 * `NOT_FOUND` when no active credential exists for `key`.
 *
 * @param input - Rotate input including key, newPlaintext, actorId, and ipAddress.
 * @returns `ServiceOutput` with `{ id, key }` on success.
 */
export async function rotateSocialCredential(
    input: RotateSocialCredentialInput
): Promise<ServiceOutput<SocialCredentialMutationResult>> {
    const parsed = RotateSocialCredentialInputSchema.safeParse(input);
    if (!parsed.success) {
        return errorOutput<SocialCredentialMutationResult>(
            ServiceErrorCode.VALIDATION_ERROR,
            parsed.error.issues.map((issue) => issue.message).join('; ')
        );
    }

    const { key, newPlaintext, actorId, ipAddress } = parsed.data;

    try {
        const db = getDb();

        // 1. Find the active credential.
        const active = await db
            .select({ id: socialCredentials.id })
            .from(socialCredentials)
            .where(and(eq(socialCredentials.key, key), isNull(socialCredentials.deletedAt)))
            .limit(1);

        if (active.length === 0) {
            return errorOutput<SocialCredentialMutationResult>(
                ServiceErrorCode.NOT_FOUND,
                `No active credential found for key '${key}'`
            );
        }

        const credentialId = active[0]?.id;
        if (credentialId === undefined) {
            return errorOutput<SocialCredentialMutationResult>(
                ServiceErrorCode.INTERNAL_ERROR,
                'Active credential row did not return an ID'
            );
        }

        // 2. Encrypt new secret.
        const { ciphertext, iv, authTag } = encryptSecret({ plaintext: newPlaintext });

        // 3. Transactional update: overwrite ciphertext + audit.
        await withTransaction(async (tx) => {
            await tx
                .update(socialCredentials)
                .set({
                    ciphertext,
                    iv,
                    authTag,
                    updatedAt: new Date()
                })
                .where(eq(socialCredentials.id, credentialId));

            await tx.insert(socialCredentialAudit).values({
                actorId,
                action: 'rotated',
                key,
                ipAddress: ipAddress ?? null
            });
        });

        apiLogger.info(
            { key, credentialId, actorId },
            'social-credential-vault: credential rotated'
        );

        return { data: { id: credentialId, key } };
    } catch (error) {
        apiLogger.error(
            {
                key,
                actorId,
                error: error instanceof Error ? error.message : String(error)
            },
            'social-credential-vault: unexpected error in rotateSocialCredential'
        );
        return errorOutput<SocialCredentialMutationResult>(
            ServiceErrorCode.INTERNAL_ERROR,
            'Unexpected error while rotating credential'
        );
    }
}

/**
 * Updates the `label` metadata for an active social credential.
 *
 * Does NOT touch ciphertext, IV, or authTag — only `label`. An audit row
 * (`action: 'updated'`) is inserted atomically in the same transaction.
 *
 * Fails with `VALIDATION_ERROR` when input fails Zod validation, or with
 * `NOT_FOUND` when no active credential exists for `key`.
 *
 * @param input - Update input including key, optional label, actorId, and ipAddress.
 * @returns `ServiceOutput` with `{ id, key }` on success.
 */
export async function updateSocialCredentialMetadata(
    input: UpdateSocialCredentialMetadataInput
): Promise<ServiceOutput<SocialCredentialMutationResult>> {
    const parsed = UpdateSocialCredentialMetadataInputSchema.safeParse(input);
    if (!parsed.success) {
        return errorOutput<SocialCredentialMutationResult>(
            ServiceErrorCode.VALIDATION_ERROR,
            parsed.error.issues.map((issue) => issue.message).join('; ')
        );
    }

    const { key, label, actorId, ipAddress } = parsed.data;

    try {
        const db = getDb();

        // 1. Find the active credential.
        const active = await db
            .select({ id: socialCredentials.id })
            .from(socialCredentials)
            .where(and(eq(socialCredentials.key, key), isNull(socialCredentials.deletedAt)))
            .limit(1);

        if (active.length === 0) {
            return errorOutput<SocialCredentialMutationResult>(
                ServiceErrorCode.NOT_FOUND,
                `No active credential found for key '${key}'`
            );
        }

        const credentialId = active[0]?.id;
        if (credentialId === undefined) {
            return errorOutput<SocialCredentialMutationResult>(
                ServiceErrorCode.INTERNAL_ERROR,
                'Active credential row did not return an ID'
            );
        }

        // 2. Build the partial update set — only provided fields.
        const updateSet: Record<string, unknown> = { updatedAt: new Date() };
        if (label !== undefined) {
            updateSet.label = label;
        }

        // 3. Transactional update: metadata + audit.
        await withTransaction(async (tx) => {
            await tx
                .update(socialCredentials)
                .set(updateSet)
                .where(eq(socialCredentials.id, credentialId));

            await tx.insert(socialCredentialAudit).values({
                actorId,
                action: 'updated',
                key,
                ipAddress: ipAddress ?? null
            });
        });

        apiLogger.info(
            { key, credentialId, actorId },
            'social-credential-vault: credential metadata updated'
        );

        return { data: { id: credentialId, key } };
    } catch (error) {
        apiLogger.error(
            {
                key,
                actorId,
                error: error instanceof Error ? error.message : String(error)
            },
            'social-credential-vault: unexpected error in updateSocialCredentialMetadata'
        );
        return errorOutput<SocialCredentialMutationResult>(
            ServiceErrorCode.INTERNAL_ERROR,
            'Unexpected error while updating credential metadata'
        );
    }
}

/**
 * Soft-deletes the active social credential for `key`.
 *
 * Sets `deletedAt` and `deletedById` on the credential row and inserts an
 * audit row (`action: 'deleted'`) in one transaction. The row remains in the
 * database but is no longer active.
 *
 * Fails with `VALIDATION_ERROR` when input fails Zod validation, or with
 * `NOT_FOUND` when no active credential exists for `key` (including when the
 * key was already soft-deleted).
 *
 * @param input - Delete input including key, actorId, and ipAddress.
 * @returns `ServiceOutput` with `{ key }` on success.
 */
export async function deleteSocialCredential(
    input: DeleteSocialCredentialInput
): Promise<ServiceOutput<SocialCredentialDeleteResult>> {
    const parsed = DeleteSocialCredentialInputSchema.safeParse(input);
    if (!parsed.success) {
        return errorOutput<SocialCredentialDeleteResult>(
            ServiceErrorCode.VALIDATION_ERROR,
            parsed.error.issues.map((issue) => issue.message).join('; ')
        );
    }

    const { key, actorId, ipAddress } = parsed.data;

    try {
        const db = getDb();

        // 1. Find the active credential.
        const active = await db
            .select({ id: socialCredentials.id })
            .from(socialCredentials)
            .where(and(eq(socialCredentials.key, key), isNull(socialCredentials.deletedAt)))
            .limit(1);

        if (active.length === 0) {
            return errorOutput<SocialCredentialDeleteResult>(
                ServiceErrorCode.NOT_FOUND,
                `No active credential found for key '${key}'`
            );
        }

        const credentialId = active[0]?.id;
        if (credentialId === undefined) {
            return errorOutput<SocialCredentialDeleteResult>(
                ServiceErrorCode.INTERNAL_ERROR,
                'Active credential row did not return an ID'
            );
        }

        const now = new Date();

        // 2. Transactional soft-delete + audit.
        await withTransaction(async (tx) => {
            await tx
                .update(socialCredentials)
                .set({
                    deletedAt: now,
                    deletedById: actorId,
                    updatedAt: now
                })
                .where(eq(socialCredentials.id, credentialId));

            await tx.insert(socialCredentialAudit).values({
                actorId,
                action: 'deleted',
                key,
                ipAddress: ipAddress ?? null
            });
        });

        apiLogger.info(
            { key, credentialId, actorId },
            'social-credential-vault: credential deleted'
        );

        return { data: { key } };
    } catch (error) {
        apiLogger.error(
            {
                key,
                actorId,
                error: error instanceof Error ? error.message : String(error)
            },
            'social-credential-vault: unexpected error in deleteSocialCredential'
        );
        return errorOutput<SocialCredentialDeleteResult>(
            ServiceErrorCode.INTERNAL_ERROR,
            'Unexpected error while deleting credential'
        );
    }
}

/**
 * Lists social credentials, returning only the masked (non-secret) subset.
 *
 * The fields `ciphertext`, `iv`, and `authTag` are NEVER included in the result.
 * Only metadata safe to surface in the admin UI is returned.
 *
 * @param input - `{ includeDeleted?: boolean }` — defaults to active rows only.
 * @returns `ServiceOutput` with `{ items, total }` on success.
 *
 * @example
 * ```ts
 * const result = await listSocialCredentials({ includeDeleted: false });
 * if (result.data) {
 *   console.log(result.data.total);
 * }
 * ```
 */
export async function listSocialCredentials(
    input: ListSocialCredentialsInput = {}
): Promise<ServiceOutput<{ items: SocialCredentialMasked[]; total: number }>> {
    const { includeDeleted = false } = input;

    try {
        const db = getDb();

        const condition = includeDeleted ? undefined : isNull(socialCredentials.deletedAt);

        // Select only masked fields — NEVER ciphertext, iv, or authTag.
        const rows = condition
            ? await db
                  .select({
                      id: socialCredentials.id,
                      key: socialCredentials.key,
                      label: socialCredentials.label,
                      createdAt: socialCredentials.createdAt,
                      updatedAt: socialCredentials.updatedAt,
                      deletedAt: socialCredentials.deletedAt
                  })
                  .from(socialCredentials)
                  .where(condition)
            : await db
                  .select({
                      id: socialCredentials.id,
                      key: socialCredentials.key,
                      label: socialCredentials.label,
                      createdAt: socialCredentials.createdAt,
                      updatedAt: socialCredentials.updatedAt,
                      deletedAt: socialCredentials.deletedAt
                  })
                  .from(socialCredentials);

        // Serialize Date → ISO string to match SocialCredentialMasked.
        const items: SocialCredentialMasked[] = rows.map((row) => ({
            id: row.id,
            key: row.key as SocialCredentialKey,
            label: row.label ?? null,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null
        }));

        return { data: { items, total: items.length } };
    } catch (error) {
        apiLogger.error(
            { error: error instanceof Error ? error.message : String(error) },
            'social-credential-vault: unexpected error in listSocialCredentials'
        );
        return errorOutput<{ items: SocialCredentialMasked[]; total: number }>(
            ServiceErrorCode.INTERNAL_ERROR,
            'Unexpected error while listing credentials'
        );
    }
}

/**
 * Reads and decrypts the active social credential for `key`.
 *
 * Read-only path — no audit row is written. Used by the read-site call
 * migrations (T-021-T-024) to supply the plaintext secret at call time.
 *
 * **SECURITY**: The returned `plaintext` MUST NOT be logged anywhere in the
 * call stack. This function itself never logs the plaintext.
 *
 * Fails with `NOT_FOUND` when no active credential exists for `key`.
 *
 * @param input - Object containing the `key` to look up.
 * @returns `ServiceOutput` with `{ key, plaintext }` on success.
 *
 * @example
 * ```ts
 * const result = await getDecryptedSocialCredential({ key: 'make_webhook_url' });
 * if (result.data) {
 *   // Use result.data.plaintext — NEVER log it.
 * }
 * ```
 */
export async function getDecryptedSocialCredential(
    input: GetDecryptedSocialCredentialInput
): Promise<ServiceOutput<DecryptedSocialCredentialResult>> {
    const { key } = input;

    try {
        const db = getDb();

        const rows = await db
            .select({
                ciphertext: socialCredentials.ciphertext,
                iv: socialCredentials.iv,
                authTag: socialCredentials.authTag
            })
            .from(socialCredentials)
            .where(and(eq(socialCredentials.key, key), isNull(socialCredentials.deletedAt)))
            .limit(1);

        if (rows.length === 0) {
            return errorOutput<DecryptedSocialCredentialResult>(
                ServiceErrorCode.NOT_FOUND,
                `No active credential found for key '${key}'`
            );
        }

        const row = rows[0];
        if (row === undefined) {
            return errorOutput<DecryptedSocialCredentialResult>(
                ServiceErrorCode.NOT_FOUND,
                `No active credential found for key '${key}'`
            );
        }

        const { plaintext } = decryptSecret({
            ciphertext: row.ciphertext,
            iv: row.iv,
            authTag: row.authTag
        });

        // Log only the key — NEVER log the plaintext.
        apiLogger.debug(
            { key },
            'social-credential-vault: credential decrypted for internal caller'
        );

        return { data: { key, plaintext } };
    } catch (error) {
        apiLogger.error(
            {
                key,
                error: error instanceof Error ? error.message : String(error)
            },
            'social-credential-vault: unexpected error in getDecryptedSocialCredential'
        );
        return errorOutput<DecryptedSocialCredentialResult>(
            ServiceErrorCode.INTERNAL_ERROR,
            'Unexpected error while decrypting credential'
        );
    }
}
