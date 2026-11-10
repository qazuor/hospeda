import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    BUSINESS_LINE_RULES,
    BUSINESS_LINES
} from '../../../schemas/src/catalog/business-lines.js';

const root = process.cwd().endsWith('/packages/db') ? join(process.cwd(), '../..') : process.cwd();
const migrationsDir = join(root, 'packages/db/src/migrations');
const migration = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(join(migrationsDir, file), 'utf8'))
    .filter((source) => /business_lines_valid/.test(source))
    .at(-1);
if (!migration) throw new Error('No migration declares a business_lines CHECK');
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
            const catalogArray = `ARRAY[${catalog.map(({ value }) => `'${value}'`).join(', ')}]::text[]`;
            expect(migration).toContain(`<@ ${catalogArray}`);
            expect(
                migration.match(new RegExp(`${table}_business_lines_valid" CHECK \\([^;]+`))?.[0]
            ).toContain('cardinality');
            const schema = readFileSync(join(root, schemaPath), 'utf8');
            expect(schema).toMatch(/businessLines:\s*text\('business_lines'\)/);
            expect(schema).toMatch(
                /business_lines_gin_idx:[\s\S]*?using\(\s*'gin',\s*table\.businessLines\s*\)/
            );
        }
        for (const [type, rule] of Object.entries(BUSINESS_LINE_RULES.venue.typeRules)) {
            expect(migration).toContain(
                `WHEN '${type}' THEN "venues"."business_lines" <@ ARRAY[${rule.allowed.map((value) => `'${value}'`).join(', ')}]::text[]`
            );
        }
        const accommodationDefault = BUSINESS_LINES.accommodation
            .map(({ value }) => `'${value}'`)
            .join(', ');
        const experienceDefault = BUSINESS_LINES.experience
            .map(({ value }) => `'${value}'`)
            .join(', ');
        expect(migration).toContain(`DEFAULT ARRAY[${accommodationDefault}]::text[]`);
        expect(migration).toContain(`DEFAULT ARRAY[${experienceDefault}]::text[]`);
        expect(migration).not.toMatch(
            /ALTER TABLE "venues" ADD COLUMN "business_lines"[^;]*DEFAULT/
        );
    });
});
