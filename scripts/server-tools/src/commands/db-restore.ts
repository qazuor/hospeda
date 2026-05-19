/**
 * `hops db-restore [N] [--target-db <name>] [--no-snapshot-first] [--yes]`
 *
 * Pick a backup from R2 and restore it into the live Postgres
 * container. DESTRUCTIVE — replaces every object in the target
 * database.
 *
 * Safety net (default ON, opt out with --no-snapshot-first): take a
 * fresh pg_dump snapshot of the CURRENT database state and upload it
 * to `manual/pre-restore-<TS>.dump` BEFORE running pg_restore. If the
 * chosen backup turns out to be corrupt or a wrong choice, the
 * pre-restore snapshot is the get-out-of-jail card.
 *
 * The interactive picker lists every object in the bucket sorted by
 * last-modified date (newest first) so the latest daily and the latest
 * manual backups are at the top of the list.
 */

import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findContainer, getActiveTarget } from '../lib/container-lookup.ts';
import { docker, runInContainer } from '../lib/docker.ts';
import { get } from '../lib/env.ts';
import {
    ENCRYPTED_SUFFIX,
    gpgSymmetricDecrypt,
    gpgSymmetricEncrypt,
    isEncryptedBackup
} from '../lib/gpg.ts';
import { die, log } from '../lib/log.ts';
import { pgDumpToBuffer } from '../lib/postgres.ts';
import { confirm, pickOne, resolveNumberArg } from '../lib/prompt.ts';
import { type R2Object, createR2Client, humanSize, utcBackupTimestamp } from '../lib/r2.ts';
import { getDbCredentials } from '../lib/target.ts';

const HELP = `
hops db-restore [N] [--target-db <name>] [--no-snapshot-first] [--yes]

Restore the Postgres database from a backup stored in R2.

Arguments:
  N                          Restore the Nth backup (newest=1) without
                             opening the interactive picker.

Flags:
  --target-db <name>         Restore into a different database (e.g.
                             postgres_restore_test) instead of the
                             default (\$PG_DB).
  --no-snapshot-first        Skip the automatic pre-restore snapshot.
                             Use ONLY when you have just taken one
                             yourself and want to save the few minutes.
  --yes                      Skip the destructive-action confirmation
                             prompt. Combine with N to restore non-
                             interactively (e.g. for unattended ops).
  --help, -h                 Show this help.

What it does (default):
  1. List every backup in s3://<R2_BUCKET>/ and let you pick one.
  2. Take a snapshot of the CURRENT DB state and upload it to
     s3://<R2_BUCKET>/manual/pre-restore-<TS>.dump.
  3. Download the chosen backup, copy it into the postgres container,
     run pg_restore --clean --if-exists.
  4. Clean up the temp file on host and inside the container.

After-restore:
  Restart the API container so it reconnects with the restored DB:
    hops app-restart api
`.trim();

interface ParsedArgs {
    readonly indexHint: number | null;
    readonly targetDb: string | null;
    readonly skipSnapshot: boolean;
    readonly skipConfirm: boolean;
}

function parseArgs(argv: ReadonlyArray<string>): ParsedArgs {
    const args = [...argv];
    let targetDb: string | null = null;
    const tdIdx = args.indexOf('--target-db');
    if (tdIdx >= 0) {
        const value = args[tdIdx + 1];
        if (!value) {
            die('--target-db requires a database name.');
        }
        targetDb = value;
    }

    const numericArg = args.find((a) => /^\d+$/.test(a));
    const indexHint = numericArg ? Number.parseInt(numericArg, 10) : null;

    return {
        indexHint,
        targetDb,
        skipSnapshot: args.includes('--no-snapshot-first'),
        skipConfirm: args.includes('--yes')
    };
}

function describeBackup(obj: R2Object): { readonly label: string; readonly hint: string } {
    const date = obj.lastModified ? obj.lastModified.toISOString().replace(/\.\d{3}Z$/, 'Z') : '?';
    const origin = obj.key.startsWith('manual/') ? 'manual' : 'daily';
    return {
        label: `${obj.key} (${humanSize(obj.size)})`,
        hint: `${date} · ${origin}`
    };
}

export async function dbRestore(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const parsed = parseArgs(argv);

    const container = await findContainer('postgres');
    const credentials = getDbCredentials(getActiveTarget());
    const user = credentials.user;
    const db = credentials.database;
    const targetDb = parsed.targetDb ?? db;

    const r2 = createR2Client(getActiveTarget());

    log.info(`Listing backups from s3://${r2.bucket}/...`);
    const all = await r2.list();

    // SPEC-103 T-080: accept both raw `.dump` and encrypted `.dump.gpg`
    // suffixes. Encrypted backups are decrypted in-process after
    // download (see gpgSymmetricDecrypt call below).
    const backups = [...all]
        .filter((o) => o.key.endsWith('.dump') || o.key.endsWith(`.dump${ENCRYPTED_SUFFIX}`))
        .sort((a, b) => {
            const at = a.lastModified?.getTime() ?? 0;
            const bt = b.lastModified?.getTime() ?? 0;
            return bt - at;
        });

    if (backups.length === 0) {
        die(`No .dump files found in s3://${r2.bucket}/. Nothing to restore.`);
    }

    let chosen: R2Object;
    if (parsed.indexHint !== null) {
        const direct = resolveNumberArg([String(parsed.indexHint)], backups);
        if (!direct) {
            die(
                `Index ${parsed.indexHint} is out of range. The list has ${backups.length} backup(s).`
            );
        }
        chosen = direct;
    } else {
        chosen = await pickOne(
            `Pick a backup to restore into '${targetDb}' (newest first)`,
            backups,
            describeBackup
        );
    }

    log.info(`Selected : ${chosen.key} (${humanSize(chosen.size)})`);
    log.info(`Container: ${container}`);
    log.info(`Target DB: ${targetDb}${targetDb !== db ? ' (override)' : ''}`);
    log.info(
        `Snapshot : ${parsed.skipSnapshot ? 'SKIPPED (--no-snapshot-first)' : 'ON (auto pre-restore)'}`
    );

    log.warn('THIS IS DESTRUCTIVE.');
    log.warn(`All current data in '${targetDb}' will be REPLACED with the contents of the backup.`);
    log.warn('Existing tables will be dropped and recreated.');

    if (!parsed.skipConfirm) {
        const ok = await confirm(`Type yes to PROCEED with restore into '${targetDb}'`, {
            defaultValue: false
        });
        if (!ok) {
            log.warn('Aborted.');
            return;
        }
    }

    const passphrase = get('BACKUP_PASSPHRASE');
    const passphraseAvailable = passphrase !== undefined && passphrase.length > 0;
    const chosenIsEncrypted = isEncryptedBackup(chosen.key);
    if (chosenIsEncrypted && !passphraseAvailable) {
        die(
            `The selected backup is encrypted (${chosen.key}) but BACKUP_PASSPHRASE is not set in scripts/server-tools/local secrets. Add it and retry.`
        );
    }

    // Pre-restore snapshot — happens BEFORE we touch the live DB so a
    // botched restore never leaves us empty-handed. Encrypted when the
    // passphrase is available (matches the daily cron's behaviour and
    // keeps every R2 object consistently encrypted).
    if (!parsed.skipSnapshot) {
        const ts = utcBackupTimestamp();
        const snapshotKey = passphraseAvailable
            ? `manual/pre-restore-${ts}.dump${ENCRYPTED_SUFFIX}`
            : `manual/pre-restore-${ts}.dump`;
        log.info(`Taking pre-restore snapshot to ${snapshotKey}...`);
        const dump = await pgDumpToBuffer({ container, user, db });
        if (dump.exitCode !== 0) {
            die(
                `Pre-restore snapshot pg_dump failed (exit ${dump.exitCode}): ${dump.stderr.trim()}. Refusing to proceed with destructive restore without a safety net. Re-run with --no-snapshot-first ONLY if you have a fresh manual backup.`
            );
        }
        let snapshotBuffer: Buffer = dump.stdout;
        if (passphraseAvailable && passphrase) {
            log.info('Encrypting pre-restore snapshot...');
            snapshotBuffer = await gpgSymmetricEncrypt(dump.stdout, passphrase);
        }
        await r2.putBuffer(snapshotKey, snapshotBuffer);
        log.ok(
            `Pre-restore snapshot uploaded: s3://${r2.bucket}/${snapshotKey} (${humanSize(snapshotBuffer.length)})`
        );
    }

    // Download chosen backup → decrypt (if needed) → local temp file →
    // docker cp into container.
    const localPath = join(tmpdir(), `hops-restore-${Date.now()}.dump`);
    const inContainerPath = `/tmp/hops-restore-${Date.now()}.dump`;

    log.info(`Downloading ${chosen.key} from R2...`);
    const downloaded = await r2.getBuffer(chosen.key);
    log.ok(`Downloaded ${humanSize(downloaded.length)}`);

    let body: Buffer = downloaded;
    if (chosenIsEncrypted && passphrase) {
        log.info('Decrypting backup with GPG...');
        body = await gpgSymmetricDecrypt(downloaded, passphrase);
        log.ok(`Decrypted: ${humanSize(body.length)} (${body.length} bytes).`);
    }
    await writeFile(localPath, body);
    log.ok(`Wrote ${humanSize(body.length)} to ${localPath}`);

    try {
        log.info(`Copying dump into ${container}:${inContainerPath}...`);
        const cp = await docker(['cp', localPath, `${container}:${inContainerPath}`]);
        if (cp.exitCode !== 0) {
            die(`docker cp failed: ${cp.stderr.trim() || cp.stdout.trim()}`);
        }

        log.info(`Running pg_restore (target=${targetDb})...`);
        const restore = await runInContainer({
            container,
            argv: [
                'pg_restore',
                '-U',
                user,
                '-d',
                targetDb,
                '--clean',
                '--if-exists',
                '--no-owner',
                '--no-privileges',
                inContainerPath
            ]
        });

        // pg_restore prints "errors ignored on restore: N" on stderr when
        // --clean drops objects that don't exist yet. That is expected
        // and not a failure — only treat non-zero exit as fatal.
        if (restore.stderr.trim().length > 0) {
            for (const line of restore.stderr.trim().split('\n')) {
                log.hint(line);
            }
        }
        if (restore.exitCode !== 0) {
            die(`pg_restore exited ${restore.exitCode}. Inspect the messages above.`);
        }
    } finally {
        // Best-effort cleanup. We swallow errors here because the
        // restore itself is what mattered.
        await unlink(localPath).catch(() => undefined);
        await runInContainer({
            container,
            argv: ['rm', '-f', inContainerPath]
        }).catch(() => undefined);
    }

    log.ok(`Restore completed: ${chosen.key} → ${targetDb}`);
    log.hint('Verify table counts: `hops db-counts`');
    log.hint('Restart the API so it reconnects with the restored DB: `hops app-restart api`');
}
