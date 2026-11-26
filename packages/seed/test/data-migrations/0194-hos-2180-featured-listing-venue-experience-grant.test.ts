import { describe, expect, it, vi } from 'vitest';
import { PRODUCTION_PLAN_FEATURED_LISTING_GRANTS } from '../../src/catalog/next-version-entitlements.js';
import * as migration from '../../src/data-migrations/0194-hos-2180-featured-listing-venue-experience-grant.js';
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

describe('0194-hos-2180-featured-listing-venue-experience-grant', () => {
    it('is content-only, so a fresh database runs it instead of baseline-stamping it', () => {
        expect(migration.meta.contentOnly).toBe(true);
        expect(migration.meta.destructive).toBe(false);
    });

    it('lists the venue and experience Pro and Premium plans only (PM-641)', () => {
        // Arrange
        const pairs = PRODUCTION_PLAN_FEATURED_LISTING_GRANTS.map(
            ({ vertical, slug }) => `${vertical}/${slug}`
        );

        // Assert
        expect(pairs).toEqual([
            'venue/venue-pro',
            'venue/venue-premium',
            'experience/experience-pro',
            'experience/experience-premium'
        ]);
        const slugs = PRODUCTION_PLAN_FEATURED_LISTING_GRANTS.map((g) => g.slug as string);
        expect(slugs).not.toContain('trial');
        expect(slugs).not.toContain('floor');
        const verticals = PRODUCTION_PLAN_FEATURED_LISTING_GRANTS.map((g) => g.vertical as string);
        expect(verticals).not.toContain('tourist');
        expect(verticals).not.toContain('partner');
        expect(verticals).not.toContain('accommodation');
    });

    it('inserts boolean rows (no plan or trial quota) for every listed plan', async () => {
        // Arrange
        const { ctx, statements } = makeCtx([{ featured_listing_inserted: 4 }]);

        // Act
        const result = await migration.up(ctx);
        const grant = statements[1] ?? '';

        // Assert
        for (const { vertical, slug } of PRODUCTION_PLAN_FEATURED_LISTING_GRANTS) {
            expect(grant).toContain(vertical);
            expect(grant).toContain(slug);
        }
        expect(grant).toContain('insert into plan_version_entitlement');
        expect(grant).toContain("'featured_listing', null, null");
        expect(grant).toContain("existing.key = 'featured_listing'");
        expect(grant).not.toContain('plan_version_limit');
        expect(result.counts).toEqual({ featuredListingInserted: 4 });
    });

    it('uses and clears the transaction-local grant signal and is a no-op on a second run', async () => {
        // Arrange
        const { ctx, statements } = makeCtx([
            { featured_listing_inserted: 4 },
            { featured_listing_inserted: 0 }
        ]);

        // Act
        await migration.up(ctx);
        const second = await migration.up(ctx);

        // Assert
        expect(statements[0]).toContain(
            "set_config('hospeda.catalog_additive_grant', 'HOS-2180', true)"
        );
        expect(statements[2]).toContain("set_config('hospeda.catalog_additive_grant', '', true)");
        expect(second.counts).toEqual({ featuredListingInserted: 0 });
    });
});
