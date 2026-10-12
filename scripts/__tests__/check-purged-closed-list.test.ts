/** TEST:V6:14 — GUARD:G-R9 detects a table hanging from a listing without a PURGED row. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { findHangingTables, PURGED_LIST_PATH, run } from '../check-purged-closed-list';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REAL_LIST = readFileSync(path.join(REPO_ROOT, PURGED_LIST_PATH), 'utf8');
const NEW_TABLE_FILE = 'packages/db/src/schemas/x/new_table.dbschema.ts';
const tempDirs: string[] = [];
afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function makeTree(files: Readonly<Record<string, string>>, list: string = REAL_LIST): string {
    const root = mkdtempSync(path.join(tmpdir(), 'g-r9-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    const all = { [PURGED_LIST_PATH]: list, ...files };
    for (const [file, source] of Object.entries(all)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), source);
    }
    return root;
}

function check(files: Readonly<Record<string, string>>, list?: string) {
    return run({ root: makeTree(files, list), minScannedFiles: 1 });
}

const HEADER =
    "import { pgTable, text, uuid, foreignKey } from 'drizzle-orm/pg-core';\n" +
    "import { accommodations, gastronomies } from '../listing';\n";

describe('TEST:V6:14 GUARD:G-R9 - every table hanging from a listing has a PURGED row', () => {
    it('accepts the repository tree', () => {
        const result = run();
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('29 tables hang by FK and 11 by entity_type');
        expect(result.output).toMatch(/^OK GUARD:G-R9: /);
    });

    it('rejects a new table whose references() to accommodations spans several lines', () => {
        const result = check({
            [NEW_TABLE_FILE]:
                HEADER +
                "export const newTable = pgTable('new_table', {\n" +
                "    id: uuid('id').primaryKey(),\n" +
                "    accommodationId: uuid('accommodation_id').references(\n" +
                '        () => accommodations.id,\n' +
                "        { onDelete: 'cascade' }\n" +
                '    )\n' +
                '});\n'
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            `FAIL GUARD:G-R9: ${NEW_TABLE_FILE}:5 table new_table hangs from a listing (fk -> accommodations)`
        );
        expect(result.output).toContain(PURGED_LIST_PATH);
    });

    it('rejects the same table declared with foreignKey() to gastronomies', () => {
        const result = check({
            [NEW_TABLE_FILE]:
                HEADER +
                "export const newTable = pgTable('new_table', {\n" +
                "    listingId: uuid('listing_id').notNull()\n" +
                '}, (t) => ({\n' +
                '    fk: foreignKey({ columns: [t.listingId], foreignColumns: [gastronomies.id] })\n' +
                '}));\n'
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            'table new_table hangs from a listing (fk -> gastronomies)'
        );
    });

    it('rejects a table with an entity_type column, whatever its constructor', () => {
        const result = check({
            [NEW_TABLE_FILE]:
                HEADER +
                "export const newTable = pgTable('new_table', {\n" +
                '    kind: text("entity_type").notNull()\n' +
                '});\n'
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            `${NEW_TABLE_FILE}:4 table new_table hangs from a listing (entity_type)`
        );
    });

    it('attributes each finding to the pgTable that contains it', () => {
        const found = findHangingTables({
            file: NEW_TABLE_FILE,
            source:
                HEADER +
                "export const a = pgTable('a_table', {\n" +
                "    accommodationId: uuid('accommodation_id').references(() => accommodations.id)\n" +
                '});\n' +
                "export const b = pgTable('b_table', { id: uuid('id') });\n"
        });
        expect(found.map((entry) => entry.table)).toEqual(['a_table']);
    });

    it('accepts a table that references users and has no entity_type', () => {
        const result = check({
            [NEW_TABLE_FILE]:
                HEADER +
                "export const newTable = pgTable('new_table', {\n" +
                "    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' })\n" +
                '});\n'
        });
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('0 tables hang by FK and 0 by entity_type');
    });

    it('ignores test files and comments', () => {
        const references = "uuid('accommodation_id').references(() => accommodations.id)";
        expect(
            findHangingTables({
                file: NEW_TABLE_FILE,
                source: `export const t = pgTable('new_table', {\n    // a: ${references}\n});\n`
            })
        ).toEqual([]);
        const result = check({
            'packages/db/src/schemas/x/new_table.test.ts': `pgTable('new_table', { a: ${references} });\n`,
            'packages/db/src/schemas/x/other.dbschema.ts': "pgTable('other', {});\n"
        });
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('1 schema files scanned');
    });

    it('rejects a scan smaller than the minimum', () => {
        const root = makeTree({ 'packages/db/src/schemas/x/a.dbschema.ts': '' });
        const result = run({ root, minScannedFiles: 2 });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('expected at least 2');
    });

    it('rejects a list with a repeated table, a row without spec, or that does not load', () => {
        const files = { 'packages/db/src/schemas/x/a.dbschema.ts': '' };
        const row = { table: 'posts', hangsBy: 'fk', spec: 'x.md:1' };
        const repeated = check(files, JSON.stringify([row, row]));
        expect(repeated.exitCode).toBe(1);
        expect(repeated.output).toContain('repeats table posts');
        const noSpec = check(files, JSON.stringify([{ table: 'posts', hangsBy: 'fk' }]));
        expect(noSpec.exitCode).toBe(1);
        expect(noSpec.output).toContain('has no table or no spec');
        const broken = check(files, '{ not json');
        expect(broken.exitCode).toBe(1);
        expect(broken.output).toContain('cannot load');
    });

    it('is wired into check:guards and the guards CI job', () => {
        const scripts = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'))
            .scripts as Record<string, string>;
        expect(scripts['check:purged-closed-list']).toBe('tsx scripts/check-purged-closed-list.ts');
        expect(scripts['check:guards']).toContain('pnpm check:purged-closed-list');
        expect(scripts['check:guards'].trim().endsWith('pnpm check:fake-lies')).toBe(true);
        const ci = readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8');
        const guardsJob = ci.split('\n  guards:\n')[1]?.split(/\n {2}[a-zA-Z][\w-]*:\n/)[0];
        expect(guardsJob).toBeDefined();
        expect(guardsJob).toContain(
            'name: Check every table hanging from a listing has a PURGED row (GUARD:G-R9)'
        );
        expect(guardsJob).toContain('run: pnpm check:purged-closed-list');
    });
});
