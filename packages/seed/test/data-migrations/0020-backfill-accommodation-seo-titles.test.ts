/**
 * @fileoverview
 * Unit tests for the `0020-backfill-accommodation-seo-titles` data
 * migration, using a fully mocked `ctx.models.AccommodationModel` (no real
 * database connection) — the same "mock the ctx, no real DB" style
 * `0009-hos-113-points-of-interest.test.ts` uses.
 *
 * @module test/data-migrations/0020-backfill-accommodation-seo-titles
 */
import type { Seo } from '@repo/schemas';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as seoMigration from '../../src/data-migrations/0020-backfill-accommodation-seo-titles.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-beta175-seo-title-migration-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/** One of the 13 real (slug, oldTitle, newTitle) triplets this migration targets. */
const SAMPLE_SLUG = 'cabana-del-rio-colon';
const SAMPLE_OLD_TITLE = 'Cabaña del Río - Alojamiento a 300m del río Uruguay en';
const SAMPLE_NEW_TITLE = 'Cabaña del Río - A 300m del río Uruguay en Colón';
const SAMPLE_DESCRIPTION =
    'Acogedora cabaña para 4 personas cerca del río Uruguay en Colón, con galería, asador y jardín privado.';

interface AccommodationRow {
    readonly id: string;
    readonly slug: string;
    readonly seo?: Seo | null;
}

/**
 * Builds a mock `AccommodationModel`-shaped class backed by an in-memory
 * `slug -> row` store the test can seed/inspect across calls, mirroring the
 * real `BaseModelImpl.findOne`/`update` signatures the migration calls.
 */
function buildAccommodationModelClass(store: Map<string, AccommodationRow>) {
    return class {
        async findOne(where: { slug: string }) {
            return store.get(where.slug) ?? null;
        }
        async update(where: { slug: string }, data: Partial<AccommodationRow>) {
            const existing = store.get(where.slug);
            if (!existing) return null;
            const updated = { ...existing, ...data };
            store.set(where.slug, updated);
            return updated;
        }
    };
}

/** Builds a fully mocked `SeedMigrationCtx` around a fresh in-memory accommodation store. */
function buildCtx(store: Map<string, AccommodationRow>): SeedMigrationCtx {
    return {
        db: {},
        actor: STUB_ACTOR,
        models: {
            AccommodationModel: buildAccommodationModelClass(store)
        },
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
}

describe('0020-backfill-accommodation-seo-titles', () => {
    it('updates a truncated seo.title to the new rewritten value', async () => {
        // Arrange
        const store = new Map<string, AccommodationRow>([
            [
                SAMPLE_SLUG,
                {
                    id: 'acc-1',
                    slug: SAMPLE_SLUG,
                    seo: { title: SAMPLE_OLD_TITLE, description: SAMPLE_DESCRIPTION }
                }
            ]
        ]);
        const ctx = buildCtx(store);

        // Act
        const result = await seoMigration.up(ctx);

        // Assert
        expect(store.get(SAMPLE_SLUG)?.seo?.title).toBe(SAMPLE_NEW_TITLE);
        expect(result.counts?.updated).toBe(1);
    });

    it('is idempotent: skips a row whose seo.title is already the new value', async () => {
        // Arrange — a store where the sample row already carries the NEW title
        // (e.g. a second run of this same migration).
        const store = new Map<string, AccommodationRow>([
            [
                SAMPLE_SLUG,
                {
                    id: 'acc-1',
                    slug: SAMPLE_SLUG,
                    seo: { title: SAMPLE_NEW_TITLE, description: SAMPLE_DESCRIPTION }
                }
            ]
        ]);
        const ctx = buildCtx(store);

        // Act
        const result = await seoMigration.up(ctx);

        // Assert — title untouched, counted as already-correct, never re-updated.
        expect(store.get(SAMPLE_SLUG)?.seo?.title).toBe(SAMPLE_NEW_TITLE);
        expect(result.counts?.updated).toBe(0);
        expect(result.counts?.alreadyCorrect).toBeGreaterThan(0);
    });

    it('skips a target accommodation whose slug does not exist in the DB', async () => {
        // Arrange — empty store: none of the 13 targeted slugs are present.
        const store = new Map<string, AccommodationRow>();
        const ctx = buildCtx(store);

        // Act
        const result = await seoMigration.up(ctx);

        // Assert — all 13 targets counted as not-found, none updated.
        expect(result.counts?.updated).toBe(0);
        expect(result.counts?.notFound).toBe(13);
    });

    it('preserves seo.description (and other sibling keys) — only title changes', async () => {
        // Arrange — a seo object carrying description plus a legacy `keywords` key.
        // `keywords` is not part of the current `Seo` type (stripped by `SeoSchema`),
        // but a legacy stored row may still carry it in the raw JSONB — built as a
        // plain record and cast, so this doesn't trip an excess-property literal check.
        const seoWithLegacyKeywords: Record<string, unknown> = {
            title: SAMPLE_OLD_TITLE,
            description: SAMPLE_DESCRIPTION,
            keywords: ['cabaña', 'colón', 'entre ríos']
        };
        const store = new Map<string, AccommodationRow>([
            [
                SAMPLE_SLUG,
                {
                    id: 'acc-1',
                    slug: SAMPLE_SLUG,
                    seo: seoWithLegacyKeywords as unknown as Seo
                }
            ]
        ]);
        const ctx = buildCtx(store);

        // Act
        await seoMigration.up(ctx);

        // Assert
        const updatedSeo = store.get(SAMPLE_SLUG)?.seo as
            | (Seo & { keywords?: string[] })
            | undefined;
        expect(updatedSeo?.title).toBe(SAMPLE_NEW_TITLE);
        expect(updatedSeo?.description).toBe(SAMPLE_DESCRIPTION);
        expect(updatedSeo?.keywords).toEqual(['cabaña', 'colón', 'entre ríos']);
    });

    it('counts all 13 target accommodations correctly when only some exist', async () => {
        // Arrange — only 2 of the 13 targeted slugs exist in the store.
        const store = new Map<string, AccommodationRow>([
            [
                'cabana-del-rio-colon',
                {
                    id: 'acc-1',
                    slug: 'cabana-del-rio-colon',
                    seo: {
                        title: 'Cabaña del Río - Alojamiento a 300m del río Uruguay en',
                        description: SAMPLE_DESCRIPTION
                    }
                }
            ],
            [
                'refugio-relajante-hotel-concordia',
                {
                    id: 'acc-2',
                    slug: 'refugio-relajante-hotel-concordia',
                    // Already independently edited by an operator to something else entirely.
                    seo: {
                        title: 'Custom operator title for Concordia hotel here',
                        description: 'x'
                    }
                }
            ]
        ]);
        const ctx = buildCtx(store);

        // Act
        const result = await seoMigration.up(ctx);

        // Assert
        expect(result.counts?.updated).toBe(1);
        expect(result.counts?.alreadyCorrect).toBe(1);
        expect(result.counts?.notFound).toBe(11);
    });
});
