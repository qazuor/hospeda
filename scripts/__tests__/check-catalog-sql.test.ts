/**
 * @fileoverview
 * TEST:V1:5 (AC:V1:4): GUARD:G18 is green over the repo's migrations with the
 * regenerated SQL, and red, on purpose, when a key is added to the code catalog
 * without regenerating: the red names the load (the key table) and the key.
 *
 * Also pins that `scripts/generate-catalog-sql.ts` reproduces the INSERT rows of
 * `0129_gorgeous_storm.sql` byte for byte, and that the guard folds the WHOLE
 * migration history (a later migration that inserts the regenerated key turns it
 * green again), not one file.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { CatalogKeyDefinition } from '../../packages/schemas/src/catalog/key-attributes.js';
import { CATALOG_KEY_DEFINITIONS } from '../../packages/schemas/src/catalog/key-catalog.js';
import { run, splitStatements } from '../check-catalog-sql.js';
import { buildCatalogKeyLoad, buildVerticalLoad, renderInsert } from '../generate-catalog-sql.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIGRATION_0129 = path.join(REPO_ROOT, 'packages/db/src/migrations/0129_gorgeous_storm.sql');
const MIGRATION_0140 = path.join(
    REPO_ROOT,
    'packages/db/src/migrations/0140_misty_captain_britain.sql'
);

const NEW_KEY: CatalogKeyDefinition = {
    key: 'zz_new_capability',
    kind: 'entitlement',
    scope: 'vertical',
    aggregationStrategy: 'MAX',
    enforcementStrategy: 'NONE',
    keyClass: 'COMMERCIAL'
};

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes migration files into a fresh directory and returns it. */
function migrationsDir({ files }: { readonly files: Readonly<Record<string, string>> }): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'g18-'));
    tempDirs.push(dir);
    mkdirSync(dir, { recursive: true });
    for (const [name, sql] of Object.entries(files)) writeFileSync(path.join(dir, name), sql);
    return dir;
}

/** A green history: the original catalog, the later activation key, and an unrelated migration. */
const GREEN = {
    '0001_unrelated.sql': 'CREATE TABLE "x" ("id" integer);\n',
    '0129_gorgeous_storm.sql': readFileSync(MIGRATION_0129, 'utf8'),
    '0140_misty_captain_britain.sql': readFileSync(MIGRATION_0140, 'utf8')
};

describe('scripts/generate-catalog-sql.ts', () => {
    it('reproduces the original INSERT statements of 0129_gorgeous_storm.sql byte for byte', () => {
        const migration = readFileSync(MIGRATION_0129, 'utf8');
        const compared = migration.slice(migration.indexOf('INSERT INTO'));
        const originalKeys = buildCatalogKeyLoad({
            definitions: CATALOG_KEY_DEFINITIONS.filter((d) => d.key !== 'activate_trial')
        });

        expect(
            `${renderInsert({ load: buildVerticalLoad() })}\n--> statement-breakpoint\n${renderInsert({ load: originalKeys })}\n`
        ).toBe(compared);
    });

    it('renders one row per code catalog key and one per vertical', () => {
        expect(buildCatalogKeyLoad().rows).toHaveLength(CATALOG_KEY_DEFINITIONS.length);
        expect(buildVerticalLoad().rows).toHaveLength(5);
    });
});

describe('TEST:V1:5 — GUARD:G18', () => {
    it('is green over the repository migrations', () => {
        const result = run();

        expect(result.output).toContain(`catalog_key ${CATALOG_KEY_DEFINITIONS.length} row(s)`);
        expect(result.exitCode).toBe(0);
    });

    it('is red when a key is added to the code catalog without regenerating, naming the load and the key', () => {
        const loads = [
            buildVerticalLoad(),
            buildCatalogKeyLoad({ definitions: [...CATALOG_KEY_DEFINITIONS, NEW_KEY] })
        ];

        const result = run({ migrationsDir: migrationsDir({ files: GREEN }), loads });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('FAIL load catalog_key (the entitlement/limit key table)');
        expect(result.output).toContain(
            `key '${NEW_KEY.key}' is in the code catalog but no migration inserts it`
        );
        expect(result.output).not.toContain('FAIL load vertical');
    });

    it('turns green again once a LATER migration inserts the regenerated row (cumulative history)', () => {
        const withKey = buildCatalogKeyLoad({ definitions: [NEW_KEY] });
        const loads = [
            buildVerticalLoad(),
            buildCatalogKeyLoad({ definitions: [...CATALOG_KEY_DEFINITIONS, NEW_KEY] })
        ];

        const result = run({
            migrationsDir: migrationsDir({
                files: { ...GREEN, '0131_new_key.sql': `${renderInsert({ load: withKey })}\n` }
            }),
            loads
        });

        expect(result.exitCode).toBe(0);
    });

    it('is red when an attribute changes in code, naming the key and the column', () => {
        const changed = CATALOG_KEY_DEFINITIONS.map((d) =>
            d.key === 'max_accommodations' ? { ...d, enforcementStrategy: 'ARCHIVE' as const } : d
        );

        const result = run({
            migrationsDir: migrationsDir({ files: GREEN }),
            loads: [buildCatalogKeyLoad({ definitions: changed })]
        });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            "key 'max_accommodations' differs from 0129_gorgeous_storm.sql"
        );
        expect(result.output).toContain(
            'enforcement_strategy is "ARCHIVE" in code, "UNPUBLISH" in SQL'
        );
    });

    it('is red when a key is removed from the code but the migrations still insert it', () => {
        const removed = CATALOG_KEY_DEFINITIONS.filter((d) => d.key !== 'write_reviews');

        const result = run({
            migrationsDir: migrationsDir({ files: GREEN }),
            loads: [buildCatalogKeyLoad({ definitions: removed })]
        });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            "key 'write_reviews' is inserted by 0129_gorgeous_storm.sql"
        );
    });

    it('is red on the vertical load when an activation event changes, naming that load', () => {
        const result = run({
            migrationsDir: migrationsDir({ files: GREEN }),
            loads: [
                buildVerticalLoad({
                    activationByVertical: {
                        accommodation: 'listing_published',
                        gastronomy: 'listing_published',
                        experience: 'listing_published',
                        tourist: 'start_button_pressed',
                        partner: 'listing_published'
                    }
                })
            ]
        });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('FAIL load vertical (the vertical table)');
        expect(result.output).toContain("key 'partner' differs");
    });

    it('fails closed on a statement it cannot fold into the row set', () => {
        const result = run({
            migrationsDir: migrationsDir({
                files: {
                    ...GREEN,
                    '0131_patch.sql':
                        "UPDATE \"catalog_key\" SET key_class = 'BASE' WHERE key = 'ai_chat';\n"
                }
            }),
            loads: [buildCatalogKeyLoad()]
        });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            '0131_patch.sql: a statement writes "catalog_key" in a shape G18 cannot fold'
        );
    });

    it('is red when two migrations insert the same key', () => {
        const dup = buildCatalogKeyLoad({
            definitions: [
                CATALOG_KEY_DEFINITIONS.find((d) => d.key === 'ai_chat') as CatalogKeyDefinition
            ]
        });

        const result = run({
            migrationsDir: migrationsDir({
                files: { ...GREEN, '0131_dup.sql': `${renderInsert({ load: dup })}\n` }
            }),
            loads: [buildCatalogKeyLoad()]
        });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('inserted twice');
    });

    it('refuses an empty migrations directory instead of calling it clean', () => {
        const result = run({ migrationsDir: migrationsDir({ files: {} }) });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('no versioned migration found');
    });

    it('ignores comments, so the 0129 note stays outside the compared region', () => {
        const statements = splitStatements({
            sql: '-- INSERT INTO "catalog_key" note; with a semicolon\nINSERT INTO "t" ("a") VALUES (\'x;y\');\n'
        });

        expect(statements).toEqual(['INSERT INTO "t" ("a") VALUES (\'x;y\')']);
    });
});
