/**
 * Social credential vault crypto util (HOS-64 / SPEC-297a G-4, T-017).
 *
 * Thin wrapper around the shared `secret-vault-crypto.ts` util (T-014),
 * pinning it to `env.HOSPEDA_SOCIAL_VAULT_MASTER_KEY`. Mirrors `ai-vault.ts`
 * (SPEC-173) exactly — same shape, different master key — so the social
 * vault has a separate blast radius from the AI vault.
 *
 * Output shape mirrors the three `social_credentials` columns
 * (`ciphertext`, `iv`, `auth_tag`), all stored as base64 strings.
 *
 * @module utils/social-vault
 */

import { env } from './env.js';
import type { EncryptedSecret } from './secret-vault-crypto.js';
import {
    decryptSecret as decryptSecretShared,
    encryptSecret as encryptSecretShared
} from './secret-vault-crypto.js';

export type { EncryptedSecret } from './secret-vault-crypto.js';

/**
 * Encrypts a plaintext secret with AES-256-GCM using a fresh random IV,
 * keyed by `HOSPEDA_SOCIAL_VAULT_MASTER_KEY`.
 *
 * @param input - The plaintext to encrypt.
 * @returns The base64-encoded {@link EncryptedSecret} (ciphertext + iv + authTag).
 * @throws {Error} When `HOSPEDA_SOCIAL_VAULT_MASTER_KEY` is not configured.
 *
 * @example
 * ```ts
 * const enc = encryptSecret({ plaintext: 'https://hook.make.com/...' });
 * // → { ciphertext: '...', iv: '...', authTag: '...' } (all base64)
 * ```
 */
export function encryptSecret(input: { readonly plaintext: string }): EncryptedSecret {
    return encryptSecretShared({
        plaintext: input.plaintext,
        masterKey: env.HOSPEDA_SOCIAL_VAULT_MASTER_KEY,
        masterKeyName: 'HOSPEDA_SOCIAL_VAULT_MASTER_KEY'
    });
}

/**
 * Decrypts an {@link EncryptedSecret} produced by {@link encryptSecret},
 * keyed by `HOSPEDA_SOCIAL_VAULT_MASTER_KEY`.
 *
 * The GCM auth tag is verified on `final()`: any tampering with the ciphertext,
 * iv, or auth tag throws instead of returning corrupted plaintext.
 *
 * @param input - The base64-encoded ciphertext + iv + authTag.
 * @returns The decrypted plaintext.
 * @throws {Error} When `HOSPEDA_SOCIAL_VAULT_MASTER_KEY` is not configured, or when
 *   authentication fails (tampered ciphertext/iv/authTag, or wrong key).
 *
 * @example
 * ```ts
 * const { plaintext } = decryptSecret(enc);
 * ```
 */
export function decryptSecret(input: EncryptedSecret): { readonly plaintext: string } {
    return decryptSecretShared({
        ciphertext: input.ciphertext,
        iv: input.iv,
        authTag: input.authTag,
        masterKey: env.HOSPEDA_SOCIAL_VAULT_MASTER_KEY,
        masterKeyName: 'HOSPEDA_SOCIAL_VAULT_MASTER_KEY'
    });
}
