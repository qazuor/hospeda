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
 *
 * Runtime notes (HOS-1953):
 * - gpg is spawned through `node:child_process.spawn`, NOT execa. Under
 *   bun (both `bun run` and the `bun build --compile` binary the VPS runs)
 *   execa forwards `encoding: 'buffer'` to `spawn()`, which bun rejects
 *   with "Unknown encoding: buffer"; execa's early-error path then tries to
 *   `Object.assign` dummy streams onto bun's ChildProcess, whose stdio
 *   properties are read-only, so the real error is masked by
 *   "Attempted to assign to readonly property." Plain `spawn` with byte
 *   chunks is the same approach `pgDumpToBuffer` already uses.
 * - The passphrase never reaches argv (where it would be visible in `ps`).
 *   It is written to a dedicated pipe on fd 3 and gpg reads it through
 *   `--passphrase-fd 3`. `--pinentry-mode loopback` is required for that on
 *   gpg >= 2.1. `--no-symkey-cache` (gpg >= 2.2.7; the VPS runs 2.2.27) is
 *   defence in depth: it asks gpg-agent not to keep the passphrase in its
 *   cache after the process exits. No test depends on it — removing it
 *   changed no observable result on gpg 2.4.4 (a wrong passphrase was still
 *   rejected after a successful decrypt), so do not cite it as the reason
 *   the wrong-passphrase test passes.
 */

import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import type { Writable } from 'node:stream';

/**
 * Suffix appended to encrypted backup file names. Restore inspects
 * this to decide whether to decrypt before pg_restore.
 */
export const ENCRYPTED_SUFFIX = '.gpg';

/** File descriptor gpg reads the passphrase from (a dedicated pipe). */
const PASSPHRASE_FD = 3;

/**
 * Flags shared by every gpg invocation. The passphrase travels on
 * {@link PASSPHRASE_FD}, never on argv.
 */
const BASE_GPG_ARGS: ReadonlyArray<string> = [
    '--batch',
    '--yes',
    '--no-symkey-cache',
    '--pinentry-mode',
    'loopback',
    '--passphrase-fd',
    String(PASSPHRASE_FD)
];

/**
 * Run gpg with `input` on stdin and the passphrase on fd 3, capturing
 * stdout as raw bytes.
 *
 * @param params.operationArgs - the operation flags (e.g. `--symmetric ...`).
 * @param params.input - bytes written to gpg's stdin.
 * @param params.passphrase - written to fd 3, never to argv.
 * @param params.missingBinaryHint - message used when gpg is not installed.
 * @returns gpg's stdout bytes.
 * @throws when gpg is missing or exits non-zero (stderr is included).
 */
async function runGpg(params: {
    readonly operationArgs: ReadonlyArray<string>;
    readonly input: Buffer;
    readonly passphrase: string;
    readonly missingBinaryHint: string;
}): Promise<Buffer> {
    const args = [...BASE_GPG_ARGS, ...params.operationArgs];

    return new Promise<Buffer>((resolve, reject) => {
        let settled = false;
        const fail = (error: Error): void => {
            if (settled) return;
            settled = true;
            reject(error);
        };

        const child = spawn('gpg', args, { stdio: ['pipe', 'pipe', 'pipe', 'pipe'] });
        const stdoutChunks: Array<Buffer> = [];
        const stderrChunks: Array<Buffer> = [];

        child.on('error', (err: NodeJS.ErrnoException) => {
            fail(err.code === 'ENOENT' ? new Error(params.missingBinaryHint) : err);
        });

        child.stdout?.on('data', (chunk: Buffer) => {
            stdoutChunks.push(chunk);
        });
        child.stderr?.on('data', (chunk: Buffer) => {
            stderrChunks.push(chunk);
        });

        // gpg may exit (bad passphrase, corrupt input) before consuming all
        // of stdin or fd 3; the resulting EPIPE is reported through the exit
        // code below, so the stream errors themselves are swallowed here.
        const passphrasePipe = child.stdio[PASSPHRASE_FD] as Writable | null | undefined;
        passphrasePipe?.on('error', () => {});
        child.stdin?.on('error', () => {});

        child.on('close', (code) => {
            if (settled) return;
            if (code === 0) {
                settled = true;
                resolve(Buffer.concat(stdoutChunks));
                return;
            }
            const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim();
            fail(
                new Error(`gpg exited with code ${code ?? 'null'}: ${stderr || '<empty stderr>'}`)
            );
        });

        passphrasePipe?.end(params.passphrase);
        child.stdin?.end(params.input);
    });
}

/**
 * Encrypt a buffer with GPG symmetric AES256.
 *
 * @param plaintext - raw bytes to encrypt (typically pg_dump output).
 * @param passphrase - the BACKUP_PASSPHRASE secret.
 * @returns the encrypted bytes (binary OpenPGP message).
 * @throws when gpg is not installed, or when the encryption exits non-zero.
 */
export async function gpgSymmetricEncrypt(plaintext: Buffer, passphrase: string): Promise<Buffer> {
    if (!passphrase) {
        throw new Error('gpgSymmetricEncrypt: passphrase is empty');
    }
    return runGpg({
        operationArgs: ['--symmetric', '--cipher-algo', 'AES256'],
        input: plaintext,
        passphrase,
        missingBinaryHint:
            'gpg binary not found on PATH. Install with `sudo apt install gnupg` (Debian/Ubuntu) before encrypting backups.'
    });
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
    return runGpg({
        operationArgs: ['--decrypt'],
        input: ciphertext,
        passphrase,
        missingBinaryHint:
            'gpg binary not found on PATH. Install with `sudo apt install gnupg` (Debian/Ubuntu) before restoring encrypted backups.'
    });
}

/**
 * Returns true when the R2 object key ends with the encrypted suffix.
 * Used by `hops db-restore` to detect whether to pipe through decrypt
 * before pg_restore.
 */
export function isEncryptedBackup(key: string): boolean {
    return key.endsWith(ENCRYPTED_SUFFIX);
}
