/**
 * Pure decisions behind `hops db-restore` (HOS-1957 G1 / G15).
 *
 * Everything here runs BEFORE the command lists a bucket, downloads a
 * backup, takes a snapshot or creates a database, so a refusal leaves no
 * trace anywhere. Keeping it free of I/O is what lets the refusals be
 * unit-tested without a VPS.
 *
 * - {@link parseRestoreArgs}       argv → typed options.
 * - {@link resolveRestoreSource}   which target's BUCKET the backup is read
 *                                  from. The reverse of the cutover
 *                                  rehearsal (any other bucket onto prod) is
 *                                  refused here.
 * - {@link validateScratchDbName}  `--target-db` guard: strict identifier,
 *                                  never the app's own database.
 * - {@link selectBackup}           exact-name selection (`--object`).
 */

import type { R2Object } from './r2.ts';
import { isValidTarget, type Target } from './target.ts';

/**
 * Name prefix of the temp file a restore writes on the VPS host (and inside
 * the postgres container). `r2-purge-foreign-backups` looks for leftovers
 * of a restore that died before its cleanup ran.
 */
export const RESTORE_TEMP_PREFIX = 'hops-restore-';

/** Options `hops db-restore` reads from its argv. */
export interface RestoreArgs {
    /** 1-based index into the newest-first listing, or `null`. */
    readonly indexHint: number | null;
    /** Exact bucket key to restore (`--object`), or `null`. */
    readonly objectKey: string | null;
    /** `--target-db` override, or `null` for the target's main database. */
    readonly targetDb: string | null;
    /** Raw `--from-target` value (validated later), or `null`. */
    readonly fromTarget: string | null;
    /** `--no-snapshot-first`. */
    readonly skipSnapshot: boolean;
    /** `--yes`. */
    readonly skipConfirm: boolean;
}

const VALUE_FLAGS = ['--target-db', '--object', '--from-target'] as const;
type ValueFlag = (typeof VALUE_FLAGS)[number];

/**
 * Parse `hops db-restore` argv. Value flags accept both `--flag value` and
 * `--flag=value`. A bare numeric token that is not a flag's value is the
 * index hint.
 *
 * @throws when a value flag has no value, or when both N and `--object`
 * are given (two selectors that could disagree).
 */
export function parseRestoreArgs(argv: ReadonlyArray<string>): RestoreArgs {
    const values: Partial<Record<ValueFlag, string>> = {};
    const positionals: string[] = [];

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === undefined) continue;
        const eq = VALUE_FLAGS.find((flag) => token.startsWith(`${flag}=`));
        if (eq) {
            const value = token.slice(eq.length + 1);
            if (value.length === 0) throw new Error(`${eq} requires a value.`);
            values[eq] = value;
            continue;
        }
        const spaced = VALUE_FLAGS.find((flag) => token === flag);
        if (spaced) {
            const value = argv[i + 1];
            if (value === undefined || value.length === 0 || value.startsWith('--')) {
                throw new Error(`${spaced} requires a value.`);
            }
            values[spaced] = value;
            i += 1;
            continue;
        }
        if (!token.startsWith('-')) positionals.push(token);
    }

    const numeric = positionals.find((p) => /^\d+$/.test(p));
    const indexHint = numeric ? Number.parseInt(numeric, 10) : null;
    const objectKey = values['--object'] ?? null;
    if (indexHint !== null && objectKey !== null) {
        throw new Error('Pass either N or --object <key>, not both.');
    }

    return {
        indexHint,
        objectKey,
        targetDb: values['--target-db'] ?? null,
        fromTarget: values['--from-target'] ?? null,
        skipSnapshot: argv.includes('--no-snapshot-first'),
        skipConfirm: argv.includes('--yes')
    };
}

/** Where the backup is read from, relative to the target being restored. */
export interface RestoreSource {
    /** Target whose R2 bucket is listed and downloaded from. */
    readonly sourceTarget: Target;
    /** `true` when the bucket belongs to a different target than the DB. */
    readonly crossTarget: boolean;
}

/**
 * Resolve the source bucket of a restore.
 *
 * Without `--from-target` the source is the active target (today's
 * behaviour, unchanged). With it, the only cross-target direction allowed
 * is a prod backup into STAGING — the cutover rehearsal. Anything else
 * onto prod is refused: prod is only ever restored from its own bucket.
 *
 * @throws on an invalid value or on any foreign source onto prod.
 */
export function resolveRestoreSource(input: {
    readonly activeTarget: Target;
    readonly fromTarget: string | null;
}): RestoreSource {
    if (input.fromTarget === null) {
        return { sourceTarget: input.activeTarget, crossTarget: false };
    }
    if (!isValidTarget(input.fromTarget)) {
        throw new Error(
            `Invalid --from-target value '${input.fromTarget}'. Valid: prod | staging.`
        );
    }
    const source = input.fromTarget;
    if (input.activeTarget === 'prod' && source !== 'prod') {
        throw new Error(
            `Refusing to restore a ${source} backup onto prod. Prod is only restored from its own bucket; drop --from-target.`
        );
    }
    return { sourceTarget: source, crossTarget: source !== input.activeTarget };
}

/**
 * Postgres identifier accepted for a scratch database: lower-case ASCII
 * letter or underscore first, then letters/digits/underscores, 63 chars max
 * (NAMEDATALEN - 1). Strict on purpose — the name is interpolated into a
 * quoted identifier and a string literal.
 */
const SCRATCH_DB_NAME = /^[a-z_][a-z0-9_]{0,62}$/;

/** Databases a scratch restore must never touch. */
const RESERVED_DATABASES: ReadonlyArray<string> = ['postgres', 'template0', 'template1'];

function assertIdentifier(name: string): void {
    if (!SCRATCH_DB_NAME.test(name)) {
        throw new Error(
            `Invalid --target-db '${name}'. Use lower-case letters, digits and underscores, starting with a letter or underscore, at most 63 characters.`
        );
    }
}

/**
 * Validate a `--target-db` name. The scratch database may be created by
 * the restore, so it may never be the target's main database (that one is
 * restored by omitting `--target-db`) nor a Postgres system database.
 *
 * @returns the validated name.
 * @throws on a malformed, reserved or main-database name.
 */
export function validateScratchDbName(input: {
    readonly name: string;
    readonly mainDatabase: string;
}): string {
    if (input.name === input.mainDatabase) {
        throw new Error(
            `--target-db '${input.name}' is the target's main database. Omit --target-db to restore it; --target-db is only for a scratch database.`
        );
    }
    assertIdentifier(input.name);
    if (RESERVED_DATABASES.includes(input.name)) {
        throw new Error(`--target-db '${input.name}' is a reserved Postgres database.`);
    }
    return input.name;
}

/** `SELECT` that returns one row when the database exists. */
export function buildDatabaseExistsSql(input: { readonly name: string }): string {
    assertIdentifier(input.name);
    return `SELECT 1 FROM pg_database WHERE datname = '${input.name}'`;
}

/** `CREATE DATABASE` with a quoted identifier. */
export function buildCreateDatabaseSql(input: { readonly name: string }): string {
    assertIdentifier(input.name);
    return `CREATE DATABASE "${input.name}"`;
}

/**
 * Pick a backup by exact key. Returns `null` when no key was given, so the
 * caller falls back to N or the interactive picker.
 *
 * @throws when the key is not in the listing — never a prefix or partial
 * match, because the runbook picks the cutover backup by its exact name.
 */
export function selectBackup(input: {
    readonly backups: ReadonlyArray<R2Object>;
    readonly objectKey: string | null;
}): R2Object | null {
    if (input.objectKey === null) return null;
    const found = input.backups.find((b) => b.key === input.objectKey);
    if (!found) {
        throw new Error(
            `Object '${input.objectKey}' not found among the ${input.backups.length} backup(s) listed. Names must match exactly (including the .dump / .dump.gpg suffix and any manual/ prefix).`
        );
    }
    return found;
}
