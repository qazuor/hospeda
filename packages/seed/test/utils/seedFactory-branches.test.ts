import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ImageProvider } from '@repo/media/server';
import type { Actor } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';
import { IdMapper } from '../../src/utils/idMapper.js';
import { logger } from '../../src/utils/logger.js';
import { createImageProcessingCounters, type SeedContext } from '../../src/utils/seedContext.js';
import { createSeedFactory } from '../../src/utils/seedFactory.js';

/**
 * Minimal service stub — mirrors the one in seedFactory-callbacks.test.ts.
 */
class StubService {
    async create(_actor: Actor, _data: unknown): Promise<{ data: { id: string } }> {
        return { data: { id: 'stub-id-123' } };
    }
}

class EmptyMessageFailingService {
    async create(
        _actor: Actor,
        _data: unknown
    ): Promise<{ error: { message: string; code: string } }> {
        // Empty message forces the `result.error.message || 'Service creation failed'`
        // fallback branch to be exercised.
        return { error: { message: '', code: 'INTERNAL_ERROR' } };
    }
}

function buildContext(overrides?: Partial<SeedContext>): SeedContext {
    const actor: Actor = {
        id: 'actor-1',
        role: 'super_admin',
        permissions: []
    } as unknown as Actor;
    return {
        continueOnError: false,
        validateManifests: false,
        resetDatabase: false,
        exclude: [],
        actor,
        idMapper: new IdMapper(true),
        seedSource: 'required',
        imageCounters: createImageProcessingCounters(),
        ...overrides
    } as SeedContext;
}

function makeFolder(
    payload: Record<string, unknown>,
    filename = 'item.json'
): { folder: string; file: string } {
    const folder = mkdtempSync(join(tmpdir(), 'seed-factory-branches-'));
    writeFileSync(join(folder, filename), JSON.stringify(payload));
    return { folder, file: filename };
}

describe('createSeedFactory — seedSource default (nullish coalescing)', () => {
    it('defaults to the "required" image pipeline when seedSource is not set on the context', async () => {
        // Arrange: seedSource intentionally omitted. With no imageProvider either,
        // `shouldProcess` stays false, so the item is created unmodified — but the
        // `context.seedSource ?? 'required'` default-assignment branch still runs.
        const { folder, file } = makeFolder({ id: 'no-source-1', name: 'No Seed Source' });
        const createSpy = vi.spyOn(StubService.prototype, 'create');

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file]
        });

        const context = buildContext({ seedSource: undefined });

        // Act
        await seed(context);

        // Assert: seeding completed normally via the defaulted 'required' source
        expect(createSpy).toHaveBeenCalledOnce();
        createSpy.mockRestore();
    });
});

describe('createSeedFactory — imageProvider nullish default inside the image-processing block', () => {
    it('passes a configured imageProvider through unchanged for the example seed source', async () => {
        // Arrange: seedSource === 'example' makes `shouldProcess` true regardless of
        // imageProvider, and `processEntityImages` early-returns for 'example' BEFORE
        // ever touching `provider` — so a dummy truthy provider is safe here and only
        // serves to exercise the `context.imageProvider ?? null` branch where the
        // provider IS defined.
        const { folder, file } = makeFolder({ id: 'example-1', name: 'Example Entity' });
        const createSpy = vi.spyOn(StubService.prototype, 'create');
        const dummyProvider = {} as unknown as ImageProvider;

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file]
        });

        const context = buildContext({ seedSource: 'example', imageProvider: dummyProvider });

        // Act
        await expect(seed(context)).resolves.toBeUndefined();

        // Assert
        expect(createSpy).toHaveBeenCalledOnce();
        createSpy.mockRestore();
    });
});

describe('createSeedFactory — service error message fallback', () => {
    it('falls back to "Service creation failed" when the service error has an empty message', async () => {
        // Arrange
        const { folder, file } = makeFolder({ id: 'empty-msg-1', name: 'Empty Message Entity' });

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: EmptyMessageFailingService,
            folder,
            files: [file]
        });

        const context = buildContext();

        // Act + Assert
        await expect(seed(context)).rejects.toThrow('Service creation failed');
    });
});

describe('createSeedFactory — missing seed id on the raw fixture item', () => {
    it('throws an ID-mapping error when the created entity has no `id` field on the source item', async () => {
        // Arrange: the raw fixture has no top-level `id`, but the service still
        // returns a created entity with a real database id — triggering the
        // `if (!seedId)` guard inside the ID-mapping step.
        const { folder, file } = makeFolder({ name: 'No Seed Id Entity' });

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file]
        });

        const context = buildContext();

        // Act + Assert
        await expect(seed(context)).rejects.toThrow('Could not get ID from item');
    });
});

describe('createSeedFactory — getEntityInfo used for the ID-mapping log label', () => {
    it('calls the configured getEntityInfo when recording the id mapping', async () => {
        // Arrange
        const { folder, file } = makeFolder({ id: 'entity-info-1', name: 'Entity Info Test' });
        const getEntityInfoSpy = vi.fn().mockReturnValue('"Custom Label"');

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file],
            getEntityInfo: getEntityInfoSpy
        });

        const context = buildContext();

        // Act
        await seed(context);

        // Assert: getEntityInfo is invoked at least once with the raw item and context
        // for the id-mapping log label (in addition to any seedRunner usage).
        expect(getEntityInfoSpy).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'entity-info-1' }),
            context
        );
        expect(context.idMapper.getRealId('testentities', 'entity-info-1')).toBe('stub-id-123');
        expect(context.idMapper.getDisplayName('testentities', 'entity-info-1')).toBe(
            '"Custom Label"'
        );
    });
});

describe('createSeedFactory — relationBuilder failure with a non-Error rejection value', () => {
    it('stringifies a non-Error rejection instead of reading .message', async () => {
        // Arrange
        const { folder, file } = makeFolder({ id: 'non-error-1', name: 'Non-Error Rejection' });
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file],
            relationBuilder: () => Promise.reject('plain string rejection')
        });

        const context = buildContext();

        // Act
        await expect(seed(context)).resolves.toBeUndefined();

        // Assert: the warning uses String(error) rather than error.message
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('plain string rejection'));
    });
});
