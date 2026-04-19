import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Actor } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';
import { IdMapper } from '../../src/utils/idMapper.js';
import { type SeedContext, createImageProcessingCounters } from '../../src/utils/seedContext.js';
import { createSeedFactory } from '../../src/utils/seedFactory.js';

/**
 * Minimal service stub that satisfies the constructor signature expected by
 * {@link createSeedFactory}. The factory only calls `service.create(actor, data)`
 * and reads `result.data.id`. We do not exercise persistence here.
 */
class StubService {
    async create(_actor: Actor, _data: unknown): Promise<{ data: { id: string } }> {
        return { data: { id: 'srv-id-1' } };
    }
}

/**
 * Build a `SeedContext` shaped object with sensible defaults for tests that
 * only care about the `processEntityImages` + `MediaSchema.parse` wiring.
 */
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
        // No imageProvider configured, so processEntityImages early-returns
        // and the MediaSchema.parse block exercises the malformed-media path
        // unmodified.
        imageCounters: createImageProcessingCounters(),
        ...overrides
    } as SeedContext;
}

describe('createSeedFactory — SPEC-078-GAPS T-024 (GAP-078-084) media validation', () => {
    it('throws a Zod error when media.featuredImage is missing url', async () => {
        // Arrange
        const folder = mkdtempSync(join(tmpdir(), 'seed-media-validation-'));
        const file = 'bad.json';
        const badPayload = {
            id: 'bad-1',
            name: 'Bad Entity',
            // featuredImage missing the required `url` and `moderationState`.
            media: { featuredImage: { caption: 'no url here' } }
        };
        writeFileSync(join(folder, file), JSON.stringify(badPayload));

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file]
        });

        const context = buildContext();

        // Act + Assert: the seed factory propagates the Zod parse error
        // raised right after processEntityImages returns.
        await expect(seed(context)).rejects.toThrow(/url|invalid|required/i);
    });

    it('passes through when media is valid (sanity check)', async () => {
        // Arrange
        const folder = mkdtempSync(join(tmpdir(), 'seed-media-validation-ok-'));
        const file = 'ok.json';
        const payload = {
            id: 'ok-1',
            name: 'Ok Entity',
            media: {
                featuredImage: {
                    url: 'https://example.com/x.jpg',
                    moderationState: 'APPROVED'
                }
            }
        };
        writeFileSync(join(folder, file), JSON.stringify(payload));

        const createSpy = vi.spyOn(StubService.prototype, 'create');
        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file]
        });

        const context = buildContext();

        // Act
        await seed(context);

        // Assert
        expect(createSpy).toHaveBeenCalledOnce();
        createSpy.mockRestore();
    });

    it('skips MediaSchema.parse when entity has no media field', async () => {
        // Arrange
        const folder = mkdtempSync(join(tmpdir(), 'seed-media-validation-nomedia-'));
        const file = 'no-media.json';
        const payload = {
            id: 'nm-1',
            name: 'No Media Entity'
        };
        writeFileSync(join(folder, file), JSON.stringify(payload));

        const seed = createSeedFactory({
            entityName: 'TestEntities',
            serviceClass: StubService,
            folder,
            files: [file]
        });

        const context = buildContext();

        // Act + Assert: should NOT throw, even though no media is present.
        await expect(seed(context)).resolves.toBeUndefined();
    });
});
