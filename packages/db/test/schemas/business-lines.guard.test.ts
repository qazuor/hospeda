import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BUSINESS_LINE_RULES, BUSINESS_LINES } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

const root = process.cwd().endsWith('/packages/db') ? join(process.cwd(), '../..') : process.cwd();
const migration = readFileSync(
    join(root, 'packages/db/src/migrations/0186_confused_violations.sql'),
    'utf8'
);
function valuesInCheck(table: string): string[] {
    const check =
        migration.match(
            new RegExp(`ADD CONSTRAINT "${table}_business_lines_valid" CHECK \\(([^;]+)`)
        )?.[1] ?? '';
    return [...check.matchAll(/'([a-z_]+)'/g)].map((match) => match[1] as string);
}

describe('TEST:2.3:4 G-FAC-01', () => {
    it('matches the catalog checks, defaults, columns, and GIN indexes', () => {
        for (const [table, catalog, schemaPath] of [
            ['venues', BUSINESS_LINES.venue, 'packages/db/src/schemas/venue/venue.dbschema.ts'],
            [
                'accommodations',
                BUSINESS_LINES.accommodation,
                'packages/db/src/schemas/accommodation/accommodation.dbschema.ts'
            ],
            [
                'experiences',
                BUSINESS_LINES.experience,
                'packages/db/src/schemas/experience/experiences.dbschema.ts'
            ]
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
            const schema = readFileSync(join(root, schemaPath), 'utf8');
            expect(schema).toMatch(/businessLines:\s*text\('business_lines'\)/);
            expect(schema).toMatch(
                /business_lines_gin_idx:[\s\S]{0,160}using\('gin', table\.businessLines\)/
            );
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
