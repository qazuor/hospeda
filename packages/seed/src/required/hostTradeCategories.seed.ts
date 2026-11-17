import { HostTradeCategoryGroupModel, HostTradeCategoryModel } from '@repo/db';
import { HostTradeCategoryGroupService, HostTradeCategoryService } from '@repo/service-core';
import requiredManifest from '../manifest-required.json';
import { deterministicFixtureId } from '../utils/deterministicFixtureId.js';
import { createSeedFactory, whereFixtureSlug } from '../utils/index.js';
import type { SeedContext } from '../utils/seedContext.js';

/**
 * Derives the stable UUIDv5 of a catalog group from its (immutable) slug.
 *
 * The id depends on the slug and nothing else, so the baseline seeder and the
 * data-migration (HOS-919) assign the same id to the same row and a category
 * can reference its group without a lookup. Slugs are immutable (spec D8), which
 * is what makes them safe to derive an id from.
 *
 * @param input - Object holding the group slug
 * @returns Canonical UUIDv5 string
 *
 * @example
 * ```ts
 * hostTradeCategoryGroupIdFor({ slug: 'instalaciones' }); // same UUID on every machine
 * ```
 */
export function hostTradeCategoryGroupIdFor(input: { readonly slug: string }): string {
    return deterministicFixtureId({ seedKey: `hostTradeCategoryGroup:${input.slug}` });
}

/**
 * Derives the stable UUIDv5 of a catalog category from its (immutable) slug.
 *
 * @param input - Object holding the category slug
 * @returns Canonical UUIDv5 string
 *
 * @example
 * ```ts
 * hostTradeCategoryIdFor({ slug: 'plomeria' }); // same UUID on every machine
 * ```
 */
export function hostTradeCategoryIdFor(input: { readonly slug: string }): string {
    return deterministicFixtureId({ seedKey: `hostTradeCategory:${input.slug}` });
}

/** Raw group fixture, as stored under `src/data/hostTradeCategoryGroup/`. */
export interface HostTradeCategoryGroupFixture {
    readonly $schema?: string;
    readonly id: string;
    readonly slug: string;
    readonly [key: string]: unknown;
}

/** Raw category fixture, as stored under `src/data/hostTradeCategory/`. */
export interface HostTradeCategoryFixture {
    readonly $schema?: string;
    readonly id: string;
    readonly slug: string;
    readonly groupSlug: string;
    readonly [key: string]: unknown;
}

/**
 * Turns a raw group fixture into the row payload to insert: drops the
 * seed-only keys (`$schema`, fixture `id`) and sets the deterministic `id`.
 *
 * Shared by the baseline seeder and the data-migration so the two cannot drift.
 *
 * @param data - Raw fixture item
 * @returns Row payload including the deterministic `id`
 */
export const normalizeHostTradeCategoryGroupSeedItem = (
    data: Record<string, unknown>
): Record<string, unknown> => {
    const { $schema, id, ...rest } = data as { $schema?: string; id?: string; slug: string };
    return { ...rest, id: hostTradeCategoryGroupIdFor({ slug: rest.slug }) };
};

/**
 * Turns a raw category fixture into the row payload to insert: drops the
 * seed-only keys, resolves `groupSlug` to the group's deterministic id and
 * sets the category's own deterministic `id`.
 *
 * @param data - Raw fixture item
 * @returns Row payload including `id` and `groupId`
 */
export const normalizeHostTradeCategorySeedItem = (
    data: Record<string, unknown>
): Record<string, unknown> => {
    const { $schema, id, groupSlug, ...rest } = data as {
        $schema?: string;
        id?: string;
        groupSlug: string;
        slug: string;
    };
    return {
        ...rest,
        id: hostTradeCategoryIdFor({ slug: rest.slug }),
        groupId: hostTradeCategoryGroupIdFor({ slug: groupSlug })
    };
};

const getEntityInfo = (item: unknown, _context: SeedContext): string => {
    const row = item as { slug: string; nameI18n?: { es?: string } };
    return `"${row.slug}" (${row.nameI18n?.es ?? row.slug})`;
};

/**
 * Seeds the provider trade category groups (HOS-919).
 *
 * Rows are inserted straight through the model with a deterministic id (the
 * factory's `deterministicId` path), so a fresh database and the data-migration
 * agree on every id. Re-runnable: a slug that already exists is skipped and an
 * admin's edits to it are never overwritten.
 */
export const seedHostTradeCategoryGroups = createSeedFactory({
    entityName: 'HostTradeCategoryGroups',
    serviceClass: HostTradeCategoryGroupService,
    folder: 'src/data/hostTradeCategoryGroup',
    files: requiredManifest.hostTradeCategoryGroups,
    existing: { modelClass: HostTradeCategoryGroupModel, getWhere: whereFixtureSlug() },
    normalizer: normalizeHostTradeCategoryGroupSeedItem,
    deterministicId: {
        modelClass: HostTradeCategoryGroupModel,
        getId: (item) => hostTradeCategoryGroupIdFor({ slug: (item as { slug: string }).slug })
    },
    getEntityInfo
});

/**
 * Seeds the provider trade categories (HOS-919). Must run after
 * {@link seedHostTradeCategoryGroups}: every category references its group by
 * the group's deterministic id.
 */
export const seedHostTradeCategories = createSeedFactory({
    entityName: 'HostTradeCategories',
    serviceClass: HostTradeCategoryService,
    folder: 'src/data/hostTradeCategory',
    files: requiredManifest.hostTradeCategories,
    existing: { modelClass: HostTradeCategoryModel, getWhere: whereFixtureSlug() },
    normalizer: normalizeHostTradeCategorySeedItem,
    deterministicId: {
        modelClass: HostTradeCategoryModel,
        getId: (item) => hostTradeCategoryIdFor({ slug: (item as { slug: string }).slug })
    },
    getEntityInfo
});
