/**
 * `hops --target=staging r2-purge-foreign-backups [--delete]` (HOS-1957 G11).
 *
 * After the cutover rehearsal, delete from the STAGING bucket every object
 * that may carry prod data. `db-restore --from-target=prod` never copies
 * the prod backup into the staging bucket, so what is left to find is what
 * the staging bucket received while the staging database held prod data:
 * the pre-restore snapshots, `db-backup-now` (the 2b), the pre-migrate
 * backup of `db-migrate` and the daily cron. Those are bounded by the
 * foreign-data markers (`src/lib/foreign-data.ts`).
 *
 * Default mode only LISTS. `--delete` deletes after a typed confirmation
 * (the bucket name), and is refused while the window is still open: the
 * staging database would still be holding prod data and the next backup
 * would be written untracked once the markers are gone.
 *
 * Refused on `--target=prod`: prod never receives another target's data
 * (`db-restore` refuses any foreign bucket onto prod), and deleting prod
 * backups is never what this command is for.
 */

import { readdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getActiveTarget } from '../lib/container-lookup.ts';
import { classifyForeignObjects, FOREIGN_DATA_PREFIX, hasOpenWindow } from '../lib/foreign-data.ts';
import { die, log } from '../lib/log.ts';
import { promptText } from '../lib/prompt.ts';
import { createR2Client, humanSize } from '../lib/r2.ts';
import { RESTORE_TEMP_PREFIX } from '../lib/restore-plan.ts';
import { getR2Config, type Target } from '../lib/target.ts';

const HELP = `
hops --target=staging r2-purge-foreign-backups [--delete]

List (default) or delete the objects of the STAGING bucket written while
the staging database held prod data (HOS-1957, cutover rehearsal).

How they are found:
  \`db-restore --from-target=prod\` writes a data-free marker under
  ${FOREIGN_DATA_PREFIX} right before pg_restore, and restoring the
  pre-rehearsal staging backup into the main database writes a closing
  one. Every object written between the two is listed, whatever its name:
  pre-restore snapshots, db-backup-now, the db-migrate backup, the daily
  cron. The prod backup itself is never in the staging bucket.

Flags:
  --delete      Delete the listed objects, then the markers. Asks you to
                type the bucket name. Refused while the window is open
                (restore the pre-rehearsal backup first).
  --help, -h    Show this help.

Also checked: leftover ${RESTORE_TEMP_PREFIX}* temp files in the VPS temp dir
(a restore that died before its cleanup). Deleted with --delete.

Not covered (do by hand): scratch databases created by
\`db-restore --target-db\` inside the staging Postgres.

Refused on --target=prod.
`.trim();

/**
 * Refuse the targets this command must never run against.
 *
 * @returns an error message, or `undefined` when the target is allowed.
 */
export function purgeTargetRefusal(target: Target): string | undefined {
    if (target === 'prod') {
        return "r2-purge-foreign-backups is refused on --target=prod: prod never receives another target's data, and this command never deletes prod backups. Use --target=staging.";
    }
    return undefined;
}

/**
 * Refuse when the active bucket is the prod bucket (a copy-paste in the
 * local config would otherwise point the purge at prod backups).
 *
 * @returns an error message, or `undefined` when the buckets differ or the
 * prod bucket is not configured on this host.
 */
export function sameBucketRefusal(input: {
    readonly activeAccountId: string;
    readonly activeBucket: string;
    readonly prodAccountId: string | undefined;
    readonly prodBucket: string | undefined;
}): string | undefined {
    if (input.prodBucket === undefined) return undefined;
    if (input.prodBucket === input.activeBucket && input.prodAccountId === input.activeAccountId) {
        return `The staging bucket '${input.activeBucket}' is the same bucket as prod. Refusing to purge.`;
    }
    return undefined;
}

/** Whether the typed confirmation matches the bucket name exactly. */
export function isPurgeConfirmationValid(input: {
    readonly typed: string;
    readonly bucket: string;
}): boolean {
    return input.typed === input.bucket;
}

function prodBucketIfConfigured(): { accountId: string; bucket: string } | undefined {
    try {
        const prod = getR2Config('prod');
        return { accountId: prod.accountId, bucket: prod.bucket };
    } catch {
        return undefined;
    }
}

async function leftoverTempFiles(): Promise<ReadonlyArray<string>> {
    const dir = tmpdir();
    const names = await readdir(dir).catch(() => [] as string[]);
    return names.filter((n) => n.startsWith(RESTORE_TEMP_PREFIX)).map((n) => join(dir, n));
}

/**
 * Command entrypoint.
 *
 * @param argv - Command argv, with the command name and global `--target` stripped.
 */
export async function r2PurgeForeignBackups(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }
    const doDelete = argv.includes('--delete');

    const target = getActiveTarget();
    const refusal = purgeTargetRefusal(target);
    if (refusal !== undefined) die(refusal, 2);

    const active = getR2Config(target);
    const prod = prodBucketIfConfigured();
    const bucketRefusal = sameBucketRefusal({
        activeAccountId: active.accountId,
        activeBucket: active.bucket,
        prodAccountId: prod?.accountId,
        prodBucket: prod?.bucket
    });
    if (bucketRefusal !== undefined) die(bucketRefusal, 2);

    const r2 = createR2Client(target);
    log.info(`Listing s3://${r2.bucket}/...`);
    const result = classifyForeignObjects(await r2.list());
    const temps = await leftoverTempFiles();

    if (result.windows.length === 0) {
        log.ok(`No foreign-data markers under s3://${r2.bucket}/${FOREIGN_DATA_PREFIX}.`);
    }
    for (const w of result.windows) {
        log.info(
            `Window: ${w.start.toISOString()} → ${w.end === null ? 'STILL OPEN' : w.end.toISOString()}`
        );
    }
    for (const m of result.markers) {
        log.hint(`  marker  ${m.key}`);
    }
    for (const o of result.foreign) {
        process.stdout.write(
            `${o.key}\t${humanSize(o.size)}\t${o.lastModified?.toISOString() ?? '?'}\n`
        );
    }
    log.info(`${result.foreign.length} object(s) written inside the window(s).`);
    for (const o of result.undatable) {
        log.warn(`No lastModified, cannot place it in time — check by hand: ${o.key}`);
    }
    for (const t of temps) {
        log.warn(`Leftover restore temp file on this host: ${t}`);
    }

    const openDbs = [
        ...new Set(result.markers.filter((m) => m.kind === 'open').map((m) => m.targetDb))
    ];
    if (openDbs.length > 0) {
        log.hint(
            `Databases that received foreign data: ${openDbs.join(', ')}. Scratch databases among them are NOT dropped by this command.`
        );
    }

    if (!doDelete) {
        if (result.foreign.length + result.markers.length + temps.length > 0) {
            log.hint('List only. Re-run with --delete to remove them.');
        }
        return;
    }

    if (hasOpenWindow(result.windows)) {
        die(
            'The foreign-data window is still OPEN: the staging database still holds prod data. Restore the pre-rehearsal staging backup into the main database first (hops --target=staging db-restore --object <key>), then re-run.',
            2
        );
    }
    if (result.foreign.length + result.markers.length + temps.length === 0) {
        log.ok('Nothing to delete.');
        return;
    }

    log.warn(
        `About to DELETE ${result.foreign.length} object(s) and ${result.markers.length} marker(s) from s3://${r2.bucket}/, and ${temps.length} temp file(s).`
    );
    const typed = await promptText({
        message: `Type the bucket name '${r2.bucket}' to confirm`,
        placeholder: r2.bucket
    });
    if (!isPurgeConfirmationValid({ typed, bucket: r2.bucket })) {
        die('Aborted: typed confirmation did not match.', 1);
    }

    for (const o of result.foreign) {
        await r2.delete(o.key);
        log.ok(`Deleted ${o.key}`);
    }
    // Markers last: a run cut half-way leaves them in place, so a re-run
    // still finds whatever was not deleted yet.
    for (const m of result.markers) {
        await r2.delete(m.key);
        log.ok(`Deleted marker ${m.key}`);
    }
    for (const t of temps) {
        await unlink(t).catch((err: unknown) => {
            log.warn(`Could not delete ${t}: ${err instanceof Error ? err.message : String(err)}`);
        });
    }

    // Re-list and check the exact keys we deleted. Re-classifying would be
    // vacuous: with the markers gone there is no window left to fall in.
    const remaining = new Set((await r2.list()).map((o) => o.key));
    const survivors = [
        ...result.foreign.map((o) => o.key),
        ...result.markers.map((m) => m.key)
    ].filter((key) => remaining.has(key));
    if (survivors.length > 0) {
        die(`Verification failed, still listed: ${survivors.join(', ')}`);
    }
    log.ok(`Verified: no foreign-data objects or markers left in s3://${r2.bucket}/.`);
}
