/**
 * Media provider singleton for Cloudinary image management.
 *
 * Lazy-initializes a CloudinaryProvider on first access. In development,
 * when Cloudinary credentials are missing, falls back to an in-memory
 * test double so local dev paths never crash on upload endpoints. In
 * production, missing credentials leave the provider as null (routes can
 * then 503 gracefully).
 *
 * SPEC-078-GAPS T-018 + T-019:
 *   - GAP-078-229: dev fallback to InMemoryImageProvider.
 *   - GAP-078-059 + GAP-078-168: `resetMediaProviderForTesting` exposed in
 *     the test NODE env for deterministic singleton reset between tests.
 */
import { CloudinaryProvider } from '@repo/media/server';
import type { ImageProvider } from '@repo/media/server';
import { InMemoryImageProvider } from '@repo/media/test-utils';
import { env } from '../utils/env.js';

let provider: ImageProvider | null = null;
let initialized = false;

/**
 * Returns the singleton ImageProvider instance, or null when Cloudinary
 * credentials are absent in non-development environments.
 *
 * Reads HOSPEDA_CLOUDINARY_CLOUD_NAME, HOSPEDA_CLOUDINARY_API_KEY, and
 * HOSPEDA_CLOUDINARY_API_SECRET via the validated `env` object.
 *
 * In the `development` NODE env, missing credentials cause the helper to
 * fall back to {@link InMemoryImageProvider} and log a warn line instead
 * of crashing — local dev flows can upload against an in-memory store
 * without any external Cloudinary setup.
 *
 * @returns {ImageProvider | null} Configured provider, an in-memory fallback
 *                                 in dev, or null if unconfigured in
 *                                 non-development envs.
 */
export function getMediaProvider(): ImageProvider | null {
    if (!initialized) {
        initialized = true;
        const cloudName = env.HOSPEDA_CLOUDINARY_CLOUD_NAME;
        const apiKey = env.HOSPEDA_CLOUDINARY_API_KEY;
        const apiSecret = env.HOSPEDA_CLOUDINARY_API_SECRET;

        if (cloudName && apiKey && apiSecret) {
            provider = new CloudinaryProvider({ cloudName, apiKey, apiSecret });
        } else if (env.NODE_ENV === 'development') {
            console.warn(
                '[media] Cloudinary not configured - falling back to InMemoryImageProvider (development only)'
            );
            provider = new InMemoryImageProvider();
        } else {
            console.warn('[media] Cloudinary not configured - upload endpoints disabled');
        }
    }
    return provider;
}

/**
 * Resets the media provider singleton so the next {@link getMediaProvider}
 * call re-runs the initialization branch.
 *
 * Only usable when `NODE_ENV === 'test'`. In any other environment the
 * function throws — this protects production callers from accidentally
 * clearing a live provider mid-flight. Tests that need to swap between
 * configured and un-configured states can call this to force a clean
 * re-initialization.
 *
 * @throws {Error} If invoked when `NODE_ENV` is not `'test'`.
 */
export function resetMediaProviderForTesting(): void {
    if (env.NODE_ENV !== 'test') {
        throw new Error('resetMediaProviderForTesting() is only available when NODE_ENV=test');
    }
    provider = null;
    initialized = false;
}
