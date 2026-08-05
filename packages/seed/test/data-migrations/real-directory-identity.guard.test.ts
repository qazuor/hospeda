/**
 * @fileoverview
 * Static guard over the REAL `src/data-migrations/` directory.
 *
 * `discoverMigrationFiles` already rejects duplicate numeric prefixes and a
 * `meta.name` that disagrees with the filename stem — but every existing test
 * for it runs against fixture directories under `__fixtures__/discover/`, and
 * the only call that scans the real directory lives in
 * `lifecycle.integration.test.ts`, which is DB-gated and skipped wherever
 * Postgres is unavailable (CI included). So the real directory could — and
 * did — go out of contract without a single red test.
 *
 * The concrete incident: two branches independently allocated
 * `0034`/`0035`/`0036`/`0037` (HOS-372/HOS-374/HOS-369/HOS-390 on `staging`,
 * HOS-375's own five on the feature branch). Filenames differ, so git merged
 * both sets cleanly; `pnpm db:seed:migrate` would then have thrown on the
 * duplicate prefix before applying anything.
 *
 * It then recurred verbatim on the very next catch-up merge, at `0038`:
 * `staging` landed `0038-hos-374-cut-editor-panel-access` while this branch's
 * `system-account-flag-staff` was sitting on the same prefix, and the five
 * HOS-375 migrations had to be renumbered a second time (to `0039`-`0043`).
 * That is the point — the collision is not a one-off mistake but the default
 * outcome of any long-lived branch that allocates a prefix, and this guard is
 * what reports it in CI at unit level instead of at `db:seed:migrate` time.
 *
 * This guard is deliberately source-level (readdir + read the file text) and
 * imports no migration module: importing them pulls in the DB layer, which is
 * exactly what makes the existing real-directory check DB-gated.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../src/data-migrations'
);

/**
 * Same convention `discoverMigrationFiles` scans by: a 4-digit numeric prefix,
 * a hyphen, a non-empty slug, and a `.ts`/`.js` extension.
 */
const MIGRATION_FILENAME_PATTERN = /^(\d{4})-.+\.(?:ts|js)$/;

const migrationFiles = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => MIGRATION_FILENAME_PATTERN.test(fileName))
    .sort();

describe('data-migrations directory identity (real directory)', () => {
    it('finds migration files at all (guards against a broken scan path)', () => {
        expect(migrationFiles.length).toBeGreaterThan(0);
    });

    it('gives every migration a unique 4-digit numeric prefix', () => {
        const byPrefix = new Map<string, string[]>();
        for (const fileName of migrationFiles) {
            const prefix = fileName.slice(0, 4);
            byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), fileName]);
        }

        const duplicates = [...byPrefix.entries()]
            .filter(([, files]) => files.length > 1)
            .map(([prefix, files]) => `${prefix}: ${files.join(', ')}`);

        expect(
            duplicates,
            `Two or more data-migrations claim the same NNNN prefix, which makes ordering ambiguous and ` +
                `makes discoverMigrationFiles() throw before applying anything. Renumber the newer one(s) ` +
                `past the highest prefix already on staging, and update their meta.name to match.`
        ).toEqual([]);
    });

    it('declares a meta.name equal to the filename stem in every migration', () => {
        const mismatches: string[] = [];

        for (const fileName of migrationFiles) {
            const stem = fileName.replace(/\.(?:ts|js)$/, '');
            const source = readFileSync(path.join(MIGRATIONS_DIR, fileName), 'utf-8');
            if (!source.includes(`name: '${stem}'`)) {
                mismatches.push(fileName);
            }
        }

        expect(
            mismatches,
            `These files do not contain the literal \`name: '<filename stem>'\`. Either meta.name diverged ` +
                `from the filename (discoverMigrationFiles() throws on that, and the ledger would record an ` +
                `identity that no longer matches the file it came from), or the meta block is formatted in a ` +
                `way this source-level guard cannot read.`
        ).toEqual([]);
    });
});
