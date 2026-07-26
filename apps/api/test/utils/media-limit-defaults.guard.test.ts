/**
 * @file media-limit-defaults.guard.test.ts
 * @description Pins the API env caps to the canonical limits in `@repo/media`.
 *
 * `env-schema.ts` may import ONLY from `zod` (a purity rule with its own guard
 * test), so it cannot import the shared constants and has to spell the numbers
 * out as literals. This test is what keeps those literals honest.
 *
 * The absolute assertions matter as much as the relative ones. Every other test
 * in this change derives its expected size from the same constant the code
 * reads, which pins boundary behaviour but says nothing about the value — if
 * the cap silently reverted to 5 MB, only this file would notice.
 *
 * @module test/utils/media-limit-defaults.guard
 */
import {
    DEFAULT_AVATAR_MAX_FILE_SIZE_MB,
    DEFAULT_ENTITY_MAX_FILE_SIZE_MB,
    PROVIDER_MAX_IMAGE_FILE_SIZE_MB
} from '@repo/media';
import { describe, expect, it } from 'vitest';
import { ApiEnvBaseSchema } from '../../src/utils/env-schema';

const shape = ApiEnvBaseSchema.shape;

describe('HOS-322 — media limit defaults', () => {
    describe('the canonical constants', () => {
        it('pins the provider ceiling to what Cloudinary actually accepts', () => {
            // Verified against the live account, not documentation: an upload of
            // 16680388 bytes was refused with "Maximum is 10485760". Changing
            // this number requires re-verifying against the provider plan, not
            // just editing the constant.
            expect(PROVIDER_MAX_IMAGE_FILE_SIZE_MB).toBe(10);
            expect(PROVIDER_MAX_IMAGE_FILE_SIZE_MB * 1024 * 1024).toBe(10_485_760);
        });

        it('pins the entity cap', () => {
            expect(DEFAULT_ENTITY_MAX_FILE_SIZE_MB).toBe(10);
        });

        it('pins the avatar cap', () => {
            expect(DEFAULT_AVATAR_MAX_FILE_SIZE_MB).toBe(5);
        });

        it('never lets the entity cap exceed what the provider accepts', () => {
            // Above the provider ceiling an upload passes every check of ours,
            // spends the full transfer time, and only then dies upstream as a
            // generic UPSTREAM_ERROR — strictly worse for the user than an
            // immediate rejection.
            expect(DEFAULT_ENTITY_MAX_FILE_SIZE_MB).toBeLessThanOrEqual(
                PROVIDER_MAX_IMAGE_FILE_SIZE_MB
            );
        });

        it('keeps the avatar cap below the entity cap', () => {
            // Avatars are cropped to a thumbnail; accepting an entity-sized
            // original would be storage and bandwidth spent on discarded pixels.
            expect(DEFAULT_AVATAR_MAX_FILE_SIZE_MB).toBeLessThan(DEFAULT_ENTITY_MAX_FILE_SIZE_MB);
        });
    });

    describe('the env schema', () => {
        it('defaults the entity cap to the canonical shared constant', () => {
            expect(shape.HOSPEDA_MEDIA_MAX_FILE_SIZE_MB.parse(undefined)).toBe(
                DEFAULT_ENTITY_MAX_FILE_SIZE_MB
            );
        });

        it('defaults the avatar cap to the canonical shared constant', () => {
            expect(shape.HOSPEDA_AVATAR_MAX_FILE_SIZE_MB.parse(undefined)).toBe(
                DEFAULT_AVATAR_MAX_FILE_SIZE_MB
            );
        });

        it('refuses to configure either cap above the provider ceiling', () => {
            // The upload routes feed this value straight into a body-size
            // ceiling that runs before authentication, so an operator typo must
            // not be able to widen it. This `.max()` also restores the hard
            // bound the single global body limit used to provide.
            const overCeiling = String(PROVIDER_MAX_IMAGE_FILE_SIZE_MB + 1);
            expect(() => shape.HOSPEDA_MEDIA_MAX_FILE_SIZE_MB.parse(overCeiling)).toThrow();
            expect(() => shape.HOSPEDA_AVATAR_MAX_FILE_SIZE_MB.parse(overCeiling)).toThrow();
            expect(() => shape.HOSPEDA_MEDIA_MAX_FILE_SIZE_MB.parse('1500')).toThrow();
        });

        it('still accepts a value at or below the ceiling', () => {
            expect(shape.HOSPEDA_MEDIA_MAX_FILE_SIZE_MB.parse('8')).toBe(8);
            expect(
                shape.HOSPEDA_MEDIA_MAX_FILE_SIZE_MB.parse(String(PROVIDER_MAX_IMAGE_FILE_SIZE_MB))
            ).toBe(PROVIDER_MAX_IMAGE_FILE_SIZE_MB);
        });
    });
});
