import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd().endsWith('/packages/db') ? join(process.cwd(), '../..') : process.cwd();
const migration = readFileSync(
    join(root, 'packages/db/src/migrations/0186_confused_violations.sql'),
    'utf8'
);

describe('TEST:2.3:1 AC:2:6 venue business-lines backfill', () => {
    it('covers the enum values fixed at migration time and has an ELSE', () => {
        const backfill =
            migration.match(
                /UPDATE "venues" SET "business_lines" = CASE "type"::text([\s\S]*?)END;/
            )?.[0] ?? '';
        const fixedTypes = [
            'RESTAURANT',
            'CAFE',
            'PARRILLA',
            'HELADERIA',
            'PANADERIA',
            'ROTISERIA',
            'FOOD_TRUCK',
            'BAR',
            'CERVECERIA',
            'PUB',
            'BOLICHE'
        ];
        for (const type of fixedTypes) expect(backfill).toContain(`WHEN '${type}'`);
        expect(backfill).toContain("ELSE ARRAY['food']::text[]");
        expect(backfill).toContain('type"::text');
    });
});
