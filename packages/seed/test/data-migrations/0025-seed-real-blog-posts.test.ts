/**
 * @fileoverview
 * Unit tests for the `0025-seed-real-blog-posts` data migration.
 *
 * Two layers, both mirroring the "mock the ctx, no real DB" style of
 * `0019-backfill-example-partners.test.ts`:
 *
 * 1. **Fixture schema validation** — every article JSON under
 *    `data/real-blog-posts/` is loaded FOR REAL and validated against the
 *    same source-of-truth schemas the API response uses (`SeoSchema`,
 *    `PostCategoryEnumSchema`) plus the `PostSchema` field bounds. This is
 *    the regression guard for the real bug found in review: a `seo.description`
 *    of 162 chars inserts fine (the model-direct path skips Zod) but 500s the
 *    public read endpoint, which strips the response through `SeoSchema`
 *    (max 160). The DB never complains; only this test (and the live read) do.
 *
 * 2. **Migration behavior** — `up()` runs against a fully mocked ctx and must
 *    create the editorial author exactly once, create every article, resolve
 *    destination links by slug (leaving unknown slugs null), and be idempotent
 *    on a second run.
 *
 * @module test/data-migrations/0025-seed-real-blog-posts
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostCategoryEnumSchema, RoleEnum, SeoSchema } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeEach, describe, expect, it } from 'vitest';
import * as postsMigration from '../../src/data-migrations/0025-seed-real-blog-posts.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const FIXTURE_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../src/data-migrations/data/real-blog-posts'
);

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Field bounds mirrored from `PostSchema` (`@repo/schemas`). */
const BOUNDS = {
    title: [3, 150],
    summary: [10, 300],
    content: [100, 50000]
} as const;

interface RealPostFixture {
    slug: string;
    category: string;
    title: string;
    summary: string;
    content: string;
    relatedDestinationSlug: string | null;
    seo: { title: string; description: string };
    readingTimeMinutes: number;
    publishedAt: string;
    isFeatured: boolean;
    isFeaturedInWebsite: boolean;
    featuredImageCaption: string;
    featuredImageAlt: string;
}

function loadFixtures(): { file: string; data: RealPostFixture }[] {
    return readdirSync(FIXTURE_DIR)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((file) => ({
            file,
            data: JSON.parse(readFileSync(path.join(FIXTURE_DIR, file), 'utf-8')) as RealPostFixture
        }));
}

const EXPECTED_POST_COUNT = 9;
/** Destination slugs the fixtures link to that exist in the required seed. */
const KNOWN_DESTINATION_SLUGS = new Set([
    'federacion',
    'gualeguaychu',
    'concepcion-del-uruguay',
    'colon'
]);

describe('0025-seed-real-blog-posts — fixture integrity', () => {
    const fixtures = loadFixtures();

    it('ships exactly the expected number of articles', () => {
        expect(fixtures).toHaveLength(EXPECTED_POST_COUNT);
    });

    it.each(loadFixtures())('$file — seo passes the response SeoSchema', ({ data }) => {
        // The exact validation the public read endpoint applies. Guards the
        // seo.title (30-60) and seo.description (70-160) length bounds that a
        // model-direct insert would otherwise let through until read time.
        expect(() => SeoSchema.parse(data.seo)).not.toThrow();
    });

    it.each(loadFixtures())('$file — category is a valid PostCategoryEnum', ({ data }) => {
        expect(() => PostCategoryEnumSchema.parse(data.category)).not.toThrow();
    });

    it.each(loadFixtures())('$file — title/summary/content within PostSchema bounds', ({
        data
    }) => {
        for (const [field, [min, max]] of Object.entries(BOUNDS)) {
            const len = [...(data[field as keyof typeof BOUNDS] as string)].length;
            expect(len, `${field} length`).toBeGreaterThanOrEqual(min);
            expect(len, `${field} length`).toBeLessThanOrEqual(max);
        }
    });

    it.each(loadFixtures())('$file — slug and destination slug are kebab-case', ({ data }) => {
        expect(data.slug).toMatch(SLUG_REGEX);
        if (data.relatedDestinationSlug !== null) {
            expect(data.relatedDestinationSlug).toMatch(SLUG_REGEX);
        }
    });

    it.each(loadFixtures())('$file — publishedAt is a valid date', ({ data }) => {
        expect(Number.isNaN(Date.parse(data.publishedAt))).toBe(false);
    });

    it('has unique slugs across all articles', () => {
        const slugs = fixtures.map((f) => f.data.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
    });
});

const STUB_ACTOR: Actor = {
    id: 'actor-stub-real-blog-posts-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

interface Row {
    id: string;
    slug?: string;
    email?: string;
    displayName?: string;
    relatedDestinationId?: string | null;
}

function buildUserModelClass(store: Map<string, Row>) {
    return class {
        async findOne(where: { email: string }) {
            return store.get(`user:${where.email}`) ?? null;
        }
        async create(data: { email: string; displayName?: string }) {
            const row: Row = { id: `user-${data.email}`, ...data };
            store.set(`user:${data.email}`, row);
            return row;
        }
    };
}

function buildPostModelClass(store: Map<string, Row>, created: Row[]) {
    return class {
        async findOne(where: { slug: string }) {
            return store.get(`post:${where.slug}`) ?? null;
        }
        async create(data: Row & { slug: string }) {
            const row: Row = { id: `post-${data.slug}`, ...data };
            store.set(`post:${data.slug}`, row);
            created.push(row);
            return row;
        }
    };
}

function buildDestinationModelClass() {
    return class {
        async findOne(where: { slug: string }) {
            return KNOWN_DESTINATION_SLUGS.has(where.slug)
                ? { id: `dest-${where.slug}`, slug: where.slug }
                : null;
        }
    };
}

function buildCtx(store: Map<string, Row>, created: Row[]): SeedMigrationCtx {
    return {
        db: {} as SeedMigrationCtx['db'],
        actor: STUB_ACTOR,
        models: {
            UserModel: buildUserModelClass(store),
            PostModel: buildPostModelClass(store, created),
            DestinationModel: buildDestinationModelClass()
        } as unknown as SeedMigrationCtx['models'],
        services: {} as SeedMigrationCtx['services'],
        helpers: { safeDelete: async () => ({ deleted: true }) }
    };
}

describe('0025-seed-real-blog-posts — up()', () => {
    let store: Map<string, Row>;
    let created: Row[];

    beforeEach(() => {
        store = new Map();
        created = [];
    });

    it('creates the editorial author and every article on first run', async () => {
        const result = await postsMigration.up(buildCtx(store, created));

        expect(store.has('user:editorial@hospeda.com.ar')).toBe(true);
        expect(created).toHaveLength(EXPECTED_POST_COUNT);
        expect(result.counts?.postsCreated).toBe(EXPECTED_POST_COUNT);
        expect(result.counts?.postsSkipped).toBe(0);
    });

    it('resolves the four known destination links and leaves the rest null', async () => {
        const result = await postsMigration.up(buildCtx(store, created));

        const withDest = created.filter((p) => p.relatedDestinationId != null);
        expect(withDest).toHaveLength(KNOWN_DESTINATION_SLUGS.size);
        expect(result.counts?.destinationLinksResolved).toBe(KNOWN_DESTINATION_SLUGS.size);
        expect(result.counts?.destinationLinksMissing).toBe(0);
    });

    it('is idempotent — a second run creates nothing and no duplicate author', async () => {
        await postsMigration.up(buildCtx(store, created));
        created.length = 0;
        const second = await postsMigration.up(buildCtx(store, created));

        expect(created).toHaveLength(0);
        expect(second.counts?.postsCreated).toBe(0);
        expect(second.counts?.postsSkipped).toBe(EXPECTED_POST_COUNT);
    });
});
