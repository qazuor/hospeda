/**
 * HOS-919 T-012 -- the provider trade category catalog baseline.
 *
 * Reads the 5 group and 29 category fixtures off disk and checks the catalog
 * invariants the spec fixes (section 11): counts, slugs, group references,
 * i18n names, keyword bounds and deterministic ids.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    HostTradeCategoryCreateInputSchema,
    HostTradeCategoryGroupCreateInputSchema
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import requiredManifest from '../src/manifest-required.json';
import {
    hostTradeCategoryGroupIdFor,
    hostTradeCategoryIdFor
} from '../src/required/hostTradeCategories.seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '../src/data');

interface GroupFixture {
    readonly id: string;
    readonly slug: string;
    readonly nameI18n: { readonly es: string; readonly en: string; readonly pt: string };
    readonly displayWeight: number;
}

interface CategoryFixture extends GroupFixture {
    readonly groupSlug: string;
    readonly keywordsI18n: { readonly es?: readonly string[] };
}

const readFolder = <T>(folder: string): readonly T[] =>
    readdirSync(join(DATA, folder))
        .filter((file) => file.endsWith('.json'))
        .sort()
        .map((file) => JSON.parse(readFileSync(join(DATA, folder, file), 'utf-8')) as T);

const groups = readFolder<GroupFixture>('hostTradeCategoryGroup');
const categories = readFolder<CategoryFixture>('hostTradeCategory');
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('HOS-919 catalog baseline', () => {
    it('ships 5 groups and 29 categories', () => {
        expect(groups).toHaveLength(5);
        expect(categories).toHaveLength(29);
    });

    it('registers every fixture file in the required manifest', () => {
        const groupFiles = readdirSync(join(DATA, 'hostTradeCategoryGroup')).sort();
        const categoryFiles = readdirSync(join(DATA, 'hostTradeCategory')).sort();
        expect([...requiredManifest.hostTradeCategoryGroups].sort()).toEqual(groupFiles);
        expect([...requiredManifest.hostTradeCategories].sort()).toEqual(categoryFiles);
    });

    it('has unique kebab-case slugs', () => {
        for (const list of [groups, categories]) {
            const slugs = list.map((item) => item.slug);
            expect(new Set(slugs).size).toBe(slugs.length);
            for (const slug of slugs) {
                expect(slug).toMatch(KEBAB);
            }
        }
    });

    it('points every category at an existing group', () => {
        const groupSlugs = new Set(groups.map((group) => group.slug));
        for (const category of categories) {
            expect(groupSlugs.has(category.groupSlug), category.slug).toBe(true);
        }
    });

    it('has a non-blank es, en and pt name everywhere', () => {
        for (const item of [...groups, ...categories]) {
            expect(item.nameI18n.es.trim().length, item.slug).toBeGreaterThan(0);
            expect(item.nameI18n.en.trim().length, item.slug).toBeGreaterThan(0);
            expect(item.nameI18n.pt.trim().length, item.slug).toBeGreaterThan(0);
        }
    });

    it('uses display weights in steps of 10 following file order', () => {
        expect(groups.map((g) => g.displayWeight)).toEqual([10, 20, 30, 40, 50]);
        for (const group of groups) {
            const inGroup = categories.filter((c) => c.groupSlug === group.slug);
            expect(inGroup.length, group.slug).toBeGreaterThan(0);
            expect(inGroup.map((c) => c.displayWeight)).toEqual(
                inGroup.map((_, index) => (index + 1) * 10)
            );
        }
    });

    it('keeps es keywords inside the schema bounds and leaves en/pt empty', () => {
        for (const category of categories) {
            const keywords = category.keywordsI18n.es ?? [];
            expect(keywords.length, category.slug).toBeGreaterThan(0);
            expect(keywords.length, category.slug).toBeLessThanOrEqual(30);
            for (const word of keywords) {
                expect(word.length).toBeLessThanOrEqual(40);
                expect(word).toBe(word.toLowerCase());
            }
            expect(Object.keys(category.keywordsI18n)).toEqual(['es']);
        }
    });

    it('finds the drain category by "pozo ciego" (AC-1.2)', () => {
        const drain = categories.find((c) => c.slug === 'destapaciones-desagotes');
        expect(drain?.keywordsI18n.es).toContain('pozo ciego');
    });

    it('derives valid, unique and stable UUIDv5 ids from the slug', () => {
        const ids = [
            ...groups.map((g) => hostTradeCategoryGroupIdFor({ slug: g.slug })),
            ...categories.map((c) => hostTradeCategoryIdFor({ slug: c.slug }))
        ];
        for (const id of ids) {
            expect(id).toMatch(UUID);
        }
        expect(new Set(ids).size).toBe(ids.length);
        expect(hostTradeCategoryIdFor({ slug: 'plomeria' })).toBe(
            hostTradeCategoryIdFor({ slug: 'plomeria' })
        );
    });

    it('produces payloads the create schemas accept', () => {
        const zeroId = '00000000-0000-4000-8000-000000000000';
        for (const group of groups) {
            const { id: _id, ...rest } = group;
            const result = HostTradeCategoryGroupCreateInputSchema.safeParse({
                ...rest,
                lifecycleState: 'ACTIVE'
            });
            expect(result.success, group.slug).toBe(true);
        }
        for (const category of categories) {
            const { id: _id, groupSlug: _groupSlug, ...rest } = category;
            const result = HostTradeCategoryCreateInputSchema.safeParse({
                ...rest,
                groupId: zeroId,
                lifecycleState: 'ACTIVE'
            });
            expect(result.success, category.slug).toBe(true);
        }
    });
});
