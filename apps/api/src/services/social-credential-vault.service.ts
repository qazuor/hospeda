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
import { encryptSecret } from '../utils/social-vault.js';

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

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/** Returned by `createSocialCredential`. */
export interface SocialCredentialMutationResult {
    readonly id: string;
    readonly key: SocialCredentialKey;
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
