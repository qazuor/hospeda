/**
 * GPG symmetric encryption helpers for backup at-rest protection.
 *
 * SPEC-103 T-078/T-079/T-080: backups land in Cloudflare R2. R2 itself
 * encrypts at rest with its own keys, but anyone with the R2 access
 * credentials can read raw pg_dump output (which contains every email,
 * billing record, and seed user). Wrapping the dump in GPG symmetric
 * AES256 means a leaked R2 key alone is insufficient to read the data;
 * the operator's BACKUP_PASSPHRASE is the second factor.
 *
 * Convention:
 * - The daily cron (scripts/backup/postgres-to-r2.sh) and the on-demand
 *   `hops db-backup-now` both produce files with the `.dump.gpg` suffix
 *   when BACKUP_PASSPHRASE is set, or plain `.dump` when not. Encryption
 *   is OPTIONAL so existing deployments keep working — operators opt in
 *   by setting the passphrase env var. `hops db-restore` detects the
 *   suffix and decrypts before pg_restore.
 * - The passphrase is passed via `--passphrase` argv. This is visible
 *   in `ps` for the sub-second gpg invocation; on a single-operator VPS
 *   that exposure window is acceptable. Switch to `--passphrase-fd` if
 *   the threat model later requires hiding from concurrent shell users.
 */

import { execa } from 'execa';

/**
 * Suffix appended to encrypted backup file names. Restore inspects
 * this to decide whether to decrypt before pg_restore.
 */
export const ENCRYPTED_SUFFIX = '.gpg';

/**
 * Encrypt a buffer with GPG symmetric AES256.
 *
 * @param plaintext - raw bytes to encrypt (typically pg_dump output).
 * @param passphrase - the BACKUP_PASSPHRASE secret.
 * @returns the encrypted bytes (GPG armored binary).
 * @throws when gpg is not installed, or when the encryption exits non-zero.
 */
export async function gpgSymmetricEncrypt(plaintext: Buffer, passphrase: string): Promise<Buffer> {
    if (!passphrase) {
        throw new Error('gpgSymmetricEncrypt: passphrase is empty');
    }
    try {
        const result = await execa(
            'gpg',
            [
                '--batch',
                '--yes',
                '--symmetric',
                '--cipher-algo',
                'AES256',
                '--passphrase',
                passphrase
            ],
            { input: plaintext, encoding: null }
        );
        return Buffer.from(result.stdout as unknown as Uint8Array);
    } catch (err) {
        if (err instanceof Error && 'code' in err && (err as { code?: string }).code === 'ENOENT') {
            throw new Error(
                'gpg binary not found on PATH. Install with `sudo apt install gnupg` (Debian/Ubuntu) before encrypting backups.'
            );
        }
        throw err;
    }
}

/**
 * Decrypt a buffer that was produced by {@link gpgSymmetricEncrypt}.
 *
 * @param ciphertext - raw bytes of the encrypted dump.
 * @param passphrase - the BACKUP_PASSPHRASE secret used to encrypt.
 * @returns the decrypted plaintext bytes (pg_dump output).
 * @throws when gpg is not installed, or when the passphrase is wrong /
 * the input is not a valid GPG message.
 */
export async function gpgSymmetricDecrypt(ciphertext: Buffer, passphrase: string): Promise<Buffer> {
    if (!passphrase) {
        throw new Error('gpgSymmetricDecrypt: passphrase is empty');
    }
    try {
        const result = await execa(
            'gpg',
            ['--batch', '--yes', '--decrypt', '--passphrase', passphrase],
            { input: ciphertext, encoding: null }
        );
        return Buffer.from(result.stdout as unknown as Uint8Array);
    } catch (err) {
        if (err instanceof Error && 'code' in err && (err as { code?: string }).code === 'ENOENT') {
            throw new Error(
                'gpg binary not found on PATH. Install with `sudo apt install gnupg` (Debian/Ubuntu) before restoring encrypted backups.'
            );
        }
        throw err;
    }
}

/**
 * Returns true when the R2 object key ends with the encrypted suffix.
 * Used by `hops db-restore` to detect whether to pipe through decrypt
 * before pg_restore.
 */
export function isEncryptedBackup(key: string): boolean {
    return key.endsWith(ENCRYPTED_SUFFIX);
}
