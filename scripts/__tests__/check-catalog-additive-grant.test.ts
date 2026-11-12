/** TEST:catalog-additive-grant — guard scope, signal lifetime, and SQL syntax. */
import { describe, expect, it } from 'vitest';
import { inspectCatalogAdditiveGrant } from '../check-catalog-additive-grant';

const canonical = `CREATE OR REPLACE FUNCTION reject_catalog_child_insert_into_published_version()
RETURNS TRIGGER AS $$ BEGIN RETURN NEW; END; $$ LANGUAGE plpgsql;`;
const inspect = (files: Readonly<Record<string, string>>) =>
    inspectCatalogAdditiveGrant({ files, canonicalFunction: canonical });
const sqlFile = 'packages/db/src/migrations/0203_fixture.sql';
const tsFile = 'packages/seed/src/data-migrations/0203-fixture.ts';
const child = "INSERT INTO plan_version_limit (plan_version_id, key, value) VALUES ('id', 'k', 2);";
const grant = "SELECT set_config('hospeda.catalog_additive_grant', 'HOS-2105', true);";
const reset = "SELECT set_config('hospeda.catalog_additive_grant', '', true);";

describe('GUARD:catalog-additive-grant', () => {
    it('rejects writing the created-version setting in SQL and seed TypeScript', () => {
        for (const file of [sqlFile, tsFile]) {
            expect(
                inspect({
                    [file]: "SELECT set_config('hospeda.catalog_versions_created_in_xact', 'id', true);"
                })
            ).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        detail: expect.stringContaining('outside the trigger function')
                    })
                ])
            );
        }
    });

    it('ignores a created-version setting mentioned only in comments', () => {
        expect(
            inspect({
                [sqlFile]:
                    "-- set_config('hospeda.catalog_versions_created_in_xact', 'id', true);\nSELECT 1;"
            })
        ).toEqual([]);
    });

    it('requires a signal reset after the last child insert in SQL and seed TypeScript', () => {
        for (const file of [sqlFile, tsFile]) {
            expect(
                inspect({ [file]: `${grant}\n${child}` }).some((v) =>
                    v.detail.includes('not reset')
                )
            ).toBe(true);
            expect(inspect({ [file]: `${grant}\n${child}\n${reset}` })).toEqual([]);
        }
    });

    it('does not accept comments as a grant signal', () => {
        expect(
            inspect({ [sqlFile]: `-- ${grant}\n${child}` }).some((v) =>
                v.detail.includes('neither same-file')
            )
        ).toBe(true);
    });

    it('checks child SQL strings in seed TypeScript', () => {
        expect(
            inspect({ [tsFile]: `const sql = \`${child}\`;` }).some((v) =>
                v.detail.includes('neither same-file')
            )
        ).toBe(true);
        expect(inspect({ [tsFile]: `const sql = \`${grant}\n${child}\n${reset}\`;` })).toEqual([]);
    });

    it('recognizes schema-qualified and quoted child table names', () => {
        const forms = [
            "INSERT INTO public.plan_version_limit (key) VALUES ('k');",
            'INSERT INTO "public"."plan_version_limit" (key) VALUES (\'k\');'
        ];
        for (const statement of forms) {
            expect(
                inspect({ [sqlFile]: statement }).some((v) =>
                    v.detail.includes('neither same-file')
                )
            ).toBe(true);
            expect(inspect({ [sqlFile]: `${grant}\n${statement}\n${reset}` })).toEqual([]);
        }
    });

    it('recognizes INSERT INTO table SELECT syntax', () => {
        const statement =
            'INSERT INTO plan_version_limit SELECT plan_version_id, key, value FROM staging_limits;';
        expect(
            inspect({ [sqlFile]: statement }).some((v) => v.detail.includes('neither same-file'))
        ).toBe(true);
        expect(inspect({ [sqlFile]: `${grant}\n${statement}\n${reset}` })).toEqual([]);
    });

    it('recognizes WITH queries followed by INSERT INTO child table', () => {
        const statement =
            "WITH grants AS (SELECT 1) INSERT INTO addon_version_limit (addon_version_id, key, value) SELECT id, 'k', 1 FROM grants;";
        expect(
            inspect({ [sqlFile]: statement }).some((v) => v.detail.includes('neither same-file'))
        ).toBe(true);
        expect(inspect({ [sqlFile]: `${grant}\n${statement}\n${reset}` })).toEqual([]);
    });

    it('keeps the same-file version INSERT exception', () => {
        expect(
            inspect({ [sqlFile]: `INSERT INTO plan_version (id) VALUES ('id');\n${child}` })
        ).toEqual([]);
    });

    it('exempts historical migrations through 0144', () => {
        expect(inspect({ 'packages/db/src/migrations/0144_catalog.sql': child })).toEqual([]);
    });

    it('rejects a migration copy whose function body differs from extras 041', () => {
        expect(
            inspect({ [sqlFile]: canonical.replace('RETURN NEW', 'RETURN OLD') }).some((v) =>
                v.detail.includes('body differs')
            )
        ).toBe(true);
    });

    it('strips SQL comments before comparing copied function bodies', () => {
        expect(
            inspect({
                [sqlFile]: canonical.replace('BEGIN RETURN NEW;', 'BEGIN -- comment\n RETURN NEW;')
            })
        ).toEqual([]);
    });

    it('prefixes diagnostics with this guard name', () => {
        expect(inspect({ [sqlFile]: child })[0]?.detail).toContain('neither same-file');
    });
});
