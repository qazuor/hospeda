/**
 * @repo/media - Cloudinary image management package
 *
 * Provides provider-agnostic image upload, deletion, and URL building.
 * No other package or app should import from the Cloudinary SDK directly.
 */

export { extractPublicId } from './extract-public-id.js';
export { resolveEnvironment } from './utils/environment.js';
export type { MediaEnvironment } from './utils/environment.js';
export { MEDIA_PRESETS } from './presets.js';
export type { MediaPreset } from './presets.js';

export {
    validateMediaFile,
    ENTITY_ALLOWED_MIME_TYPES,
    AVATAR_ALLOWED_MIME_TYPES
} from './validate-media-file.js';

export type {
    ValidateMediaFileInput,
    ValidationContext,
    ValidationResult,
    ValidationSuccess,
    ValidationFailure
} from './validate-media-file.js';

export { CloudinaryProvider, ConfigurationError } from './provider/cloudinary.provider.js';
export type { CloudinaryProviderConfig } from './provider/cloudinary.provider.js';
export type {
    DeleteByPrefixOptions,
    DeleteOptions,
    ImageProvider,
    UploadOptions,
    UploadResult
} from './provider/types.js';

export { generateGalleryId } from './utils/gallery-id.js';

export { getMediaUrl } from './get-media-url.js';
export type { GetMediaUrlOptions } from './get-media-url.js';
