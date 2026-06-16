import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Actor } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';
import { IdMapper } from '../../src/utils/idMapper.js';
import { logger } from '../../src/utils/logger.js';
import { type SeedContext, createImageProcessingCounters } from '../../src/utils/seedContext.js';
import { createSeedFactory } from '../../src/utils/seedFactory.js';

// ---------------------------------------------------------------------------
// Minimal stubs
// ---------------------------------------------------------------------------

class StubService {
    async create(_actor: Actor, _data: unknown): Promise<{ data: { id: string } }> {
        return { data: { id: 'stub-id-123' } };
    }
}

class FailingService {
    async create(
        _actor: Actor,
        _data: unknown
    ): Promise<{ error: { message: string; code: string } }> {
        return { error: { message: 'Service exploded', code: 'INTERNAL_ERROR' } };
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
    const folder = mkdtempSync(join(tmpdir(), 'seed-cb-test-'));
    writeFileSync(join(folder, filename), JSON.stringify(payload));
    return { folder, file: filename };
}

// ---------------------------------------------------------------------------
// postProcess callback (lines ~305-316)
// ---------------------------------------------------------------------------

describe('createSeedFactory — postProcess callback', () => {
    it('should invoke postProcess after successful entity creation', async () => {
        // Arrange
        const { folder, file } = makeFolder({ id: 'pp-1', name: 'Post-Process Test' });
        const postProcessSpy = vi.fn().mockResolvedValue(undefined);

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file],
            postProcess: postProcessSpy
        });

        const context = buildContext();

        // Act
        await seed(context);

        // Assert
        expect(postProcessSpy).toHaveBeenCalledOnce();
        // postProcess receives (result, item, context)
        const [resultArg, itemArg, ctxArg] = postProcessSpy.mock.calls[0] ?? [];
        expect(resultArg).toMatchObject({ data: { id: 'stub-id-123' } });
        expect((itemArg as Record<string, unknown>).id).toBe('pp-1');
        expect(ctxArg).toBe(context);
    });

    it('should propagate and record error when postProcess throws', async () => {
        // Arrange
        const { folder, file } = makeFolder({ id: 'pp-err-1', name: 'Failing Post-Process' });
        const postProcessSpy = vi.fn().mockRejectedValue(new Error('Post-process failed'));

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file],
            postProcess: postProcessSpy
        });

        const context = buildContext();

        // Act + Assert
        await expect(seed(context)).rejects.toThrow('Post-process failed');
        expect(postProcessSpy).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// relationBuilder callback (lines ~320-334)
// ---------------------------------------------------------------------------

describe('createSeedFactory — relationBuilder callback', () => {
    it('should invoke relationBuilder after successful entity creation', async () => {
        // Arrange
        const { folder, file } = makeFolder({ id: 'rb-1', name: 'Relation Builder Test' });
        const relationBuilderSpy = vi.fn().mockResolvedValue(undefined);

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file],
            relationBuilder: relationBuilderSpy
        });

        const context = buildContext();

        // Act
        await seed(context);

        // Assert
        expect(relationBuilderSpy).toHaveBeenCalledOnce();
        const [resultArg, itemArg, ctxArg] = relationBuilderSpy.mock.calls[0] ?? [];
        expect(resultArg).toMatchObject({ data: { id: 'stub-id-123' } });
        expect((itemArg as Record<string, unknown>).id).toBe('rb-1');
        expect(ctxArg).toBe(context);
    });

    it('should NOT throw when relationBuilder fails (warn only — entity was created)', async () => {
        // Arrange — the spec says: "Don't throw here as the main entity was created successfully"
        const { folder, file } = makeFolder({ id: 'rb-err-1', name: 'Failing Relation Builder' });
        const relationBuilderSpy = vi.fn().mockRejectedValue(new Error('Relation failed'));
        vi.spyOn(logger, 'warn').mockImplementation(() => {});

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file],
            relationBuilder: relationBuilderSpy
        });

        const context = buildContext();

        // Act + Assert: should NOT reject
        await expect(seed(context)).resolves.toBeUndefined();
        expect(relationBuilderSpy).toHaveBeenCalledOnce();
        vi.restoreAllMocks();
    });
});

// ---------------------------------------------------------------------------
// preProcess callback (GAP — lines ~159-169)
// ---------------------------------------------------------------------------

describe('createSeedFactory — preProcess callback', () => {
    it('should invoke preProcess before entity creation', async () => {
        // Arrange
        const { folder, file } = makeFolder({ id: 'pre-1', name: 'Pre-Process Test' });
        const preProcessSpy = vi.fn().mockResolvedValue(undefined);

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file],
            preProcess: preProcessSpy
        });

        const context = buildContext();

        // Act
        await seed(context);

        // Assert
        expect(preProcessSpy).toHaveBeenCalledOnce();
        const [itemArg, ctxArg] = preProcessSpy.mock.calls[0] ?? [];
        expect((itemArg as Record<string, unknown>).id).toBe('pre-1');
        expect(ctxArg).toBe(context);
    });

    it('should propagate and record error when preProcess throws', async () => {
        // Arrange
        const { folder, file } = makeFolder({ id: 'pre-err-1', name: 'Failing Pre-Process' });
        const preProcessSpy = vi.fn().mockRejectedValue(new Error('Pre-process exploded'));

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file],
            preProcess: preProcessSpy
        });

        const context = buildContext();

        // Act + Assert
        await expect(seed(context)).rejects.toThrow('Pre-process exploded');
    });
});

// ---------------------------------------------------------------------------
// validateBeforeCreate callback
// ---------------------------------------------------------------------------

describe('createSeedFactory — validateBeforeCreate callback', () => {
    it('should throw when validateBeforeCreate returns false', async () => {
        // Arrange
        const { folder, file } = makeFolder({ id: 'val-false-1', name: 'Invalid Entity' });

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file],
            validateBeforeCreate: async () => false
        });

        const context = buildContext();

        // Act + Assert
        await expect(seed(context)).rejects.toThrow('Custom validation failed');
    });

    it('should proceed when validateBeforeCreate returns true', async () => {
        // Arrange
        const { folder, file } = makeFolder({ id: 'val-true-1', name: 'Valid Entity' });
        const createSpy = vi.spyOn(StubService.prototype, 'create');

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file],
            validateBeforeCreate: async () => true
        });

        const context = buildContext();

        // Act
        await seed(context);

        // Assert
        expect(createSpy).toHaveBeenCalledOnce();
        createSpy.mockRestore();
    });

    it('should propagate error thrown inside validateBeforeCreate', async () => {
        // Arrange
        const { folder, file } = makeFolder({ id: 'val-throw-1', name: 'Throwing Validator' });

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file],
            validateBeforeCreate: async () => {
                throw new Error('Validator threw');
            }
        });

        const context = buildContext();

        // Act + Assert
        await expect(seed(context)).rejects.toThrow('Validator threw');
    });
});

// ---------------------------------------------------------------------------
// transformResult callback
// ---------------------------------------------------------------------------

describe('createSeedFactory — transformResult callback', () => {
    it('should use the transformed result for ID mapping', async () => {
        // Arrange
        const { folder, file } = makeFolder({ id: 'tr-1', name: 'Transform Test' });

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file],
            // Wrap result in an extra layer
            transformResult: (result) => ({
                ...(result as Record<string, unknown>),
                transformed: true
            })
        });

        const context = buildContext();

        // Act + Assert: should not throw — transformed result passes ID mapping
        await expect(seed(context)).resolves.toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Service error path (lines ~256-265)
// ---------------------------------------------------------------------------

describe('createSeedFactory — service error path', () => {
    it('should throw when service.create returns an error', async () => {
        // Arrange
        const { folder, file } = makeFolder({ id: 'svc-err-1', name: 'Service Error Entity' });

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: FailingService,
            folder,
            files: [file]
        });

        const context = buildContext();

        // Act + Assert
        await expect(seed(context)).rejects.toThrow('Service exploded');
    });
});

// ---------------------------------------------------------------------------
// actor missing path
// ---------------------------------------------------------------------------

describe('createSeedFactory — actor validation', () => {
    it('should throw when actor is not set in context', async () => {
        // Arrange
        const { folder, file } = makeFolder({ id: 'no-actor-1', name: 'No Actor' });

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file]
        });

        const context = buildContext({ actor: undefined as unknown as Actor });

        // Act + Assert
        await expect(seed(context)).rejects.toThrow('Actor not available');
    });
});
