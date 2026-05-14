/**
 * `hops db-backup-now [--yes]` — trigger a Postgres backup outside the
 * 03:00 ART daily cron. Writes to R2 under the `manual/` prefix so the
 * dump is distinguishable from the cron-produced ones at the bucket
 * root.
 *
 * Backup format: `pg_dump -Fc --no-owner --no-privileges` (custom
 * format with built-in zlib). Matches what `scripts/backup/postgres-to-r2.sh`
 * produces, so `hops db-restore` can read either source uniformly.
 *
 * SPEC-103 T-079: optional GPG symmetric AES256 encryption when the
 * BACKUP_PASSPHRASE env var is set (via scripts/server-tools/.env.local).
 * The resulting R2 object key carries the `.dump.gpg` suffix; `hops
 * db-restore` (T-080) detects the suffix and pipes through gpg decrypt
 * before pg_restore. The daily cron (T-078) implements the same
 * convention so both paths produce uniformly-named artifacts.
 */

import { findContainer, getActiveTarget } from '../lib/container-lookup.ts';
import { get } from '../lib/env.ts';
import { ENCRYPTED_SUFFIX, gpgSymmetricEncrypt } from '../lib/gpg.ts';
import { die, log } from '../lib/log.ts';
import { pgDumpToBuffer } from '../lib/postgres.ts';
import { confirm } from '../lib/prompt.ts';
import { createR2Client, humanSize, utcBackupTimestamp } from '../lib/r2.ts';
import { getDbCredentials } from '../lib/target.ts';

/** Minimum acceptable dump size in bytes (sanity check against partial dumps). */
const MIN_BACKUP_SIZE = 100 * 1024;

const HELP = `
hops db-backup-now [--yes]

Trigger a Postgres backup outside the daily 03:00 ART cron. Uploads to
R2 under the \`manual/\` prefix.

Flags:
  --yes          Skip the confirmation prompt (for automation).
  --help, -h     Show this help.

What it does:
  1. Locate the Postgres container.
  2. Confirm with the operator (skip with --yes).
  3. Run pg_dump -Fc inside the container, capture binary stdout.
  4. Sanity-check size (>= 100 KB).
  5. Upload to s3://<R2_BUCKET>/manual/hospeda-postgres-<TS>.dump.

Notes:
  - Backups are NOT encrypted at rest beyond the R2 bucket's own
    credentials. GPG encryption is a planned follow-up that will
    cover both this command and the bash daily cron.
  - The Hospeda DB is small (a few MB). The dump is held in RAM
    during the upload — fine until the database grows past ~100 MB,
    at which point we'll switch to a streaming multipart upload.
`.trim();

export async function dbBackupNow(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const skipConfirm = argv.includes('--yes');

    const container = await findContainer('postgres');
    const credentials = getDbCredentials(getActiveTarget());
    const user = credentials.user;
    const db = credentials.database;

    const r2 = createR2Client(getActiveTarget());
    const timestamp = utcBackupTimestamp();

    const passphrase = get('BACKUP_PASSPHRASE');
    const encrypt = passphrase !== undefined && passphrase.length > 0;
    const key = encrypt
        ? `manual/hospeda-postgres-${timestamp}.dump${ENCRYPTED_SUFFIX}`
        : `manual/hospeda-postgres-${timestamp}.dump`;

    log.info(`Source : container=${container} db=${db} user=${user}`);
    log.info(`Target : s3://${r2.bucket}/${key}`);
    if (encrypt) {
        log.info('Encryption: GPG symmetric AES256 (BACKUP_PASSPHRASE set)');
    } else {
        log.warn(
            'Encryption DISABLED — BACKUP_PASSPHRASE not set in scripts/server-tools/local secrets. Raw pg_dump will land in R2.'
        );
    }

    if (!skipConfirm) {
        const ok = await confirm(`Trigger a manual pg_dump and upload to R2 (${key})?`, {
            defaultValue: true
        });
        if (!ok) {
            log.warn('Aborted.');
            return;
        }
    }

    log.info('Running pg_dump...');
    const result = await pgDumpToBuffer({ container, user, db });

    if (result.exitCode !== 0) {
        die(
            `pg_dump failed (exit ${result.exitCode}): ${result.stderr.trim() || '<empty stderr>'}`
        );
    }

    const rawSize = result.stdout.length;
    if (rawSize < MIN_BACKUP_SIZE) {
        die(
            `pg_dump produced a suspiciously small file (${rawSize} bytes < ${MIN_BACKUP_SIZE}). Aborting upload to avoid uploading a corrupt backup.`
        );
    }

    log.ok(`pg_dump produced ${humanSize(rawSize)} (${rawSize} bytes).`);

    let uploadBuffer: Buffer = result.stdout;
    if (encrypt && passphrase) {
        log.info('Encrypting with GPG symmetric AES256...');
        uploadBuffer = await gpgSymmetricEncrypt(result.stdout, passphrase);
        log.ok(`Encrypted: ${humanSize(uploadBuffer.length)} (${uploadBuffer.length} bytes).`);
    }

    log.info('Uploading to R2...');
    await r2.putBuffer(key, uploadBuffer);

    log.ok(`Backup uploaded: s3://${r2.bucket}/${key} (${humanSize(uploadBuffer.length)})`);
    log.hint('Restore with `hops db-restore` (interactive picker lists all backups).');
}
