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
    /**
     * Duration in seconds for video assets. Undefined for images.
     * Added for SPEC-254 social media pipeline (T-025).
     */
    readonly durationSeconds?: number;
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
 * Result of a {@link ImageProvider.delete} call.
 *
 * `wasPresent` discriminates between an asset that existed at delete time
 * (Cloudinary returns `result === 'ok'`) and one that did not (`'not found'`).
 * The delete operation itself is idempotent — both outcomes resolve normally —
 * but callers (notably the admin DELETE route) need to surface the distinction
 * to the client so they can tell "deleted just now" from "already gone".
 *
 * SPEC-078-GAPS GAP-078-154.
 */
export interface DeleteResult {
    /**
     * `true` when the asset existed and was deleted by this call.
     * `false` when Cloudinary reported the asset did not exist (idempotent no-op).
     */
    readonly wasPresent: boolean;
}

/**
 * Options for deleting all images under a prefix.
 */
export interface DeleteByPrefixOptions {
    /** Folder prefix (e.g., 'hospeda/prod/accommodations/abc-123/'). */
    readonly prefix: string;
}

/**
 * Result of a {@link ImageProvider.healthCheck} call.
 *
 * `ok` is the discriminator: `true` means the provider's credentials are
 * valid and the upstream storage API responded successfully; `false` means
 * the check failed for any reason (bad creds, network error, 5xx upstream).
 *
 * `message` is an optional human-readable explanation surfaced to the
 * `/health/media` endpoint when `ok === false`. It MUST NOT include any
 * secret material — the implementation maps SDK errors to safe messages.
 *
 * SPEC-078-GAPS GAP-078-232.
 */
export interface HealthCheckResult {
    /** `true` when the provider successfully authenticated with its backend. */
    readonly ok: boolean;
    /** Optional human-readable description of the failure. Omitted on success. */
    readonly message?: string;
}

/**
 * Provider-agnostic interface for image storage operations.
 *
 * No app or package outside `packages/media` should interact with the
 * underlying storage SDK directly.
 */
export interface ImageProvider {
    upload(options: UploadOptions): Promise<UploadResult>;
    delete(options: DeleteOptions): Promise<DeleteResult>;
    deleteByPrefix(options: DeleteByPrefixOptions): Promise<void>;
    /**
     * Verifies the provider can authenticate with its upstream backend.
     *
     * Implementations MUST use a cheap, side-effect-free operation
     * (e.g. Cloudinary's `api.ping()`) and MUST NOT upload, list, or
     * mutate any asset. Errors are caught and surfaced as `{ok: false}`.
     */
    healthCheck(): Promise<HealthCheckResult>;
}
