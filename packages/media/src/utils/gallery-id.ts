import { nanoid } from 'nanoid';

/**
 * Generates a unique 10-character ID for gallery image public IDs.
 *
 * Uses nanoid for URL-safe, collision-resistant random IDs.
 * Used as the filename suffix for gallery images in Cloudinary paths:
 * `hospeda/{env}/{entityType}/{entityId}/gallery/{galleryId}`
 *
 * @returns A 10-character URL-safe random string
 *
 * @example
 * ```ts
 * generateGalleryId() // e.g., 'V1StGXR8_Z'
 * generateGalleryId() // e.g., 'bN8aK2mPxQ'
 * ```
 */
export function generateGalleryId(): string {
    return nanoid(10);
}
