/**
 * @file media-limit-defaults.guard.test.ts
 * @description Pins the API env defaults to the canonical caps in `@repo/media`.
 *
 * `env-schema.ts` may import ONLY from `zod` (a purity rule with its own guard
 * test), so it cannot import the shared constants and has to spell the defaults
 * out as literals. This test is what keeps those literals honest: the clients
 * pre-validate against `@repo/media`, so a default that drifts from it would
 * silently reintroduce the HOS-322 bug — a client accepting a photo the server
 * rejects, or refusing one the server would have taken.
 *
 * @module test/utils/media-limit-defaults.guard
 */
import { DEFAULT_AVATAR_MAX_FILE_SIZE_MB, DEFAULT_ENTITY_MAX_FILE_SIZE_MB } from '@repo/media';
import { describe, expect, it } from 'vitest';
import { ApiEnvBaseSchema } from '../../src/utils/env-schema';

/**
 * Parse an env object through the schema with the media vars absent, so the
 * schema's own defaults are what come out.
 */
const parseWithDefaults = (): {
    HOSPEDA_MEDIA_MAX_FILE_SIZE_MB: number;
    HOSPEDA_AVATAR_MAX_FILE_SIZE_MB: number;
} => {
    const shape = ApiEnvBaseSchema.shape;
    return {
        HOSPEDA_MEDIA_MAX_FILE_SIZE_MB: shape.HOSPEDA_MEDIA_MAX_FILE_SIZE_MB.parse(undefined),
        HOSPEDA_AVATAR_MAX_FILE_SIZE_MB: shape.HOSPEDA_AVATAR_MAX_FILE_SIZE_MB.parse(undefined)
    };
};

describe('HOS-322 — media limit defaults', () => {
    it('defaults the entity cap to the canonical shared constant', () => {
        expect(parseWithDefaults().HOSPEDA_MEDIA_MAX_FILE_SIZE_MB).toBe(
            DEFAULT_ENTITY_MAX_FILE_SIZE_MB
        );
    });

    it('defaults the avatar cap to the canonical shared constant', () => {
        expect(parseWithDefaults().HOSPEDA_AVATAR_MAX_FILE_SIZE_MB).toBe(
            DEFAULT_AVATAR_MAX_FILE_SIZE_MB
        );
    });

    it('keeps the avatar cap below the entity cap', () => {
        // Avatars are cropped to a thumbnail; accepting an entity-sized
        // original would be storage and bandwidth spent on discarded pixels.
        expect(DEFAULT_AVATAR_MAX_FILE_SIZE_MB).toBeLessThan(DEFAULT_ENTITY_MAX_FILE_SIZE_MB);
    });
});
