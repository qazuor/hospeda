/**
 * AI credential vault crypto util (SPEC-173 T-021).
 *
 * Symmetric AES-256-GCM encryption/decryption for AI provider API keys at rest.
 * The master key comes ONLY from `env.HOSPEDA_AI_VAULT_MASTER_KEY` (read here and
 * nowhere else, §5.5). The `@repo/ai-core` package NEVER touches this file
 * (AC-4 isolation) — encryption lives entirely in `apps/api`.
 *
 * Output shape mirrors the three `ai_provider_credentials` columns
 * (`ciphertext`, `iv`, `auth_tag`), all stored as base64 strings.
 *
 * Decision (owner-approved 2026-06-04): the 32-byte AES key is derived as
 * `sha256(HOSPEDA_AI_VAULT_MASTER_KEY)`. This always yields exactly 32 bytes
 * regardless of the operator-supplied string, is robust to non-base64 input,
 * and is consistent with the repo's existing sha256 usage. Changing this
 * derivation later would make all previously-encrypted credentials
 * undecryptable.
 *
 * @module utils/ai-vault
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from './env.js';

/** AES-256-GCM. */
const ALGORITHM = 'aes-256-gcm' as const;

/** GCM initialisation vector length: 12 bytes / 96 bits (the GCM-recommended nonce size). */
const IV_BYTES = 12;

/**
 * The encrypted form of a secret, ready to persist into the three
 * `ai_provider_credentials` columns. All fields are base64-encoded.
 */
export interface EncryptedSecret {
    /** AES-256-GCM ciphertext (base64). */
    readonly ciphertext: string;
    /** AES-256-GCM initialisation vector, 12 bytes (base64). Unique per encryption. */
    readonly iv: string;
    /** AES-256-GCM authentication tag, 16 bytes (base64). Verifies integrity on decrypt. */
    readonly authTag: string;
}

/**
 * Derives the 32-byte AES-256 key from the configured master key.
 *
 * @returns The 32-byte key buffer.
 * @throws {Error} When `HOSPEDA_AI_VAULT_MASTER_KEY` is not configured.
 */
function deriveKey(): Buffer {
    const masterKey = env.HOSPEDA_AI_VAULT_MASTER_KEY;
    if (masterKey === undefined || masterKey.length === 0) {
        throw new Error(
            'HOSPEDA_AI_VAULT_MASTER_KEY is not set. The AI credential vault cannot ' +
                'encrypt or decrypt without it. Generate one with: openssl rand -base64 32'
        );
    }
    // sha256 always yields exactly 32 bytes — the AES-256 key length.
    return createHash('sha256').update(masterKey, 'utf8').digest();
}

/**
 * Encrypts a plaintext secret with AES-256-GCM using a fresh random IV.
 *
 * @param input - The plaintext to encrypt.
 * @returns The base64-encoded {@link EncryptedSecret} (ciphertext + iv + authTag).
 * @throws {Error} When the master key is not configured.
 *
 * @example
 * ```ts
 * const enc = encryptSecret({ plaintext: 'sk-provider-api-key' });
 * // → { ciphertext: '...', iv: '...', authTag: '...' } (all base64)
 * ```
 */
export function encryptSecret(input: { readonly plaintext: string }): EncryptedSecret {
    const { plaintext } = input;
    const key = deriveKey();
    const iv = randomBytes(IV_BYTES);

    // authTagLength is explicit so a future algorithm/default change can never
    // silently weaken the tag (semgrep gcm-no-tag-length).
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: 16 });
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
        ciphertext: ciphertext.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64')
    };
}

/**
 * Decrypts an {@link EncryptedSecret} produced by {@link encryptSecret}.
 *
 * The GCM auth tag is verified on `final()`: any tampering with the ciphertext,
 * iv, or auth tag throws instead of returning corrupted plaintext.
 *
 * @param input - The base64-encoded ciphertext + iv + authTag.
 * @returns The decrypted plaintext.
 * @throws {Error} When the master key is not configured, or when authentication
 *   fails (tampered ciphertext/iv/authTag, or wrong key).
 *
 * @example
 * ```ts
 * const { plaintext } = decryptSecret(enc);
 * ```
 */
export function decryptSecret(input: EncryptedSecret): { readonly plaintext: string } {
    const { ciphertext, iv, authTag } = input;
    const key = deriveKey();

    // Explicit authTagLength rejects truncated auth tags outright instead of
    // accepting any tag length the attacker supplies (semgrep gcm-no-tag-length).
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'), {
        authTagLength: 16
    });
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));

    const plaintext = Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64')),
        decipher.final()
    ]);

    return { plaintext: plaintext.toString('utf8') };
}
