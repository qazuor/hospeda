/**
 * @fileoverview
 * Scaffold generator for versioned seed data-migrations (HOS-25, T-013).
 *
 * {@link makeMigration} computes the next available `NNNN` numeric prefix by
 * scanning the target directory for existing `NNNN-slug.ts` files (same
 * convention enforced by {@link discoverMigrationFiles}, T-008), then writes a
 * new `NNNN-<slug>.ts` file from a small in-source template whose `meta.name`
 * is guaranteed to equal the emitted filename's stem — the exact invariant
 * discovery validates at scan time.
 *
 * This module only writes files; it does not run, discover, or apply
 * migrations. See `discover.ts` (T-008) and `runner.ts` (T-009) for those
 * concerns.
 *
 * @see .specs/HOS-25-versioned-seed-data-migrations/spec.md
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SeedMigrationGroup } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * The real `data-migrations/` directory, resolved relative to this file
 * (rather than `process.cwd()`), matching the idiom `discover.ts` uses so the
 * generator scaffolds into the same place discovery scans regardless of
 * where the caller (CLI, test) was invoked from.
 */
const DEFAULT_MIGRATIONS_DIR = __dirname;

/**
 * Numeric-prefix convention shared with {@link discoverMigrationFiles}: a
 * leading 4-digit prefix, a hyphen, then anything, ending in `.ts`. Used here
 * only to find the current max prefix in the target directory — not to
 * validate arbitrary filenames.
 */
const NUMBERED_TS_FILENAME_PATTERN = /^(\d{4})-.+\.ts$/;

/**
 * Validation pattern for a migration slug: lowercase kebab-case, starting
 * with a letter (so it can never itself look like — or be confused with — a
 * numeric `NNNN` prefix), letters/digits/hyphens only, no leading/trailing/
 * double hyphens.
 */
const SLUG_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * RO-RO input for {@link makeMigration}.
 */
export interface MakeMigrationArgs {
    /**
     * The migration's slug (the part after the `NNNN-` prefix), e.g.
     * `'remove-legacy-feature'`. Only lowercase letters, digits, and single
     * hyphens are accepted — see {@link SLUG_PATTERN}. The only normalization
     * applied is trimming surrounding whitespace and lowercasing; anything
     * still invalid after that (spaces, uppercase, a `.ts` suffix, leading
     * digits, empty string, double/leading/trailing hyphens) throws rather
     * than being silently rewritten.
     */
    readonly slug: string;

    /**
     * Which data track the scaffolded migration targets. See
     * {@link SeedMigrationGroup}.
     *
     * @default 'required'
     */
    readonly group?: SeedMigrationGroup;

    /**
     * Whether to scaffold the migration as destructive (see
     * `SeedMigrationMeta.destructive`). Emitted as a literal `true`/`false` in
     * the generated `meta` object either way, so the author sees the field
     * and its meaning even when accepting the default.
     *
     * @default false
     */
    readonly destructive?: boolean;

    /**
     * Directory to scaffold into and scan for existing numeric prefixes.
     * Defaults to the real `data-migrations/` directory this module lives
     * in; tests pass a temp fixture directory instead.
     */
    readonly dir?: string;
}

/**
 * Result of a successful {@link makeMigration} call.
 */
export interface MakeMigrationResult {
    /** Absolute path to the newly written migration file. */
    readonly filePath: string;

    /** The migration's identity: the filename stem (matches `meta.name`). */
    readonly name: string;
}

/**
 * Validates and normalizes a raw slug string.
 *
 * Normalization is intentionally minimal: trims whitespace and lowercases.
 * Anything still not matching {@link SLUG_PATTERN} afterward is rejected with
 * a descriptive error rather than being further rewritten (e.g. stripping
 * spaces or a `.ts` suffix) — the caller should pass a slug that is already
 * close to correct, not rely on this function to fix it up.
 *
 * @throws {Error} If the normalized slug is empty or does not match
 *   {@link SLUG_PATTERN}.
 */
function normalizeSlug(rawSlug: string): string {
    const normalized = rawSlug.trim().toLowerCase();

    if (normalized.length === 0) {
        throw new Error('Data-migration slug must not be empty.');
    }

    if (!SLUG_PATTERN.test(normalized)) {
        throw new Error(
            `Invalid data-migration slug '${rawSlug}'. Slugs must be lowercase kebab-case, ` +
                "starting with a letter, using only letters/digits/hyphens (e.g. 'remove-legacy-feature'). " +
                'No spaces, uppercase letters, file extensions, or leading/trailing/double hyphens.'
        );
    }

    return normalized;
}

/**
 * Scans `dir` for existing `NNNN-slug.ts` files and returns the highest
 * numeric prefix found, or `0` if none exist.
 *
 * Mirrors the same filename convention {@link discoverMigrationFiles} scans
 * for, but only needs the numeric prefixes (not the loaded modules) since
 * this function never imports anything.
 */
async function findMaxNumericPrefix(dir: string): Promise<number> {
    const entries = await readdir(dir, { withFileTypes: true });

    let max = 0;
    for (const entry of entries) {
        if (!entry.isFile()) {
            continue;
        }

        const match = entry.name.match(NUMBERED_TS_FILENAME_PATTERN);
        const prefixGroup = match?.[1];
        if (!prefixGroup) {
            continue;
        }

        const numericPrefix = Number(prefixGroup);
        if (numericPrefix > max) {
            max = numericPrefix;
        }
    }

    return max;
}

/**
 * Builds the source text for a freshly scaffolded migration module.
 *
 * The emitted module is designed to compile as-is (empty-but-valid `up`) and
 * to pass discovery's `meta.name === filename stem` check by construction,
 * since `name` is generated from the same `name` string used for the file
 * stem.
 */
function buildMigrationSource(args: {
    readonly name: string;
    readonly group: SeedMigrationGroup;
    readonly destructive: boolean;
}): string {
    const { name, group, destructive } = args;

    return `/**
 * @fileoverview
 * Data migration: ${name}
 *
 * TODO: describe what this migration does and why.
 *
 * Reminder: when this migration changes canonical seed data, also update the
 * corresponding baseline seed fixture (the JSON files under
 * \`src/data/**\`) so a fresh \`db:fresh\` / \`db:fresh-dev\` produces the same
 * end state as running this migration against an existing database. See
 * .specs/HOS-25-versioned-seed-data-migrations/spec.md for the dual-write
 * convention.
 */
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '${name}',
    group: '${group}',
    destructive: ${String(destructive)}
} as const satisfies SeedMigrationModule['meta'];

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    // Use ctx.db for direct Drizzle queries, ctx.models.<XModel> for model-level
    // access, ctx.services.<XService> for permission-checked writes via
    // \`ctx.actor\`, and ctx.helpers.safeDelete({ table, where, reason }) for any
    // hard delete (it guards against active FK references and operator-edited
    // rows instead of a raw DELETE).
    //
    // Example:
    // await ctx.helpers.safeDelete({
    //   table: someTable,
    //   where: eq(someTable.slug, 'legacy-slug'),
    //   reason: 'Superseded by <link to the spec/decision>',
    // });

    return { summary: 'TODO: describe what changed' };
}
`;
}

/**
 * Scaffolds a new versioned seed data-migration file: computes the next
 * `NNNN` numeric prefix from the existing files in `dir`, validates the slug,
 * and writes `NNNN-<slug>.ts` from a template whose `meta.name` matches the
 * emitted filename stem by construction.
 *
 * @param args - RO-RO input. See {@link MakeMigrationArgs}.
 * @returns The new file's absolute path and migration name.
 *
 * @throws {Error} If `args.slug` is invalid (see {@link normalizeSlug}).
 * @throws {Error} If the computed target filename would collide with an
 *   existing file in `dir` (should not happen by construction, since the
 *   computed prefix is always `max + 1`, but guarded defensively).
 *
 * @example
 * ```ts
 * const { filePath, name } = await makeMigration({ slug: 'remove-legacy-feature' });
 * // name === '0004-remove-legacy-feature' (if 0001..0003 already exist)
 * ```
 */
export async function makeMigration(args: MakeMigrationArgs): Promise<MakeMigrationResult> {
    const { group = 'required', destructive = false, dir = DEFAULT_MIGRATIONS_DIR } = args;

    const slug = normalizeSlug(args.slug);

    await mkdir(dir, { recursive: true });

    const maxNumericPrefix = await findMaxNumericPrefix(dir);
    const nextNumericPrefix = maxNumericPrefix + 1;
    const numberedPrefix = String(nextNumericPrefix).padStart(4, '0');

    const name = `${numberedPrefix}-${slug}`;
    const fileName = `${name}.ts`;
    const filePath = path.join(dir, fileName);

    const existingEntries = await readdir(dir);
    if (existingEntries.includes(fileName)) {
        throw new Error(
            `Cannot scaffold data-migration '${fileName}': a file with that exact name already exists at '${dir}'.`
        );
    }

    const source = buildMigrationSource({ name, group, destructive });
    await writeFile(filePath, source, 'utf-8');

    return { filePath, name };
}
