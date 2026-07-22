/**
 * @fileoverview
 * Unit tests for the `0019-backfill-example-partners` data migration, using
 * a fully mocked `ctx.models.PartnerModel` (no real database connection) —
 * the same "mock the ctx, no real DB" style
 * `0009-hos-113-points-of-interest.test.ts` uses.
 *
 * Fixture data is loaded FOR REAL from `src/data/partner/*.json`, so a drift
 * between this test's expectations and the actual fixture content (e.g.
 * someone adding a 7th partner without updating this migration's frozen
 * file list) surfaces as a real test failure rather than silently passing
 * against a stale hand-copied fixture.
 *
 * @module test/data-migrations/0019-backfill-example-partners
 */
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as partnersMigration from '../../src/data-migrations/0019-backfill-example-partners.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos172-partners-migration-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/** Total example partner fixture count (SPEC-271 / HOS-172). */
const EXPECTED_TOTAL_PARTNERS = 6;

/**
 * Builds a mock `PartnerModel`-shaped class backed by an in-memory
 * `slug -> row` store the test can seed/inspect across calls.
 */
function buildPartnerModelClass(store: Map<string, { id: string; slug: string }>) {
    return class {
        async findOne(where: { slug: string }) {
            return store.get(where.slug) ?? null;
        }
        async create(data: { slug: string }) {
            const row = { id: `partner-${data.slug}`, ...data };
            store.set(data.slug, row);
            return row;
        }
    };
}

/**
 * Builds a fully mocked `SeedMigrationCtx` around a fresh, empty in-memory
 * store. `ctx.db` is never dereferenced directly by this migration (it is
 * only forwarded as the `tx` argument to mocked model methods, which ignore
 * it), so an empty object stub is sufficient.
 */
function buildCtx(store: Map<string, { id: string; slug: string }>): SeedMigrationCtx {
    return {
        db: {},
        actor: STUB_ACTOR,
        models: {
            PartnerModel: buildPartnerModelClass(store)
        },
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
}

describe('0019-backfill-example-partners', () => {
    it('creates all 6 example partners on a first run', async () => {
        // Arrange
        const store = new Map<string, { id: string; slug: string }>();
        const ctx = buildCtx(store);

        // Act
        const result = await partnersMigration.up(ctx);

        // Assert
        expect(result.counts).toEqual({
            partnersCreated: EXPECTED_TOTAL_PARTNERS,
            partnersSkipped: 0
        });
        expect(store.size).toBe(EXPECTED_TOTAL_PARTNERS);
        expect(result.summary).toMatch(/6 partner\(s\) created/);
    });

    it('is idempotent: a second run against an already-populated store creates nothing', async () => {
        // Arrange — run once to populate the store, exactly like re-running the migration
        // against an environment where it already applied.
        const store = new Map<string, { id: string; slug: string }>();
        const ctx = buildCtx(store);
        await partnersMigration.up(ctx);

        // Act — run again against the SAME ctx/store.
        const result = await partnersMigration.up(ctx);

        // Assert
        expect(result.counts).toEqual({
            partnersCreated: 0,
            partnersSkipped: EXPECTED_TOTAL_PARTNERS
        });
    });

    it('skips only the partners that already exist, leaving the rest to be created', async () => {
        // Arrange — pre-seed exactly one of the 6 fixtures, simulating a partial prior run.
        const store = new Map<string, { id: string; slug: string }>([
            ['autoservice-litoral', { id: 'existing-partner-id', slug: 'autoservice-litoral' }]
        ]);
        const ctx = buildCtx(store);

        // Act
        const result = await partnersMigration.up(ctx);

        // Assert
        expect(result.counts).toEqual({
            partnersCreated: EXPECTED_TOTAL_PARTNERS - 1,
            partnersSkipped: 1
        });
        expect(store.size).toBe(EXPECTED_TOTAL_PARTNERS);
        // The pre-existing row is untouched, not overwritten.
        expect(store.get('autoservice-litoral')).toEqual({
            id: 'existing-partner-id',
            slug: 'autoservice-litoral'
        });
    });

    it('converts startsAt/endsAt to real Date instances on the inserted rows', async () => {
        // Arrange
        const store = new Map<string, { id: string; slug: string }>();
        const ctx = buildCtx(store);

        // Act
        await partnersMigration.up(ctx);

        // Assert — every fixture declares startsAt; endsAt is optional per fixture.
        for (const row of store.values()) {
            const typedRow = row as unknown as { startsAt: unknown; endsAt: unknown };
            expect(typedRow.startsAt).toBeInstanceOf(Date);
            if (typedRow.endsAt !== undefined) {
                expect(typedRow.endsAt).toBeInstanceOf(Date);
            }
        }
    });
});
