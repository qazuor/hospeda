/**
 * Migration tests: HOS-2336 partner types catalog (0237), EXPAND step.
 *
 * This release only ADDS the catalog table and the nullable `partners.type_id`
 * FK, and relaxes the legacy `partners.type` to nullable. Everything that
 * removes the legacy enum column (the column, its index, the pg enum) and the
 * NOT NULL on `type_id` ship one release later, after the data-migration ran
 * everywhere (HOS-433 / docs/guides/migrations.md "Deploy order").
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../src/migrations/0237_hos2336_partner_types_catalog.sql'
);

/** Statements only: `--` comment lines are dropped so prose cannot trip a regex. */
const sql = readFileSync(MIGRATION_PATH, 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');

describe('0237 partner types catalog migration (expand only)', () => {
    it('drops no table, column, index, constraint or type', () => {
        const destructive = sql.match(
            /DROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT|TYPE)|ALTER\s+TABLE\s+\S+\s+DROP\s+COLUMN/gi
        );
        expect(destructive).toBeNull();
    });

    it('only relaxes partners.type (DROP NOT NULL), never touches its enum or index', () => {
        expect(sql).toContain('ALTER TABLE "partners" ALTER COLUMN "type" DROP NOT NULL');
        expect(sql).not.toMatch(/"partners_type_idx"/);
        expect(sql).not.toMatch(/partner_type_enum/);
    });

    it('adds partners.type_id as a NULLABLE uuid with a RESTRICT FK and an index', () => {
        expect(sql).toContain('ALTER TABLE "partners" ADD COLUMN "type_id" uuid;');
        expect(sql).not.toMatch(/"type_id" uuid NOT NULL/);
        expect(sql).toMatch(
            /"partners_type_id_partner_types_id_fk"[^;]*REFERENCES "public"\."partner_types"\("id"\) ON DELETE restrict/
        );
        expect(sql).toContain('CREATE INDEX "partners_typeId_idx" ON "partners"');
    });

    it('creates partner_types with a table-wide unique slug', () => {
        expect(sql).toContain('CREATE TABLE "partner_types"');
        expect(sql).toContain('CONSTRAINT "partner_types_slug_unique" UNIQUE("slug")');
    });

    it('adds the five partnerType permission labels to permission_enum', () => {
        for (const action of ['view', 'create', 'update', 'delete', 'restore']) {
            expect(sql).toContain(
                `ALTER TYPE "public"."permission_enum" ADD VALUE 'partnerType.${action}'`
            );
        }
    });
});
