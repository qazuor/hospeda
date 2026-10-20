import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseValues, run } from '../check-catalog-sql.js';
import { PLACEHOLDER_CATALOG, PRODUCTION_PLAN_CATALOG } from '../production-catalog/catalog.js';
import { buildPlanCatalogLoads, generatePlanCatalogSql } from '../production-catalog/loads.js';

const directories: string[] = [];
afterEach(() => {
    for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function migrationsDir(sql: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'g18-plan-'));
    directories.push(dir);
    writeFileSync(join(dir, '0141_catalog.sql'), sql);
    return dir;
}

describe('GUARD:G18 — production catalog load', () => {
    it('parses integer and boolean literals and rejects unsupported expressions', () => {
        expect(parseValues({ text: "('id', 900000, TRUE, FALSE, NULL)" }).tuples).toEqual([
            ['id', 900000, true, false, null]
        ]);
        expect(parseValues({ text: "('id', now())" }).error).toContain('unsupported value');
    });

    it('regenerates and compares all four plan tables in a temporary migration', () => {
        const result = run({
            migrationsDir: migrationsDir(generatePlanCatalogSql(PLACEHOLDER_CATALOG)),
            loads: buildPlanCatalogLoads(PLACEHOLDER_CATALOG)
        });
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('plan_version_limit 1 row(s)');
    });

    it('mutation: a changed boolean and integer name their load and row key', () => {
        const sql = generatePlanCatalogSql(PLACEHOLDER_CATALOG).replace(
            '900000, TRUE, TRUE',
            '900001, FALSE, TRUE'
        );
        const result = run({
            migrationsDir: migrationsDir(sql),
            loads: buildPlanCatalogLoads(PLACEHOLDER_CATALOG)
        });
        const version = buildPlanCatalogLoads(PLACEHOLDER_CATALOG)[1]?.rows[3]?.[0];
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('FAIL load production catalog plan_version');
        expect(result.output).toContain(`key '${version}'`);
        expect(result.output).toContain('rank is 900000 in code, 900001 in SQL');
        expect(result.output).toContain('sellable is true in code, false in SQL');
    });

    it('the real 0144 SQL is byte-identical to the generator after its header', () => {
        const sql = readFileSync(
            resolve('packages/db/src/migrations/0144_production_plan_catalog.sql'),
            'utf8'
        );
        expect(sql.slice(sql.indexOf('\n') + 1)).toBe(generatePlanCatalogSql());
        expect(PRODUCTION_PLAN_CATALOG).toHaveLength(27);
    });

    it('mutation: a row changed in a copied real migration names its load and key', () => {
        const sql = readFileSync(
            resolve('packages/db/src/migrations/0144_production_plan_catalog.sql'),
            'utf8'
        );
        const load = buildPlanCatalogLoads()[0]!;
        const id = load.rows[0]![0] as string;
        const changed = sql.replace("'owner-basico', 'Basic', 1", "'owner-basico', 'Changed', 1");
        expect(changed).not.toBe(sql);
        const result = run({
            migrationsDir: migrationsDir(changed),
            loads: buildPlanCatalogLoads()
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('FAIL load production catalog plan');
        expect(result.output).toContain(`key '${id}'`);
        expect(result.output).toContain('name is "Basic" in code, "Changed" in SQL');
    });

    it('the definition accepts a declared trial limit without treating absence as an invariant', () => {
        const changed = PLACEHOLDER_CATALOG.map((plan) =>
            plan.role === 'trial'
                ? {
                      ...plan,
                      version: {
                          ...plan.version,
                          limits: [{ key: 'max_experiences' as const, value: 2 }]
                      }
                  }
                : plan
        );
        const loads = buildPlanCatalogLoads(changed);
        expect(loads[3]?.rows).toHaveLength(2);
        expect(
            run({ migrationsDir: migrationsDir(generatePlanCatalogSql(changed)), loads }).exitCode
        ).toBe(0);
    });
});
