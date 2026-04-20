import { describe, expect, it } from 'vitest';
import { coerceResetImpliesCleanImages } from '../src/cli.js';

/**
 * GAP-078-006 + GAP-078-078 regression tests for the `--reset` →
 * `--clean-images` flag coercion.
 *
 * The helper is pure, so it can be exercised directly without spawning the
 * CLI subprocess or touching the real Cloudinary provider.
 */
describe('GAP-078-006/078: coerceResetImpliesCleanImages', () => {
    it('passes through when both flags are false', () => {
        const result = coerceResetImpliesCleanImages({
            reset: false,
            cleanImages: false
        });
        expect(result).toEqual({
            reset: false,
            cleanImages: false,
            coerced: false
        });
    });

    it('passes through --clean-images alone (cleanup-only mode still valid)', () => {
        const result = coerceResetImpliesCleanImages({
            reset: false,
            cleanImages: true
        });
        expect(result).toEqual({
            reset: false,
            cleanImages: true,
            coerced: false
        });
    });

    it('forces cleanImages on when --reset is passed alone', () => {
        const result = coerceResetImpliesCleanImages({
            reset: true,
            cleanImages: false
        });
        expect(result).toEqual({
            reset: true,
            cleanImages: true,
            coerced: true
        });
    });

    it('passes through when both --reset and --clean-images are explicit (no coercion needed)', () => {
        const result = coerceResetImpliesCleanImages({
            reset: true,
            cleanImages: true
        });
        expect(result).toEqual({
            reset: true,
            cleanImages: true,
            coerced: false
        });
    });

    it('never flips reset off', () => {
        // Sanity: the helper is a pure function of its input — it must never
        // decide to turn `reset` off on its own.
        const inputs: readonly { reset: boolean; cleanImages: boolean }[] = [
            { reset: true, cleanImages: true },
            { reset: true, cleanImages: false },
            { reset: false, cleanImages: true },
            { reset: false, cleanImages: false }
        ];
        for (const input of inputs) {
            const result = coerceResetImpliesCleanImages(input);
            expect(result.reset).toBe(input.reset);
        }
    });
});
