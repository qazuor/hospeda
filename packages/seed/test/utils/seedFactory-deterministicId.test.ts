import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Actor } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';
import { IdMapper } from '../../src/utils/idMapper.js';
import { createImageProcessingCounters, type SeedContext } from '../../src/utils/seedContext.js';
import { createSeedFactory } from '../../src/utils/seedFactory.js';

// ---------------------------------------------------------------------------
// Minimal stubs (mirrors seedFactory-callbacks.test.ts conventions)
// ---------------------------------------------------------------------------

/**
 * Stub service standing in for a real `@repo/service-core` service. Records
 * whether `create()` was invoked so tests can assert the default path was (or
 * was not) taken, and always returns a random-looking id — simulating the
 * database's `defaultRandom()` column default.
 */
class StubService {
    static createCalls: unknown[][] = [];

    async create(actor: Actor, data: unknown): Promise<{ data: { id: string } }> {
        StubService.createCalls.push([actor, data]);
        return { data: { id: 'random-uuid-from-db' } };
    }
}

/**
 * Stub model standing in for a `@repo/db` model extending `BaseModelImpl`.
 * Records every `create()` payload so tests can assert the explicit `id`
 * (and audit fields) reached the "insert".
 */
class StubModel {
    static createCalls: Record<string, unknown>[] = [];

    async create(data: Record<string, unknown>): Promise<Record<string, unknown>> {
        StubModel.createCalls.push(data);
        // Mirrors BaseModelImpl.create(): persists exactly the id it was given.
        return { ...data };
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
    const folder = mkdtempSync(join(tmpdir(), 'seed-deterministic-id-test-'));
    writeFileSync(join(folder, filename), JSON.stringify(payload));
    return { folder, file: filename };
}

describe('createSeedFactory — deterministicId option (HOS-25 T-015)', () => {
    it('should persist the exact explicit id via a direct model insert when getId returns a value', async () => {
        // Arrange
        StubModel.createCalls = [];
        StubService.createCalls = [];
        const { folder, file } = makeFolder({ id: 'fixture-1', name: 'Deterministic Entity' });
        const explicitId = '3f9a1c2e-0000-5000-8000-000000000001';

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file],
            deterministicId: {
                modelClass: StubModel,
                getId: () => explicitId
            }
        });

        const context = buildContext();

        // Act
        await seed(context);

        // Assert: the model received the explicit id, and the service was never called.
        expect(StubModel.createCalls).toHaveLength(1);
        expect(StubModel.createCalls[0]?.id).toBe(explicitId);
        expect(StubModel.createCalls[0]?.createdById).toBe('actor-1');
        expect(StubModel.createCalls[0]?.updatedById).toBe('actor-1');
        expect(StubService.createCalls).toHaveLength(0);

        // The id mapping should also reflect the deterministic id.
        expect(context.idMapper.getRealId('testentities', 'fixture-1')).toBe(explicitId);
    });

    it('should fall back to service.create() (random id) when deterministicId is not configured', async () => {
        // Arrange — default path, unchanged
        StubModel.createCalls = [];
        StubService.createCalls = [];
        const { folder, file } = makeFolder({ id: 'fixture-2', name: 'Default Entity' });

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file]
            // no `deterministicId` option
        });

        const context = buildContext();

        // Act
        await seed(context);

        // Assert: service.create() was used, model was never touched, id is DB-random.
        expect(StubService.createCalls).toHaveLength(1);
        expect(StubModel.createCalls).toHaveLength(0);
        expect(context.idMapper.getRealId('testentities', 'fixture-2')).toBe('random-uuid-from-db');
    });

    it('should fall back to service.create() for a specific item when getId returns undefined', async () => {
        // Arrange — deterministicId configured, but this particular fixture opts out
        StubModel.createCalls = [];
        StubService.createCalls = [];
        const { folder, file } = makeFolder({ id: 'fixture-3', name: 'Opt-out Entity' });

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file],
            deterministicId: {
                modelClass: StubModel,
                getId: () => undefined
            }
        });

        const context = buildContext();

        // Act
        await seed(context);

        // Assert: default path taken for this item despite deterministicId being configured.
        expect(StubService.createCalls).toHaveLength(1);
        expect(StubModel.createCalls).toHaveLength(0);
        expect(context.idMapper.getRealId('testentities', 'fixture-3')).toBe('random-uuid-from-db');
    });

    it('should still run postProcess/relationBuilder after a deterministic-id create', async () => {
        // Arrange
        StubModel.createCalls = [];
        const { folder, file } = makeFolder({ id: 'fixture-4', name: 'With Hooks' });
        const explicitId = '3f9a1c2e-0000-5000-8000-000000000004';
        const postProcessSpy = vi.fn().mockResolvedValue(undefined);
        const relationBuilderSpy = vi.fn().mockResolvedValue(undefined);

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file],
            deterministicId: {
                modelClass: StubModel,
                getId: () => explicitId
            },
            postProcess: postProcessSpy,
            relationBuilder: relationBuilderSpy
        });

        const context = buildContext();

        // Act
        await seed(context);

        // Assert
        expect(postProcessSpy).toHaveBeenCalledOnce();
        expect(relationBuilderSpy).toHaveBeenCalledOnce();
        const [resultArg] = postProcessSpy.mock.calls[0] ?? [];
        expect(resultArg).toMatchObject({ data: { id: explicitId } });
    });
});
