import { describe, expect, it, vi } from 'vitest';
import * as migration from '../../src/data-migrations/0168-hos-2105-faq-draft-plan-version-grant.js';
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

function makeCtx(counts: Record<string, number> = {}) {
    const statements: string[] = [];
    const execute = vi.fn(async (query: unknown) => {
        statements.push(flatten(query));
        return { rows: [counts] };
    });
    const ctx = {
        db: { execute },
        actor: {},
        models: {},
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
    return { ctx, execute, statements };
}

describe('0168-hos-2105-faq-draft-plan-version-grant', () => {
    it('scopes grants by eligible vertical and plan slug, applies tier quotas, and skips existing limits', async () => {
        const { ctx, statements } = makeCtx({
            versions_granted: 1,
            entitlements_inserted: 1,
            limits_inserted: 1
        });
        const result = await migration.up(ctx);
        const grant = statements[1] ?? '';
        expect(grant).toContain("'owner-basico' then 50");
        expect(grant).toContain("'venue-pro' then 250");
        expect(grant).toContain("'experience-premium' then 1250");
        expect(grant).toContain("pv.vertical in ('accommodation', 'venue', 'experience')");
        expect(grant).toContain(
            "where l.plan_version_id = pv.id and l.key = 'max_ai_faq_draft_per_month'"
        );
        expect(grant).toContain("where x.plan_version_id = e.id and x.key = 'ai_faq_draft'");
        expect(result.counts).toEqual({
            versionsGranted: 1,
            entitlementsInserted: 1,
            limitsInserted: 1
        });
    });

    it('sets and resets the transaction-local additive grant signal and reports a second run as a no-op', async () => {
        const { ctx, statements } = makeCtx({
            versions_granted: 0,
            entitlements_inserted: 0,
            limits_inserted: 0
        });
        const result = await migration.up(ctx);
        expect(statements[0]).toContain(
            "set_config('hospeda.catalog_additive_grant', 'HOS-2105', true)"
        );
        expect(statements[2]).toContain("set_config('hospeda.catalog_additive_grant', '', true)");
        expect(result.counts).toEqual({
            versionsGranted: 0,
            entitlementsInserted: 0,
            limitsInserted: 0
        });
    });

    it('does not select non-tier plans', async () => {
        const { ctx, statements } = makeCtx();
        await migration.up(ctx);
        const grant = statements[1] ?? '';
        expect(grant).not.toContain("'floor'");
        expect(grant).not.toContain("'trial'");
        expect(grant).not.toContain("'partner'");
        expect(grant).not.toContain("'tourist'");
    });
});
