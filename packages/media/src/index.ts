/**
 * @repo/media — browser-safe entrypoint.
 *
 * Exposes only pure, dependency-free helpers that can run in any runtime
 * (Node, Vite, Astro, browser): URL builders, named transform presets, ID
 * generation, and Cloudinary URL parsing.
 *
 * Server-only concerns (Cloudinary SDK, file-magic validation, environment
 * resolution) live behind the `@repo/media/server` subpath. Consumers in
 * apps/admin and apps/web are forbidden from importing `/server` (enforced
 * by Biome's `noRestrictedImports` rule).
 *
 * See SPEC-078-GAPS T-017 + GAPs 126 / 162 / 172 / 177 / 183.
 */

export { extractPublicId } from './extract-public-id.js';

export { getMediaUrl, stripCloudinaryTransform } from './get-media-url.js';
export type { GetMediaUrlOptions } from './get-media-url.js';

export { MEDIA_PRESETS } from './presets.js';
export type { MediaPreset } from './presets.js';

export { generateGalleryId } from './utils/gallery-id.js';
