/**
 * `hops db-restore [N | --object <key>] [--from-target <env>] [--target-db <name>]
 *                  [--no-snapshot-first] [--yes]`
 *
 * Pick a backup from R2 and restore it into the live Postgres
 * container. DESTRUCTIVE — replaces every object in the target
 * database.
 *
 * Safety net (default ON, opt out with --no-snapshot-first): take a
 * fresh pg_dump snapshot of the database about to be replaced and upload
 * it to `manual/pre-restore-<TS>.dump` of the ACTIVE target's bucket
 * BEFORE running pg_restore. If the chosen backup turns out to be corrupt
 * or a wrong choice, the pre-restore snapshot is the get-out-of-jail card.
 *
 * HOS-1957 additions (cutover rehearsal):
 * - `--from-target=prod` on `--target=staging` lists and downloads from
 *   the PROD bucket and restores into the STAGING Postgres. The backup is
 *   never copied into the staging bucket: it goes to a temp file on the
 *   VPS that is deleted after pg_restore. The reverse (any other bucket
 *   onto prod) is refused before anything runs.
 * - `--object <key>` selects a backup by its exact name.
 * - `--target-db <scratch>` creates the scratch database when missing,
 *   and refuses the target's main database.
 * - Foreign-data markers (`src/lib/foreign-data.ts`) record when the
 *   staging database starts and stops holding prod data, so
 *   `hops r2-purge-foreign-backups` can find every backup written in
 *   between.
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
    buildCloseMarkerKey,
    buildOpenMarkerKey,
    computeWindows,
    FOREIGN_DATA_PREFIX,
    type ForeignDataWindow,
    parseMarkers,
    restoreClosesWindow
} from '../lib/foreign-data.ts';
import {
    ENCRYPTED_SUFFIX,
    gpgSymmetricDecrypt,
    gpgSymmetricEncrypt,
    isEncryptedBackup
} from '../lib/gpg.ts';
import { die, log } from '../lib/log.ts';
import { pgDumpToBuffer } from '../lib/postgres.ts';
import { confirm, pickOne, resolveNumberArg } from '../lib/prompt.ts';
import {
    createR2Client,
    humanSize,
    type R2Client,
    type R2Object,
    utcBackupTimestamp
} from '../lib/r2.ts';
import {
    buildCreateDatabaseSql,
    buildDatabaseExistsSql,
    parseRestoreArgs,
    RESTORE_TEMP_PREFIX,
    type RestoreArgs,
    type RestoreSource,
    resolveRestoreSource,
    selectBackup,
    validateScratchDbName
} from '../lib/restore-plan.ts';
import { getDbCredentials } from '../lib/target.ts';

const HELP = `
hops db-restore [N | --object <key>] [--from-target <env>] [--target-db <name>]
                [--no-snapshot-first] [--yes]

Restore the Postgres database from a backup stored in R2.

Arguments:
  N                          Restore the Nth backup (newest=1) without
                             opening the interactive picker.

Flags:
  --object <key>             Restore the backup with this EXACT bucket key
                             (e.g. manual/hospeda-postgres-<TS>.dump.gpg).
                             Preferred over N in runbooks: the index
                             shifts every time a backup is written.
  --from-target <env>        Read the backup from another target's bucket.
                             Only prod -> staging is allowed:
                               hops --target=staging db-restore --from-target=prod
                             Any other bucket onto --target=prod is refused.
                             The backup is never copied into the staging
                             bucket (temp file on the VPS, deleted after).
  --target-db <name>         Restore into a scratch database (e.g.
                             postgres_restore_test) instead of the main
                             one. Created when missing. Refused when it
                             names the target's main database or a
                             Postgres system database.
  --no-snapshot-first        Skip the automatic pre-restore snapshot.
                             Use ONLY when you have just taken one
                             yourself and want to save the few minutes.
  --yes                      Skip the destructive-action confirmation
                             prompt. Combine with N / --object to restore
                             non-interactively (e.g. for unattended ops).
  --help, -h                 Show this help.

What it does (default):
  1. List every backup in the source bucket and let you pick one.
  2. Take a snapshot of the database about to be replaced and upload it
     to manual/pre-restore-<TS>.dump of the ACTIVE target's bucket.
  3. Download the chosen backup, copy it into the postgres container,
     run pg_restore --clean --if-exists.
  4. Clean up the temp file on host and inside the container.

Prod data on staging (--from-target=prod):
  The restore writes a data-free marker under ${FOREIGN_DATA_PREFIX} of the
  staging bucket. From then on every backup the staging bucket receives
  carries prod data; restoring the pre-rehearsal staging backup into the
  main database closes the window. List / delete what was written in
  between with:
    hops --target=staging r2-purge-foreign-backups

After-restore:
  Restart the API container so it reconnects with the restored DB:
    hops app-restart api
`.trim();

function describeBackup(obj: R2Object): { readonly label: string; readonly hint: string } {
    const date = obj.lastModified ? obj.lastModified.toISOString().replace(/\.\d{3}Z$/, 'Z') : '?';
    const origin = obj.key.startsWith('manual/') ? 'manual' : 'daily';
    return {
        label: `${obj.key} (${humanSize(obj.size)})`,
        hint: `${date} · ${origin}`
    };
}

/** Run one psql statement inside the container. */
async function psqlInContainer(input: {
    readonly container: string;
    readonly user: string;
    readonly db: string;
    readonly sql: string;
}): Promise<{ readonly stdout: string; readonly stderr: string; readonly exitCode: number }> {
    const result = await runInContainer({
        container: input.container,
        argv: ['psql', '-U', input.user, '-d', input.db, '-v', 'ON_ERROR_STOP=1', '-tAc', input.sql]
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode ?? 1 };
}

/**
 * Whether the scratch database exists. Probed through the main database,
 * which always exists on a provisioned target.
 */
async function databaseExists(input: {
    readonly container: string;
    readonly user: string;
    readonly mainDb: string;
    readonly name: string;
}): Promise<boolean> {
    const probe = await psqlInContainer({
        container: input.container,
        user: input.user,
        db: input.mainDb,
        sql: buildDatabaseExistsSql({ name: input.name })
    });
    if (probe.exitCode !== 0) {
        die(`Could not check whether '${input.name}' exists: ${probe.stderr.trim()}`);
    }
    return probe.stdout.trim() === '1';
}

/**
 * Parse argv and resolve every decision that can refuse the run, before
 * any container, bucket or database is touched.
 */
function planOrDie(argv: ReadonlyArray<string>): {
    readonly parsed: RestoreArgs;
    readonly source: RestoreSource;
} {
    try {
        const parsed = parseRestoreArgs(argv);
        const source = resolveRestoreSource({
            activeTarget: getActiveTarget(),
            fromTarget: parsed.fromTarget
        });
        if (parsed.targetDb !== null) {
            validateScratchDbName({
                name: parsed.targetDb,
                mainDatabase: getDbCredentials(getActiveTarget()).database
            });
        }
        return { parsed, source };
    } catch (err) {
        die(err instanceof Error ? err.message : String(err), 2);
    }
}

/** Upload a small data-free JSON marker. */
async function putMarker(r2: R2Client, key: string, payload: object): Promise<void> {
    await r2.putBuffer(key, Buffer.from(`${JSON.stringify(payload)}\n`), 'application/json');
}

export async function dbRestore(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    // Refusals first: nothing below runs for a refused plan.
    const { parsed, source } = planOrDie(argv);
    const activeTarget = getActiveTarget();

    const container = await findContainer('postgres');
    const credentials = getDbCredentials(activeTarget);
    const user = credentials.user;
    const db = credentials.database;
    const targetDb = parsed.targetDb ?? db;
    const intoMainDatabase = targetDb === db;

    // `r2` is the ACTIVE target's bucket: snapshots and markers go there.
    // `sourceR2` is where the backup is read from (the prod bucket on a
    // cross-target restore, the same client otherwise).
    const r2 = createR2Client(activeTarget);
    const sourceR2 = source.crossTarget ? createR2Client(source.sourceTarget) : r2;
    if (source.crossTarget && sourceR2.bucket === r2.bucket) {
        die(
            `--from-target=${source.sourceTarget} resolves to the same bucket as ${activeTarget} ('${r2.bucket}'). Fix the R2 bucket values in the hops local config.`
        );
    }

    log.info(`Listing backups from s3://${sourceR2.bucket}/...`);
    const all = await sourceR2.list();

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
        die(`No .dump files found in s3://${sourceR2.bucket}/. Nothing to restore.`);
    }

    let byName: R2Object | null = null;
    try {
        byName = selectBackup({ backups, objectKey: parsed.objectKey });
    } catch (err) {
        die(err instanceof Error ? err.message : String(err), 2);
    }
    let chosen: R2Object;
    if (byName !== null) {
        chosen = byName;
    } else if (parsed.indexHint === null) {
        chosen = await pickOne(
            `Pick a backup to restore into '${targetDb}' (newest first)`,
            backups,
            describeBackup
        );
    } else {
        const direct = resolveNumberArg([String(parsed.indexHint)], backups);
        if (!direct) {
            die(
                `Index ${parsed.indexHint} is out of range. The list has ${backups.length} backup(s).`
            );
        }
        chosen = direct;
    }

    // Foreign-data windows only ever exist in the staging bucket (prod is
    // never restored from another bucket), so prod skips this listing.
    let windows: ReadonlyArray<ForeignDataWindow> = [];
    if (activeTarget !== 'prod') {
        windows = computeWindows(parseMarkers(await r2.list(FOREIGN_DATA_PREFIX)));
    }
    const closesWindow = restoreClosesWindow({
        windows,
        crossTarget: source.crossTarget,
        intoMainDatabase,
        chosen
    });

    const scratchExists = intoMainDatabase
        ? true
        : await databaseExists({ container, user, mainDb: db, name: targetDb });
    const takeSnapshot = !parsed.skipSnapshot && scratchExists;

    log.info(`Source   : s3://${sourceR2.bucket}/ (${source.sourceTarget})`);
    log.info(`Selected : ${chosen.key} (${humanSize(chosen.size)})`);
    log.info(`Container: ${container} (${activeTarget})`);
    log.info(
        `Target DB: ${targetDb}${intoMainDatabase ? '' : ` (scratch${scratchExists ? '' : ', will be CREATED'})`}`
    );
    log.info(
        `Snapshot : ${
            parsed.skipSnapshot
                ? 'SKIPPED (--no-snapshot-first)'
                : takeSnapshot
                  ? `ON (auto pre-restore, to s3://${r2.bucket}/manual/)`
                  : 'none (new database, nothing to keep)'
        }`
    );

    if (source.crossTarget) {
        log.warn(
            `CROSS-TARGET: ${source.sourceTarget.toUpperCase()} data will land in the ${activeTarget.toUpperCase()} database '${targetDb}'.`
        );
        log.warn(
            `Every backup s3://${r2.bucket}/ receives from now on carries ${source.sourceTarget} data. Clean up with: hops --target=${activeTarget} r2-purge-foreign-backups`
        );
    }
    if (closesWindow) {
        log.info(
            'This restore ends the foreign-data window (pre-rehearsal backup into the main DB).'
        );
    }
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

    if (!scratchExists) {
        log.info(`Creating scratch database '${targetDb}'...`);
        const created = await psqlInContainer({
            container,
            user,
            db,
            sql: buildCreateDatabaseSql({ name: targetDb })
        });
        if (created.exitCode !== 0) {
            die(`CREATE DATABASE '${targetDb}' failed: ${created.stderr.trim()}`);
        }
        log.ok(`Created database '${targetDb}'.`);
    }

    // Pre-restore snapshot — happens BEFORE we touch the database so a
    // botched restore never leaves us empty-handed. It dumps the database
    // being REPLACED (a freshly created scratch has nothing to keep).
    // Encrypted when the passphrase is available (matches the daily cron's
    // behaviour and keeps every R2 object consistently encrypted).
    if (takeSnapshot) {
        const ts = utcBackupTimestamp();
        const snapshotKey = passphraseAvailable
            ? `manual/pre-restore-${ts}.dump${ENCRYPTED_SUFFIX}`
            : `manual/pre-restore-${ts}.dump`;
        log.info(`Taking pre-restore snapshot to ${snapshotKey}...`);
        const dump = await pgDumpToBuffer({ container, user, db: targetDb });
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
    // docker cp into container. The temp file is the ONLY place a
    // cross-target backup is written outside the database; it is removed
    // in the `finally` below.
    const localPath = join(tmpdir(), `${RESTORE_TEMP_PREFIX}${Date.now()}.dump`);
    const inContainerPath = `/tmp/${RESTORE_TEMP_PREFIX}${Date.now()}.dump`;

    log.info(`Downloading ${chosen.key} from s3://${sourceR2.bucket}/...`);
    const downloaded = await sourceR2.getBuffer(chosen.key);
    log.ok(`Downloaded ${humanSize(downloaded.length)}`);

    let body: Buffer = downloaded;
    if (chosenIsEncrypted && passphrase) {
        log.info('Decrypting backup with GPG...');
        body = await gpgSymmetricDecrypt(downloaded, passphrase);
        log.ok(`Decrypted: ${humanSize(body.length)} (${body.length} bytes).`);
    }

    try {
        await writeFile(localPath, body, { mode: 0o600 });
        log.ok(`Wrote ${humanSize(body.length)} to ${localPath}`);

        log.info(`Copying dump into ${container}:${inContainerPath}...`);
        const cp = await docker(['cp', localPath, `${container}:${inContainerPath}`]);
        if (cp.exitCode !== 0) {
            die(`docker cp failed: ${cp.stderr.trim() || cp.stdout.trim()}`);
        }

        // Open the window BEFORE pg_restore: a restore that fails half-way
        // still leaves foreign rows behind.
        if (source.crossTarget) {
            const markerKey = buildOpenMarkerKey({
                timestamp: utcBackupTimestamp(),
                sourceTarget: source.sourceTarget,
                targetDb
            });
            await putMarker(r2, markerKey, {
                source: source.sourceTarget,
                object: chosen.key,
                targetDb
            });
            log.ok(`Foreign-data window opened: s3://${r2.bucket}/${markerKey}`);
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
        // restore itself is what mattered. A `die()` above exits the
        // process without running this block, which is why
        // `r2-purge-foreign-backups` also looks for leftover temp files.
        await unlink(localPath).catch(() => undefined);
        await runInContainer({
            container,
            argv: ['rm', '-f', inContainerPath]
        }).catch(() => undefined);
    }

    if (closesWindow) {
        const closeKey = buildCloseMarkerKey({ timestamp: utcBackupTimestamp(), targetDb });
        await putMarker(r2, closeKey, { object: chosen.key, targetDb });
        log.ok(`Foreign-data window closed: s3://${r2.bucket}/${closeKey}`);
        log.hint(`Delete what it covered: hops --target=${activeTarget} r2-purge-foreign-backups`);
    }

    log.ok(`Restore completed: ${chosen.key} → ${targetDb}`);
    log.hint('Verify table counts: `hops db-counts`');
    log.hint('Restart the API so it reconnects with the restored DB: `hops app-restart api`');
}
