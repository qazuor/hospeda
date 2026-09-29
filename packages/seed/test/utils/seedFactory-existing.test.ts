/**
 * HOS-735 — `createSeedFactory({ existing })`: a re-run must skip rows that are
 * already there instead of failing on the first duplicate UNIQUE key.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Actor } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';
import { whereFixtureFields, whereFixtureSlug } from '../../src/utils/existingLookup.js';
import { IdMapper } from '../../src/utils/idMapper.js';
import { createImageProcessingCounters, type SeedContext } from '../../src/utils/seedContext.js';
import { createSeedFactory } from '../../src/utils/seedFactory.js';

vi.mock('../../src/utils/cloudinary-image-processor.js', () => ({
    processEntityImages: vi.fn(async ({ data }: { data: unknown }) => data)
}));

class StubService {
    static createCalls: unknown[] = [];
    async create(_actor: Actor, data: unknown): Promise<{ data: { id: string } }> {
        StubService.createCalls.push(data);
        return { data: { id: 'new-id' } };
    }
}

/** Lookup stub: returns a row only for slugs listed in `present`. */
function lookupModel(present: Record<string, string>) {
    return class {
        static wheres: Record<string, unknown>[] = [];
        async findOne(where: Record<string, unknown>) {
            (this.constructor as { wheres: Record<string, unknown>[] }).wheres.push(where);
            const id = present[String(where.slug)];
            return id ? { id } : null;
        }
    };
}

function context(): SeedContext {
    return {
        continueOnError: false,
        validateManifests: false,
        resetDatabase: false,
        exclude: [],
        actor: { id: 'actor-1', role: 'super_admin', permissions: [] } as unknown as Actor,
        idMapper: new IdMapper(true),
        seedSource: 'required',
        imageCounters: createImageProcessingCounters()
    } as SeedContext;
}

function folderWith(payload: Record<string, unknown>) {
    const folder = mkdtempSync(join(tmpdir(), 'seed-existing-test-'));
    writeFileSync(join(folder, 'item.json'), JSON.stringify(payload));
    return { folder, file: 'item.json' };
}

describe('createSeedFactory existing option (HOS-735)', () => {
    it('skips create, still maps the real id, and skips postProcess when the row exists', async () => {
        // Arrange
        StubService.createCalls = [];
        const { folder, file } = folderWith({ id: 'seed-1', slug: 'wifi', name: 'Wifi' });
        const postProcess = vi.fn();
        const onExisting = vi.fn();
        const ctx = context();
        const seed = createSeedFactory({
            entityName: 'Things',
            serviceClass: StubService,
            folder,
            files: [file],
            existing: {
                modelClass: lookupModel({ wifi: 'existing-id' }),
                getWhere: whereFixtureSlug(),
                onExisting
            },
            postProcess
        });

        // Act
        await seed(ctx);

        // Assert
        expect(StubService.createCalls).toHaveLength(0);
        expect(postProcess).not.toHaveBeenCalled();
        expect(onExisting).toHaveBeenCalledTimes(1);
        expect(ctx.idMapper.getRealId('things', 'seed-1')).toBe('existing-id');
    });

    it('creates and runs postProcess when the row does not exist', async () => {
        // Arrange
        StubService.createCalls = [];
        const { folder, file } = folderWith({ id: 'seed-1', slug: 'wifi', name: 'Wifi' });
        const postProcess = vi.fn();
        const onExisting = vi.fn();
        const seed = createSeedFactory({
            entityName: 'Things',
            serviceClass: StubService,
            folder,
            files: [file],
            existing: {
                modelClass: lookupModel({}),
                getWhere: whereFixtureSlug(),
                onExisting
            },
            postProcess
        });

        // Act
        await seed(context());

        // Assert
        expect(StubService.createCalls).toHaveLength(1);
        expect(postProcess).toHaveBeenCalledTimes(1);
        expect(onExisting).not.toHaveBeenCalled();
    });

    it('does not process images for a row that already exists', async () => {
        // Arrange
        const { processEntityImages } = await import(
            '../../src/utils/cloudinary-image-processor.js'
        );
        vi.mocked(processEntityImages).mockClear();
        const { folder, file } = folderWith({ id: 'seed-1', slug: 'wifi', name: 'Wifi' });
        const ctx = context();
        ctx.imageProvider = {} as never;
        ctx.imageCache = {};
        ctx.imageCachePath = '/tmp/none';
        const seed = createSeedFactory({
            entityName: 'Things',
            serviceClass: StubService,
            folder,
            files: [file],
            existing: { modelClass: lookupModel({ wifi: 'x' }), getWhere: whereFixtureSlug() }
        });

        // Act
        await seed(ctx);

        // Assert
        expect(processEntityImages).not.toHaveBeenCalled();
    });

    it('behaves exactly as before when the option is omitted', async () => {
        // Arrange
        StubService.createCalls = [];
        const { folder, file } = folderWith({ id: 'seed-1', slug: 'wifi', name: 'Wifi' });
        const seed = createSeedFactory({
            entityName: 'Things',
            serviceClass: StubService,
            folder,
            files: [file]
        });

        // Act
        await seed(context());

        // Assert
        expect(StubService.createCalls).toHaveLength(1);
    });
});

describe('existing lookup builders (HOS-735)', () => {
    it('whereFixtureSlug reads the RAW fixture slug, not the normalized payload', () => {
        expect(whereFixtureSlug()({ slug: 'a_b' }, { name: 'x' })).toEqual({ slug: 'a_b' });
    });

    it('whereFixtureSlug throws when the fixture has no slug', () => {
        expect(() => whereFixtureSlug()({ name: 'x' }, {})).toThrow(/no "slug"/);
    });

    it('whereFixtureFields builds a composite key and rejects a missing field', () => {
        const build = whereFixtureFields({ fields: ['fromCurrency', 'rateType'] });
        expect(build({ fromCurrency: 'USD', rateType: 'blue', rate: 1 }, {})).toEqual({
            fromCurrency: 'USD',
            rateType: 'blue'
        });
        expect(() => build({ fromCurrency: 'USD' }, {})).toThrow(/rateType/);
    });
});
