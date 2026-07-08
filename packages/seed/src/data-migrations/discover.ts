/**
 * @fileoverview
 * Migration discovery + ledger-diff layer for the versioned seed data-migration
 * runner (HOS-25, T-008).
 *
 * Split into two deliberately separate concerns:
 *
 * - {@link discoverMigrationFiles} — I/O: scans the `data-migrations/`
 *   directory, dynamically `import()`s each `NNNN-slug.ts` module, and
 *   returns them sorted by their numeric prefix. This is the only function
 *   here that touches the filesystem or the module loader.
 * - {@link computePendingMigrations} — pure: diffs a discovered list against
 *   the ledger's applied-names set (from {@link getAppliedMigrations},
 *   T-004). No filesystem, no imports, no DB — trivially unit-testable with
 *   hand-built fixtures.
 *
 * The runner (T-009) is expected to call them in sequence:
 *
 * ```ts
 * const discovered = await discoverMigrationFiles({});
 * const { names: applied } = await getAppliedMigrations({ db });
 * const pending = computePendingMigrations({ discovered, applied, group });
 * ```
 *
 * @see .specs/HOS-25-versioned-seed-data-migrations/spec.md §3.1, §6
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { SeedMigrationGroup, SeedMigrationMeta, SeedMigrationModule } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * The real `data-migrations/` directory, resolved relative to this file
 * (rather than `process.cwd()`) so discovery works the same regardless of
 * where the caller (CLI, cron, test) was invoked from.
 */
const DEFAULT_MIGRATIONS_DIR = __dirname;

/**
 * Filename convention every data-migration module must follow: a 4-digit
 * numeric prefix, a hyphen, a non-empty slug, and a `.ts`/`.js` extension.
 *
 * Anything else present in `data-migrations/` (the shared infrastructure
 * files — `types.ts`, `ledger.ts`, `discover.ts`, `runner.ts`, `context.ts`,
 * `prodGate.ts` — and the `helpers/` subdirectory) is excluded by this
 * pattern, not by an explicit denylist: it is the robust rule requested by
 * the task, and it also means a new infra file added later doesn't need to
 * be added to an exclusion list here to stay excluded.
 */
const MIGRATION_FILENAME_PATTERN = /^(\d{4})-.+\.(?:ts|js)$/;

/**
 * A single data-migration module resolved and loaded from disk, with its
 * identity metadata surfaced alongside the loaded module for convenience.
 */
export interface DiscoveredMigration {
    /**
     * The migration's stable identity: the filename stem (no extension),
     * matching `meta.name`. See {@link SeedMigrationMeta.name}.
     */
    readonly name: string;

    /** The migration's numeric ordering prefix (e.g. `3` for `'0003-...'`). */
    readonly numericPrefix: number;

    /** Absolute path to the migration's source file on disk. */
    readonly filePath: string;

    /** The migration's static metadata (mirrors `module.meta`). */
    readonly meta: SeedMigrationMeta;

    /** The fully loaded module (`{ meta, up }`). */
    readonly module: SeedMigrationModule;
}

/**
 * Narrows an unknown value to a structurally-valid {@link SeedMigrationMeta}
 * without resorting to `any`. Only checks the fields discovery itself relies
 * on (`name`, `group`) — deeper validation of `SeedMigrationGroup`'s exact
 * union values is left to callers/tests, since a malformed `group` would
 * still surface clearly wherever it's consumed.
 */
function isSeedMigrationMeta(value: unknown): value is SeedMigrationMeta {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const candidate = value as Record<string, unknown>;
    return typeof candidate.name === 'string' && typeof candidate.group === 'string';
}

/**
 * Scans a directory of `NNNN-slug.ts`/`.js` data-migration modules, loads
 * each one via dynamic `import()`, and returns them sorted by their numeric
 * prefix ascending.
 *
 * Validates as it goes:
 * - Every candidate filename's numeric prefix must be unique across the
 *   directory (duplicate prefixes make ordering ambiguous and are rejected
 *   before any file is imported).
 * - Every loaded module must export a structurally-valid `meta` object and
 *   an `up` function (see {@link SeedMigrationModule}).
 * - `meta.name` must match the filename stem exactly — throwing (rather
 *   than warning) is the safer choice here, since a mismatch means the
 *   ledger's recorded identity (`meta.name`) would silently diverge from
 *   the on-disk file it came from, which is exactly the kind of drift the
 *   ledger's checksum/name pairing exists to prevent.
 *
 * @param args - RO-RO input.
 * @param args.dir - Directory to scan. Defaults to the real
 *   `data-migrations/` directory this module lives in; tests pass a fixture
 *   directory instead.
 * @returns Discovered migrations, sorted by `numericPrefix` ascending.
 *
 * @throws {Error} If two files share the same numeric prefix.
 * @throws {Error} If a loaded module is missing `meta` or `up`.
 * @throws {Error} If a module's `meta.name` doesn't match its filename stem.
 *
 * @example
 * ```ts
 * const discovered = await discoverMigrationFiles({});
 * // [{ name: '0001-add-wifi-amenity', numericPrefix: 1, ... }, ...]
 * ```
 */
export async function discoverMigrationFiles(
    args: { readonly dir?: string } = {}
): Promise<DiscoveredMigration[]> {
    const dir = args.dir ?? DEFAULT_MIGRATIONS_DIR;

    const entries = await readdir(dir, { withFileTypes: true });

    const candidates = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((fileName) => MIGRATION_FILENAME_PATTERN.test(fileName))
        .map((fileName) => {
            const match = fileName.match(MIGRATION_FILENAME_PATTERN);
            const prefixGroup = match?.[1];
            if (!prefixGroup) {
                // Unreachable: fileName already passed MIGRATION_FILENAME_PATTERN.test().
                throw new Error(`Failed to parse numeric prefix from '${fileName}'.`);
            }
            return { fileName, numericPrefix: Number(prefixGroup) };
        });

    const prefixToFileName = new Map<number, string>();
    for (const { fileName, numericPrefix } of candidates) {
        const existing = prefixToFileName.get(numericPrefix);
        if (existing) {
            throw new Error(
                `Duplicate data-migration numeric prefix ${numericPrefix}: both '${existing}' and '${fileName}' claim it. Each migration must have a unique NNNN prefix.`
            );
        }
        prefixToFileName.set(numericPrefix, fileName);
    }

    const discovered: DiscoveredMigration[] = [];

    for (const { fileName, numericPrefix } of candidates) {
        const filePath = path.join(dir, fileName);
        const imported = (await import(pathToFileURL(filePath).href)) as Record<string, unknown>;

        if (!isSeedMigrationMeta(imported.meta) || typeof imported.up !== 'function') {
            throw new Error(
                `Data-migration file '${fileName}' does not export a valid SeedMigrationModule (expected 'meta' and 'up' exports).`
            );
        }

        const meta = imported.meta;
        const up = imported.up as SeedMigrationModule['up'];
        const stem = fileName.replace(/\.(?:ts|js)$/, '');

        if (meta.name !== stem) {
            throw new Error(
                `Data-migration '${fileName}' exports meta.name = '${meta.name}', which does not match its filename stem '${stem}'. Rename the file or fix meta.name so they match.`
            );
        }

        discovered.push({
            name: meta.name,
            numericPrefix,
            filePath,
            meta,
            module: { meta, up }
        });
    }

    return discovered.sort((a, b) => a.numericPrefix - b.numericPrefix);
}

/**
 * Pure diff between a list of discovered migrations and the ledger's applied
 * names, optionally scoped to a single group. Never touches the filesystem
 * or a database — safe to unit-test with hand-built {@link DiscoveredMigration}
 * fixtures.
 *
 * Assumes `args.discovered` is already ordered by numeric prefix ascending
 * (the contract {@link discoverMigrationFiles} guarantees) and preserves that
 * relative order in the returned array; it does not re-sort.
 *
 * @param args - RO-RO input.
 * @param args.discovered - Migrations found on disk, in numeric-prefix order.
 * @param args.applied - Migration names already recorded in the ledger. See
 *   {@link getAppliedMigrations} (T-004, `ledger.ts`).
 * @param args.group - When provided, only migrations in this group are
 *   returned (e.g. run `'required'` in production, both groups in dev).
 * @returns The subset of `discovered` not yet applied (and matching `group`
 *   when given), in the same relative order as `discovered`.
 *
 * @example
 * ```ts
 * const pending = computePendingMigrations({
 *   discovered,
 *   applied: new Set(['0001-add-wifi-amenity']),
 *   group: 'required',
 * });
 * ```
 */
export function computePendingMigrations(args: {
    readonly discovered: readonly DiscoveredMigration[];
    readonly applied: ReadonlySet<string>;
    readonly group?: SeedMigrationGroup;
}): DiscoveredMigration[] {
    const { discovered, applied, group } = args;

    return discovered.filter(
        (migration) =>
            !applied.has(migration.name) && (group === undefined || migration.meta.group === group)
    );
}
