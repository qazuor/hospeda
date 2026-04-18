/**
 * Media provider singleton for Cloudinary image management.
 *
 * Lazy-initializes the CloudinaryProvider on first access.
 * Returns null when Cloudinary credentials are not configured,
 * allowing routes to return 503 gracefully.
 */
import { CloudinaryProvider } from '@repo/media';
import type { ImageProvider } from '@repo/media';
import { env } from '../utils/env.js';

let provider: ImageProvider | null = null;
let initialized = false;

/**
 * Returns the singleton ImageProvider instance, or null when Cloudinary
 * credentials are absent from the environment.
 *
 * Reads HOSPEDA_CLOUDINARY_CLOUD_NAME, HOSPEDA_CLOUDINARY_API_KEY, and
 * HOSPEDA_CLOUDINARY_API_SECRET via the validated `env` object.
 *
 * @returns {ImageProvider | null} Configured provider or null if unconfigured
 */
export function getMediaProvider(): ImageProvider | null {
    if (!initialized) {
        initialized = true;
        const cloudName = env.HOSPEDA_CLOUDINARY_CLOUD_NAME;
        const apiKey = env.HOSPEDA_CLOUDINARY_API_KEY;
        const apiSecret = env.HOSPEDA_CLOUDINARY_API_SECRET;

        if (cloudName && apiKey && apiSecret) {
            provider = new CloudinaryProvider({ cloudName, apiKey, apiSecret });
        } else {
            console.warn('[media] Cloudinary not configured - upload endpoints disabled');
        }
    }
    return provider;
}
