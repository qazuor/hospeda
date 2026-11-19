import { describe, expect, it, vi } from 'vitest';
import * as migration from '../../src/data-migrations/0187-hos-2282-venue-promotions-grant.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

function flatten(node: unknown, depth = 0): string {
    if (depth > 12 || node == null) return '';
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map((part) => flatten(part, depth + 1)).join(' ');
    if (typeof node === 'object') {
        const record = node as Record<string, unknown>;
        return ['queryChunks', 'value', 'name']
            .map((key) => flatten(record[key], depth + 1))
            .join(' ');
    }
    return '';
}

function makeCtx(responses: Array<Record<string, number>> = []) {
    const statements: string[] = [];
    const execute = vi.fn(async (query: unknown) => {
        statements.push(flatten(query));
        const grantIndex = Math.floor((statements.length - 1) / 3);
        return { rows: [responses[grantIndex] ?? {}] };
    });
    const ctx = {
        db: { execute },
        actor: {},
        models: {},
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
    return { ctx, statements };
}

describe('0187-hos-2282-venue-promotions-grant', () => {
    it('is content-only, so a fresh database runs it instead of baseline-stamping it', () => {
        expect(migration.meta.contentOnly).toBe(true);
    });

    it('grants only venue Pro/Premium, with the decided entitlement and limits', async () => {
        const { ctx, statements } = makeCtx([
            { create_promotions_inserted: 4, max_active_promotions_inserted: 4 }
        ]);
        const result = await migration.up(ctx);
        const grant = statements[1] ?? '';

        expect(grant).toContain("where pv.vertical = 'venue'");
        expect(grant).toContain("p.slug in ('venue-pro', 'venue-premium')");
        expect(grant).toContain("case e.slug when 'venue-pro' then 5 else 2147483647 end");
        expect(grant).toContain("'create_promotions', null, null");
        expect(grant).toContain("existing.key = 'create_promotions'");
        expect(grant).toContain("existing.key = 'max_active_promotions'");
        expect(grant).not.toContain('venue_vip_promotions');
        expect(result.counts).toEqual({
            createPromotionsInserted: 4,
            maxActivePromotionsInserted: 4
        });
    });

    it('uses and clears the transaction-local grant signal and reports an idempotent no-op', async () => {
        const { ctx, statements } = makeCtx([
            { create_promotions_inserted: 0, max_active_promotions_inserted: 0 }
        ]);
        const result = await migration.up(ctx);

        expect(statements[0]).toContain(
            "set_config('hospeda.catalog_additive_grant', 'HOS-2282', true)"
        );
        expect(statements[2]).toContain("set_config('hospeda.catalog_additive_grant', '', true)");
        expect(result.counts).toEqual({
            createPromotionsInserted: 0,
            maxActivePromotionsInserted: 0
        });
    });

    it('is safe to run twice and never targets other verticals or venue Básico', async () => {
        const { ctx, statements } = makeCtx([
            { create_promotions_inserted: 4, max_active_promotions_inserted: 4 },
            { create_promotions_inserted: 0, max_active_promotions_inserted: 0 }
        ]);
        const first = await migration.up(ctx);
        const second = await migration.up(ctx);

        expect(first.counts).toEqual({
            createPromotionsInserted: 4,
            maxActivePromotionsInserted: 4
        });
        expect(second.counts).toEqual({
            createPromotionsInserted: 0,
            maxActivePromotionsInserted: 0
        });
        for (const grant of [statements[1], statements[4]]) {
            expect(grant).toContain("where pv.vertical = 'venue'");
            expect(grant).toContain("p.slug in ('venue-pro', 'venue-premium')");
            expect(grant).not.toContain('venue-basico');
            expect(grant).not.toContain('accommodation');
            expect(grant).not.toContain('experience');
        }
    });
});
