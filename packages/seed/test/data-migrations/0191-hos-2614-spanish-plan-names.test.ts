import { describe, expect, it, vi } from 'vitest';
import { PRODUCTION_PLAN_CATALOG } from '../../../../scripts/production-catalog/catalog.js';
import * as migration from '../../src/data-migrations/0191-hos-2614-spanish-plan-names.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

describe('0191-hos-2614-spanish-plan-names', () => {
    it('is content-only so a baseline stamp never skips it', () => {
        expect(migration.meta.contentOnly).toBe(true);
        expect(migration.meta.destructive).toBe(false);
    });

    it('targets exactly the catalog plans whose name differs from the 0144 name', () => {
        for (const rename of migration.PLAN_RENAMES) {
            const plan = PRODUCTION_PLAN_CATALOG.find(
                (p) => p.vertical === rename.vertical && p.slug === rename.slug
            );
            expect(plan, `${rename.vertical}/${rename.slug}`).toBeDefined();
            expect(plan?.name).toBe(rename.to);
            expect(rename.to).not.toBe(rename.from);
        }
        const renamedKeys = new Set(migration.PLAN_RENAMES.map((r) => `${r.vertical}:${r.slug}`));
        expect(migration.PLAN_RENAMES).toHaveLength(21);
        expect(renamedKeys.size).toBe(21);
    });

    it('uses no English word in a new name', () => {
        for (const rename of migration.PLAN_RENAMES) {
            expect(rename.to).not.toMatch(
                /\b(Trial|Floor|Pre|Basic|Professional|Free|Silver|Gold)\b/
            );
        }
    });

    it('updates by (vertical, slug, old name) and sums affected rows', async () => {
        const execute = vi.fn(async () => ({ rowCount: 1 }));
        const ctx = { db: { execute } } as unknown as SeedMigrationCtx;
        const result = await migration.up(ctx);
        expect(execute).toHaveBeenCalledTimes(21);
        expect(result.counts).toEqual({ renamed: 21, expected: 21 });
    });

    it('reports zero on a second run', async () => {
        const execute = vi.fn(async () => ({ rowCount: 0 }));
        const ctx = { db: { execute } } as unknown as SeedMigrationCtx;
        const result = await migration.up(ctx);
        expect(result.counts).toEqual({ renamed: 0, expected: 21 });
    });
});
