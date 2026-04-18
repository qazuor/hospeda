/**
 * Shared constants for the admin application.
 *
 * Centralizes magic numbers used across multiple modules so they can be
 * updated in a single place.
 */

/**
 * Default maximum size (in bytes) for uploaded media files (images, gallery
 * entries) across entity consolidated configs and the ImageField default.
 *
 * Equivalent to 5 MiB (5 * 1024 * 1024 = 5242880).
 */
export const DEFAULT_MEDIA_MAX_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Fallback maximum size (in bytes) used by the GalleryField component when
 * neither the field's `typeConfig.maxSize` nor an explicit `defaultMaxSize`
 * prop is provided.
 *
 * Equivalent to 10 MiB (10 * 1024 * 1024).
 */
export const DEFAULT_GALLERY_FALLBACK_MAX_SIZE_BYTES = 10 * 1024 * 1024;
