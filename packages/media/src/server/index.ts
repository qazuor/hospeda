/**
 * @repo/media/server — server-only barrel.
 *
 * Exports symbols that depend on Node-only APIs (Buffer, process env, file-type
 * magic-byte parsing, the Cloudinary SDK). Importing this entrypoint from
 * browser code is forbidden at the Biome level in apps/admin and apps/web.
 *
 * Browser-safe helpers (`getMediaUrl`, `MEDIA_PRESETS`, `extractPublicId`,
 * `generateGalleryId`) live in the root `@repo/media` entrypoint instead.
 */

export {
    CloudinaryProvider,
    ConfigurationError,
    InvalidFolderError
} from './cloudinary.provider.js';
export type { CloudinaryProviderConfig } from './cloudinary.provider.js';

export type {
    DeleteByPrefixOptions,
    DeleteOptions,
    DeleteResult,
    HealthCheckResult,
    ImageProvider,
    UploadOptions,
    UploadResult
} from './types.js';

export {
    AVATAR_ALLOWED_MIME_TYPES,
    ENTITY_ALLOWED_MIME_TYPES,
    validateMediaFile
} from './validate-media-file.js';
export type {
    ValidateMediaFileInput,
    ValidationContext,
    ValidationErrorCode,
    ValidationFailure,
    ValidationResult,
    ValidationSuccess
} from './validate-media-file.js';

export { resolveEnvironment } from './environment.js';
export type { MediaEnvironment } from './environment.js';

export { extractAllMediaPublicIds } from './extract-all-public-ids.js';
export type {
    EntityWithMedia,
    ExtractAllMediaPublicIdsOptions,
    MediaAssetLike,
    MediaLike
} from './extract-all-public-ids.js';
