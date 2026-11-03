import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BUSINESS_LINE_RULES, BUSINESS_LINES } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

const root = process.cwd().endsWith('/packages/db') ? join(process.cwd(), '../..') : process.cwd();
const migration = readFileSync(
    join(root, 'packages/db/src/migrations/0186_confused_violations.sql'),
    'utf8'
);
const schemas = [
    'packages/db/src/schemas/venue/venue.dbschema.ts',
    'packages/db/src/schemas/accommodation/accommodation.dbschema.ts',
    'packages/db/src/schemas/experience/experiences.dbschema.ts'
].map((path) => readFileSync(join(root, path), 'utf8'));

function valuesInCheck(table: string): string[] {
    const check =
        migration.match(
            new RegExp(`ADD CONSTRAINT "${table}_business_lines_valid" CHECK \\(([^;]+)`)
        )?.[1] ?? '';
    return [...check.matchAll(/'([a-z_]+)'/g)].map((match) => match[1] as string);
}

describe('TEST:2.3:4 G-FAC-01', () => {
    it('matches the catalog checks, defaults, columns, and GIN indexes', () => {
        for (const [table, catalog] of [
            ['venues', BUSINESS_LINES.venue],
            ['accommodations', BUSINESS_LINES.accommodation],
            ['experiences', BUSINESS_LINES.experience]
        ] as const) {
            expect(migration).toContain(`ADD COLUMN "business_lines"`);
            expect(migration).toContain(`ADD CONSTRAINT "${table}_business_lines_valid"`);
            expect(migration).toContain(`CREATE INDEX "${table}_business_lines_gin_idx"`);
            expect(valuesInCheck(table)).toEqual(
                expect.arrayContaining(catalog.map(({ value }) => value))
            );
            expect(
                migration.match(new RegExp(`${table}_business_lines_valid" CHECK \\([^;]+`))?.[0]
            ).toContain('cardinality');
            expect(
                schemas.find(
                    (source) => source.includes(`'${table}'`) || source.includes(`"${table}"`)
                ) ?? schemas.join('\n')
            ).toContain('business_lines');
        }
        for (const [type, rule] of Object.entries(BUSINESS_LINE_RULES.venue.typeRules)) {
            expect(migration).toContain(
                `WHEN '${type}' THEN "venues"."business_lines" <@ ARRAY[${rule.allowed.map((value) => `'${value}'`).join(', ')}]::text[]`
            );
        }
        expect(migration).toContain("DEFAULT ARRAY['standard']::text[]");
        expect(migration).not.toMatch(
            /ALTER TABLE "venues" ADD COLUMN "business_lines"[^;]*DEFAULT/
        );
    });
});
