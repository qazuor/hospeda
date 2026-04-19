import { v2 as cloudinary } from 'cloudinary';
import { describe, expect, it } from 'vitest';

/**
 * Contract test for the `cloudinary` SDK shape.
 *
 * SPEC-078-GAPS GAP-078-100. Renovate is pinned to minor-only updates for
 * `cloudinary` (T-055), but minor and patch releases can still rename or
 * remove methods. This test imports the real SDK (no mocks) and asserts that
 * every method `CloudinaryProvider` (`packages/media/src/server/cloudinary.provider.ts`)
 * relies on still exists as a callable function.
 *
 * If this test fails after a dependency bump, the SDK has broken its public
 * API: investigate the Cloudinary changelog before letting the upgrade land.
 */
describe('cloudinary SDK contract', () => {
    it('exposes every method CloudinaryProvider relies on', () => {
        // Arrange: methods consumed by CloudinaryProvider (constructor + 4 ops).
        const requiredMethods: ReadonlyArray<readonly [string, unknown]> = [
            ['cloudinary.config', cloudinary.config],
            ['cloudinary.uploader.upload_stream', cloudinary.uploader.upload_stream],
            ['cloudinary.uploader.destroy', cloudinary.uploader.destroy],
            [
                'cloudinary.api.delete_resources_by_prefix',
                cloudinary.api.delete_resources_by_prefix
            ],
            ['cloudinary.api.ping', cloudinary.api.ping]
        ];

        // Act + Assert: each entry must be a callable function on the real SDK.
        for (const [name, fn] of requiredMethods) {
            expect(typeof fn, `${name} must be a function on the cloudinary SDK`).toBe('function');
        }
    });
});
