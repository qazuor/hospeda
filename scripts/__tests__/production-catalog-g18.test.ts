import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseValues, run } from '../check-catalog-sql.js';
import { PLACEHOLDER_CATALOG } from '../production-catalog/catalog.js';
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
            migrationsDir: migrationsDir(generatePlanCatalogSql()),
            loads: buildPlanCatalogLoads()
        });
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('plan_version_limit 1 row(s)');
    });

    it('mutation: a changed boolean and integer name their load and row key', () => {
        const sql = generatePlanCatalogSql().replace('900000, TRUE, TRUE', '900001, FALSE, TRUE');
        const result = run({ migrationsDir: migrationsDir(sql), loads: buildPlanCatalogLoads() });
        const version = buildPlanCatalogLoads()[1]?.rows[3]?.[0];
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('FAIL load production catalog plan_version');
        expect(result.output).toContain(`key '${version}'`);
        expect(result.output).toContain('rank is 900000 in code, 900001 in SQL');
        expect(result.output).toContain('sellable is true in code, false in SQL');
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
