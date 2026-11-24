import { describe, expect, it, vi } from 'vitest';
import {
    PRODUCTION_PLAN_FREE_VISIBLE_PROMOTIONS_LIMIT,
    PRODUCTION_PLAN_VIP_ONLY_PROMOTIONS_GRANTS
} from '../../src/catalog/next-version-entitlements.js';
import * as migration from '../../src/data-migrations/0191-hos-2589-promotion-keys-grant.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

function flatten(node: unknown, depth = 0): string {
    if (depth > 14 || node == null) return '';
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
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

describe('0191-hos-2589-promotion-keys-grant', () => {
    it('is content-only, so a fresh database runs it instead of baseline-stamping it', () => {
        expect(migration.meta.contentOnly).toBe(true);
        expect(migration.meta.destructive).toBe(false);
    });

    it('grants vip_only_promotions to every accommodation and venue owner plan (D-4)', async () => {
        // Arrange
        const { ctx, statements } = makeCtx([
            { vip_only_promotions_inserted: 6, max_free_visible_promotions_inserted: 1 }
        ]);

        // Act
        const result = await migration.up(ctx);
        const grant = statements[1] ?? '';

        // Assert
        expect(PRODUCTION_PLAN_VIP_ONLY_PROMOTIONS_GRANTS.map((g) => g.slug)).toEqual([
            'owner-basico',
            'owner-pro',
            'owner-premium',
            'venue-basico',
            'venue-pro',
            'venue-premium'
        ]);
        for (const { vertical, slug } of PRODUCTION_PLAN_VIP_ONLY_PROMOTIONS_GRANTS) {
            expect(grant).toContain(vertical);
            expect(grant).toContain(slug);
        }
        expect(grant).toContain("'vip_only_promotions', null, null");
        expect(grant).toContain("existing.key = 'vip_only_promotions'");
        expect(grant).not.toContain('experience');
        expect(result.counts).toEqual({
            vipOnlyPromotionsInserted: 6,
            maxFreeVisiblePromotionsInserted: 1
        });
    });

    it('writes the free quota as a limit row on the tourist floor plan (M-4)', async () => {
        const { ctx, statements } = makeCtx();
        await migration.up(ctx);
        const grant = statements[1] ?? '';

        expect(PRODUCTION_PLAN_FREE_VISIBLE_PROMOTIONS_LIMIT.vertical).toBe('tourist');
        expect(PRODUCTION_PLAN_FREE_VISIBLE_PROMOTIONS_LIMIT.slug).toBe('floor');
        expect(PRODUCTION_PLAN_FREE_VISIBLE_PROMOTIONS_LIMIT.limit.key).toBe(
            'max_free_visible_promotions'
        );
        expect(grant).toContain('insert into plan_version_limit');
        expect(grant).toContain(String(PRODUCTION_PLAN_FREE_VISIBLE_PROMOTIONS_LIMIT.limit.value));
    });

    it('uses and clears the transaction-local grant signal and is a no-op on a second run', async () => {
        const { ctx, statements } = makeCtx([
            { vip_only_promotions_inserted: 6, max_free_visible_promotions_inserted: 1 },
            { vip_only_promotions_inserted: 0, max_free_visible_promotions_inserted: 0 }
        ]);
        await migration.up(ctx);
        const second = await migration.up(ctx);

        expect(statements[0]).toContain(
            "set_config('hospeda.catalog_additive_grant', 'HOS-2589', true)"
        );
        expect(statements[2]).toContain("set_config('hospeda.catalog_additive_grant', '', true)");
        expect(second.counts).toEqual({
            vipOnlyPromotionsInserted: 0,
            maxFreeVisiblePromotionsInserted: 0
        });
    });
});
