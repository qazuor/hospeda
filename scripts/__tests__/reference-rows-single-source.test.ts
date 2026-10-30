/**
 * @fileoverview
 * TEST:V1:6 (AC:V1:4 (d)), static half: the development, integration and nightly
 * e2e databases are all built by `db:migrate`, like `e2e-pr`, so the reference
 * rows the migrations write (`vertical`, `catalog_key`) have a single source.
 * A `drizzle-kit push` builds the tables and none of their rows.
 *
 * The database half (the rows `db:migrate` writes, and the FK) is
 * `packages/db/test/integration/catalog-key-fk-from-empty.test.ts`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file: string) => readFileSync(path.join(REPO_ROOT, file), 'utf8');

/** The `run:` lines of a workflow file. */
function runLines({ workflow }: { readonly workflow: string }): readonly string[] {
    return read(workflow)
        .split('\n')
        .filter((line) => /^\s*run:/.test(line));
}

describe('TEST:V1:6 — every database is built by db:migrate', () => {
    it('development: db:fresh-dev runs db:migrate and never db:push', () => {
        const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;

        expect(scripts['db:fresh-dev']).toContain('pnpm db:migrate');
        expect(scripts['db:fresh-dev']).not.toMatch(/db:push|drizzle-kit push/);
    });

    it('integration: the global setup runs drizzle-kit migrate, not push', () => {
        const setup = read('packages/db/test/integration/global-setup.ts');

        expect(setup).toMatch(/'node_modules\/drizzle-kit\/bin\.cjs',\s*'migrate'/);
        expect(setup).not.toMatch(/'push'/);
    });

    it.each([
        '.github/workflows/e2e-nightly.yml',
        '.github/workflows/e2e-pr.yml'
    ])('%s applies db:migrate and never db:push', (workflow) => {
        const lines = runLines({ workflow });

        expect(lines.some((line) => line.includes('db:migrate'))).toBe(true);
        expect(lines.filter((line) => /db:push|drizzle-kit push/.test(line))).toEqual([]);
    });
});
