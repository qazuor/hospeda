/**
 * Result of a successful image upload.
 */
export interface UploadResult {
    /** Base Cloudinary URL (HTTPS, no transforms). */
    readonly url: string;
    /** Cloudinary public ID for the asset. */
    readonly publicId: string;
    /** Image width in pixels. */
    readonly width: number;
    /** Image height in pixels. */
    readonly height: number;
}

/**
 * Options for uploading an image.
 */
export interface UploadOptions {
    /** Raw file buffer. */
    readonly file: Buffer;
    /** Cloudinary folder path (e.g., 'hospeda/prod/accommodations/abc-123'). */
    readonly folder: string;
    /** Custom public ID (filename without folder). If omitted, Cloudinary generates one. */
    readonly publicId?: string;
    /** Tags for the asset. */
    readonly tags?: readonly string[];
    /** Whether to overwrite existing asset at the same public ID. Default: true for signed uploads. */
    readonly overwrite?: boolean;
}

/**
 * Options for deleting a single image.
 */
export interface DeleteOptions {
    /** Cloudinary public ID of the asset to delete. */
    readonly publicId: string;
}

/**
 * Options for deleting all images under a prefix.
 */
export interface DeleteByPrefixOptions {
    /** Folder prefix (e.g., 'hospeda/prod/accommodations/abc-123/'). */
    readonly prefix: string;
}

/**
 * Provider-agnostic interface for image storage operations.
 *
 * No app or package outside `packages/media` should interact with the
 * underlying storage SDK directly.
 */
export interface ImageProvider {
    upload(options: UploadOptions): Promise<UploadResult>;
    delete(options: DeleteOptions): Promise<void>;
    deleteByPrefix(options: DeleteByPrefixOptions): Promise<void>;
}
