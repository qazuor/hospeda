/**
 * One-time social credential vault data migration (HOS-64 T-025).
 *
 * Moves the 4 social automation secrets from their pre-vault sources
 * (3 plaintext env vars + 1 `social_settings` row) into the social
 * credential vault, via {@link createSocialCredential} (T-017). Pure
 * business logic only — resolving the actual env var / DB values is the
 * caller's job (see `scripts/social-vault-migrate.ts`), which keeps this
 * function trivially testable against an in-memory `source` object.
 *
 * Idempotent by construction: `createSocialCredential` itself refuses to
 * create a second active credential for a key that already has one
 * (`VALIDATION_ERROR`, "already exists"). This module treats that specific
 * error as a no-op skip rather than a failure, so re-running the migration
 * against an environment that has already been migrated (fully or
 * partially) is always safe.
 *
 * @module services/social-vault-migration
 */

import { ServiceErrorCode } from '@repo/schemas';
import {
    type CreateSocialCredentialInput,
    createSocialCredential,
    type SocialCredentialKey
} from './social-credential-vault.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Plaintext values to migrate, one per social credential key. `undefined`,
 * `null`, or an empty/whitespace-only string are all treated as "no source
 * value for this key" and the key is skipped (not an error — not every
 * environment has every secret configured).
 */
export interface SocialVaultMigrationSource {
    readonly makeWebhookUrl?: string | null;
    readonly makeApiKey?: string | null;
    readonly aiSocialKey?: string | null;
    readonly operatorPin?: string | null;
}

/** Input for {@link migrateSocialCredentialsToVault}. */
export interface MigrateSocialCredentialsToVaultInput {
    /** Plaintext values sourced from env vars / social_settings by the caller. */
    readonly source: SocialVaultMigrationSource;
    /** Actor attributed on the `social_credential_audit` "created" rows. */
    readonly actorId: string;
    /** IP address for the audit row, if known. Defaults to `null`. */
    readonly ipAddress?: string | null;
}

/** A key that failed to migrate for a reason other than "already exists". */
export interface SocialVaultMigrationError {
    readonly key: SocialCredentialKey;
    readonly code: ServiceErrorCode;
    readonly message: string;
}

/** Result of {@link migrateSocialCredentialsToVault}. */
export interface SocialVaultMigrationResult {
    /** Keys newly created in the vault this run. */
    readonly created: SocialCredentialKey[];
    /** Keys that already had an active vault credential — left untouched. */
    readonly skippedExisting: SocialCredentialKey[];
    /** Keys with no (or blank) plaintext value in `source` — nothing to migrate. */
    readonly skippedNoSource: SocialCredentialKey[];
    /** Keys that failed for an unexpected reason. */
    readonly errors: SocialVaultMigrationError[];
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

const KEY_TO_SOURCE_FIELD: Record<SocialCredentialKey, keyof SocialVaultMigrationSource> = {
    make_webhook_url: 'makeWebhookUrl',
    make_api_key: 'makeApiKey',
    ai_social_key: 'aiSocialKey',
    operator_pin: 'operatorPin'
};

const ALREADY_EXISTS_MARKER = 'already exists';

/**
 * Resolves the plaintext for `key` out of `source`, treating blank/whitespace
 * values the same as "absent" so a stray empty-string env var doesn't create
 * an empty-secret credential.
 */
function resolveSourcePlaintext(
    source: SocialVaultMigrationSource,
    key: SocialCredentialKey
): string | undefined {
    const value = source[KEY_TO_SOURCE_FIELD[key]];
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Migrates every social credential key that has a source value into the
 * vault. Safe to call multiple times (including with a partial or fully
 * empty `source`) — see the module-level idempotency note.
 *
 * @param input - Source plaintext values, actor, and optional IP address.
 * @returns A per-key breakdown of what happened.
 */
export async function migrateSocialCredentialsToVault(
    input: MigrateSocialCredentialsToVaultInput
): Promise<SocialVaultMigrationResult> {
    const { source, actorId, ipAddress = null } = input;

    const created: SocialCredentialKey[] = [];
    const skippedExisting: SocialCredentialKey[] = [];
    const skippedNoSource: SocialCredentialKey[] = [];
    const errors: SocialVaultMigrationError[] = [];

    const keys: SocialCredentialKey[] = [
        'make_webhook_url',
        'make_api_key',
        'ai_social_key',
        'operator_pin'
    ];

    for (const key of keys) {
        const plaintext = resolveSourcePlaintext(source, key);
        if (plaintext === undefined) {
            skippedNoSource.push(key);
            continue;
        }

        const createInput: CreateSocialCredentialInput = {
            key,
            plaintext,
            actorId,
            ipAddress,
            label: 'Migrated by social-vault-migrate.ts (HOS-64 T-025)'
        };
        const result = await createSocialCredential(createInput);

        if (result.data) {
            created.push(key);
            continue;
        }

        const message = result.error?.message ?? 'Unknown error';
        if (message.includes(ALREADY_EXISTS_MARKER)) {
            skippedExisting.push(key);
            continue;
        }

        errors.push({
            key,
            code: result.error?.code ?? ServiceErrorCode.INTERNAL_ERROR,
            message
        });
    }

    return { created, skippedExisting, skippedNoSource, errors };
}
