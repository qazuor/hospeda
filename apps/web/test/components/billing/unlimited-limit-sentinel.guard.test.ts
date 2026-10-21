import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isUnlimitedLimit } from '@/components/billing/plan-card-delta';

const REPO_ROOT = resolve(__dirname, '../../../../..');
const BILLING_DIR = join(REPO_ROOT, 'apps/web/src/components/billing');

function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(path);
        return /\.(?:ts|astro)$/.test(entry.name) ? [path] : [];
    });
}

describe('HOS-1719 unlimited sentinel guards', () => {
    it('TEST:1719:4 keeps the web predicate tied to producer and migration values', () => {
        const catalog = readFileSync(
            join(REPO_ROOT, 'scripts/production-catalog/catalog.ts'),
            'utf8'
        );
        const migration = readFileSync(
            join(REPO_ROOT, 'packages/db/src/migrations/0144_production_plan_catalog.sql'),
            'utf8'
        );
        const catalogValue = catalog.match(/export const UNLIMITED_LIMIT_VALUE = (\d+);/);
        const migrationValue = migration.match(/'max_favorites',\s*(\d+)\)/);

        expect(catalogValue, 'catalog sentinel declaration').not.toBeNull();
        expect(migrationValue, 'max_favorites migration row').not.toBeNull();
        expect(isUnlimitedLimit({ value: Number(catalogValue?.[1]) })).toBe(true);
        expect(isUnlimitedLimit({ value: Number(migrationValue?.[1]) })).toBe(true);
        expect(isUnlimitedLimit({ value: 5 })).toBe(false);
    });

    it('TEST:1719:5 keeps one web sentinel definition and removes stale -1 comparisons', () => {
        const files = [
            ...sourceFiles(BILLING_DIR),
            join(REPO_ROOT, 'apps/web/src/lib/billing-i18n.ts')
        ];
        const violations: string[] = [];

        for (const file of files) {
            const source = readFileSync(file, 'utf8');
            const rel = relative(REPO_ROOT, file);
            if (/[=!]==?\s*-1\b/.test(source)) violations.push(`${rel}: -1 comparison`);
            if (file.endsWith('plan-card-delta.ts')) continue;
            if (/2147483647|2_147_483_647/.test(source))
                violations.push(`${rel}: sentinel literal`);
        }

        expect(violations).toEqual([]);
    });
});
