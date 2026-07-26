/**
 * Shared constants for the admin application.
 *
 * Centralizes magic numbers used across multiple modules so they can be
 * updated in a single place.
 */

import {
    DEFAULT_AVATAR_MAX_FILE_SIZE_MB,
    DEFAULT_ENTITY_MAX_FILE_SIZE_MB,
    mbToBytes
} from '@repo/media';

/**
 * Default maximum size (in bytes) for uploaded media files (images, gallery
 * entries) across entity consolidated configs and the ImageField default.
 *
 * Derived from the canonical entity cap in `@repo/media`, which the API
 * enforces — before HOS-322 this was an independent 5 MiB copy that rejected
 * photos the server would happily have accepted.
 */
export const DEFAULT_MEDIA_MAX_SIZE_BYTES = mbToBytes(DEFAULT_ENTITY_MAX_FILE_SIZE_MB);

/**
 * Fallback maximum size (in bytes) used by the GalleryField component when
 * neither the field's `typeConfig.maxSize` nor an explicit `defaultMaxSize`
 * prop is provided.
 *
 * Same canonical entity cap: a gallery entry is an entity photo.
 */
export const DEFAULT_GALLERY_FALLBACK_MAX_SIZE_BYTES = mbToBytes(DEFAULT_ENTITY_MAX_FILE_SIZE_MB);

/**
 * Default maximum size (in megabytes) for avatar uploads. Mirrors the avatar
 * cap enforced by `@repo/media` (and by `HOSPEDA_AVATAR_MAX_FILE_SIZE_MB` on
 * the API), which is deliberately lower than the entity cap.
 */
export const DEFAULT_AVATAR_MAX_SIZE_MB = DEFAULT_AVATAR_MAX_FILE_SIZE_MB;
