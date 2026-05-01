import { v2 as cloudinary } from 'cloudinary';
import pRetry, { AbortError } from 'p-retry';
import type {
    DeleteByPrefixOptions,
    DeleteOptions,
    DeleteResult,
    HealthCheckResult,
    ImageProvider,
    UploadOptions,
    UploadResult
} from './types.js';

/**
 * Configuration for the Cloudinary provider.
 */
export interface CloudinaryProviderConfig {
    readonly cloudName: string;
    readonly apiKey: string;
    readonly apiSecret: string;
    /**
     * Optional folder root prefix that ALL uploads must live under.
     *
     * Defaults to `'hospeda/'`. Override only for isolated test runs
     * (e.g. SPEC-092 E2E uses `'hospeda/e2e/{run-id}/'` so test uploads
     * never collide with real assets).
     *
     * Must end in `/` and contain only URL-safe characters.
     *
     * @default 'hospeda/'
     */
    readonly folderRoot?: string;
}

/**
 * Internal shape of a successful Cloudinary upload response.
 */
interface CloudinaryUploadResponse {
    secure_url: string;
    public_id: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
}

/**
 * Error thrown when Cloudinary credentials are missing or invalid.
 */
export class ConfigurationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConfigurationError';
    }
}

/**
 * Error thrown when a folder path does not satisfy the required `hospeda/` namespace prefix.
 *
 * All assets uploaded through this provider MUST live under the `hospeda/`
 * namespace to prevent cross-tenant collisions and accidental writes to the
 * Cloudinary root. This guard runs at `upload()` entry, before any SDK call.
 */
export class InvalidFolderError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidFolderError';
    }
}

/**
 * Allowed characters for a Cloudinary cloud name.
 *
 * Cloudinary cloud names are URL slugs and must only contain lowercase letters,
 * digits, underscores, and hyphens. Validating with this regex prevents invalid
 * configuration values (e.g. with spaces or `!`) from reaching the SDK or
 * being interpolated into URLs.
 */
const CLOUD_NAME_REGEX = /^[a-z0-9_-]+$/;

/**
 * Default folder prefix for all uploads when `CloudinaryProviderConfig.folderRoot`
 * is not set. Override is reserved for isolated test environments (SPEC-092).
 */
const DEFAULT_FOLDER_ROOT = 'hospeda/';

/**
 * Validation regex for `folderRoot` overrides. Must end in `/` and only
 * contain URL-safe characters (lowercase alphanumeric, `_`, `-`, `/`).
 */
const FOLDER_ROOT_REGEX = /^[a-z0-9_/-]+\/$/;

/**
 * p-retry configuration for destructive Cloudinary operations.
 *
 * Retries up to 3 additional attempts (4 total invocations) with an
 * exponential backoff factor of 3 starting at 1 second.
 *
 * Schedule (approx): attempt 1 immediate, then waits ~1s, ~3s, ~9s.
 *
 * SPEC-078-GAPS GAP-078-087.
 */
const RETRY_OPTIONS = { retries: 3, factor: 3, minTimeout: 1000 } as const;

/**
 * Determines whether a Cloudinary error represents a permanent 4xx failure
 * that should NOT be retried.
 *
 * Treats every `http_code` in the 400-499 range as permanent EXCEPT 429
 * (Too Many Requests), which is a transient rate-limit signal and IS
 * eligible for retry.
 *
 * SPEC-078-GAPS GAP-078-087.
 *
 * @param err - Error thrown by the Cloudinary SDK
 * @returns true if the error is a permanent 4xx (i.e. retry should abort)
 */
function isPermanent4xx(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) {
        return false;
    }
    const code = (err as { http_code?: unknown }).http_code;
    if (typeof code !== 'number') {
        return false;
    }
    return code >= 400 && code < 500 && code !== 429;
}

/**
 * Cloudinary implementation of the ImageProvider interface.
 *
 * All Cloudinary SDK interactions are encapsulated here.
 * No other package should import from the `cloudinary` npm package.
 *
 * @example
 * ```ts
 * const provider = new CloudinaryProvider({
 *   cloudName: process.env.HOSPEDA_CLOUDINARY_CLOUD_NAME,
 *   apiKey: process.env.HOSPEDA_CLOUDINARY_API_KEY,
 *   apiSecret: process.env.HOSPEDA_CLOUDINARY_API_SECRET,
 * });
 *
 * const result = await provider.upload({
 *   file: buffer,
 *   folder: 'hospeda/prod/accommodations/abc-123',
 * });
 * ```
 */
export class CloudinaryProvider implements ImageProvider {
    /**
     * Folder root prefix enforced on every upload.
     * Resolved from `CloudinaryProviderConfig.folderRoot` or {@link DEFAULT_FOLDER_ROOT}.
     */
    private readonly folderRoot: string;

    /**
     * @internal
     *
     * Direct instantiation is reserved for the canonical access point
     * `getMediaProvider()` in `apps/api/src/services/media.ts` and for
     * unit tests under `packages/media/src/server/__tests__/`.
     *
     * **Do NOT call `new CloudinaryProvider(...)` from application code.**
     * Application code (routes, services, seed pipelines) MUST resolve the
     * provider through `getMediaProvider()` so that a single configured
     * instance is reused process-wide.
     *
     * **Why this matters.** The Cloudinary SDK v2 keeps configuration in a
     * module-level singleton (`cloudinary.config({...})`). Constructing
     * multiple providers within the same process silently overwrites the
     * global SDK state, and the most recent constructor wins. Multi-instance
     * usage (e.g. multi-tenant credentials per-request) is therefore
     * unsupported and will produce hard-to-debug cross-tenant leaks.
     *
     * SPEC-078-GAPS GAP-078-028 + GAP-078-174.
     *
     * TODO(SPEC-078-GAPS follow-up): Biome 1.5.3 `noRestrictedImports` only
     * intercepts module imports, not `new ClassName(...)` AST nodes, so we
     * cannot lint-enforce this restriction today. Revisit once Biome ships
     * `useRestrictedSyntax` (or equivalent AST-level rule) and migrate the
     * remaining direct callers in `packages/seed/src/index.ts` and
     * `packages/seed/src/cli.ts` to `getMediaProvider()`.
     *
     * @see {@link getMediaProvider} in `apps/api/src/services/media.ts`
     * @param config - Validated Cloudinary credentials
     * @throws {ConfigurationError} When any credential is missing or the
     *   `cloudName` does not match the allowed slug regex
     */
    constructor(config: CloudinaryProviderConfig) {
        if (!config.cloudName) {
            throw new ConfigurationError('Missing HOSPEDA_CLOUDINARY_CLOUD_NAME');
        }
        if (!CLOUD_NAME_REGEX.test(config.cloudName)) {
            throw new ConfigurationError(
                'Invalid HOSPEDA_CLOUDINARY_CLOUD_NAME: must match /^[a-z0-9_-]+$/'
            );
        }
        if (!config.apiKey) {
            throw new ConfigurationError('Missing HOSPEDA_CLOUDINARY_API_KEY');
        }
        if (!config.apiSecret) {
            throw new ConfigurationError('Missing HOSPEDA_CLOUDINARY_API_SECRET');
        }

        const folderRoot = config.folderRoot ?? DEFAULT_FOLDER_ROOT;
        if (!FOLDER_ROOT_REGEX.test(folderRoot)) {
            throw new ConfigurationError(
                `Invalid folderRoot '${folderRoot}': must match ${FOLDER_ROOT_REGEX} (end in '/', URL-safe chars only)`
            );
        }
        this.folderRoot = folderRoot;

        cloudinary.config({
            cloud_name: config.cloudName,
            api_key: config.apiKey,
            api_secret: config.apiSecret
        });
    }

    /**
     * Uploads a file buffer to Cloudinary.
     *
     * No retry by design (SPEC-078-GAPS GAP-078-087): re-running an upload
     * with the same `publicId` after a partial failure can produce duplicate
     * or inconsistent state on the Cloudinary side, since uploads are not
     * provably idempotent at the SDK level. Callers must handle upload
     * failures explicitly (e.g. surface to user, request a fresh attempt).
     *
     * @param options - Upload parameters including file buffer and folder path
     * @returns Resolved upload result with URL and dimensions
     * @throws {Error} If Cloudinary returns an incomplete or missing response
     */
    async upload(options: UploadOptions): Promise<UploadResult> {
        const { file, folder, publicId, tags, overwrite } = options;

        if (!folder || !folder.startsWith(this.folderRoot)) {
            throw new InvalidFolderError(
                `Folder must start with '${this.folderRoot}' (received: '${folder ?? ''}')`
            );
        }

        const uploadOptions: Record<string, unknown> = {
            folder,
            overwrite: overwrite ?? true,
            resource_type: 'image' as const
        };

        if (publicId) {
            uploadOptions.public_id = publicId;
        }
        if (tags && tags.length > 0) {
            uploadOptions.tags = [...tags];
        }

        const result = await this.uploadBuffer(file, uploadOptions);

        if (!result.secure_url || !result.public_id) {
            throw new Error('Cloudinary returned an incomplete response');
        }

        return {
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height
        };
    }

    /**
     * Deletes a single asset by public ID.
     *
     * This operation is idempotent: a 'not found' result from Cloudinary
     * is treated as success rather than an error. The returned `wasPresent`
     * flag lets callers distinguish between "deleted just now" (`true`) and
     * "already absent" (`false`) without needing to inspect any error state.
     *
     * SPEC-078-GAPS GAP-078-154 — wasPresent is derived from Cloudinary's
     * `result` field: `'ok'` maps to `true`, `'not found'` maps to `false`.
     * Any other (defensive) value is treated as not-present so the caller can
     * still respond consistently.
     *
     * SPEC-078-GAPS GAP-078-087 — wrapped with `pRetry` (3 retries, factor 3,
     * minTimeout 1s). Retries on Cloudinary 429 (rate limit) and 5xx upstream
     * errors. Permanent 4xx responses (other than 429) abort retry via
     * `AbortError`.
     *
     * @param options - Contains the public ID of the asset to delete
     * @returns `{ wasPresent }` indicating whether the asset existed at delete time
     */
    async delete(options: DeleteOptions): Promise<DeleteResult> {
        const response = await pRetry(async () => {
            try {
                return (await cloudinary.uploader.destroy(options.publicId, {
                    invalidate: true
                })) as { result?: string } | undefined;
            } catch (err) {
                if (isPermanent4xx(err)) {
                    throw new AbortError(err as Error);
                }
                throw err;
            }
        }, RETRY_OPTIONS);

        const wasPresent = response?.result === 'ok';
        return { wasPresent };
    }

    /**
     * Deletes all assets under a folder prefix via the Admin API.
     *
     * SPEC-078-GAPS GAP-078-054 — passes `{ invalidate: true }` so the CDN
     * cache is invalidated immediately for every removed asset.
     *
     * SPEC-078-GAPS GAP-078-087 — wrapped with `pRetry` (3 retries, factor 3,
     * minTimeout 1s). Same retry policy as `delete()`: retry on 429 and 5xx,
     * abort on permanent 4xx.
     *
     * @param options - Contains the folder prefix to delete
     */
    async deleteByPrefix(options: DeleteByPrefixOptions): Promise<void> {
        await pRetry(async () => {
            try {
                await cloudinary.api.delete_resources_by_prefix(options.prefix, {
                    invalidate: true
                });
            } catch (err) {
                if (isPermanent4xx(err)) {
                    throw new AbortError(err as Error);
                }
                throw err;
            }
        }, RETRY_OPTIONS);
    }

    /**
     * Verifies Cloudinary credentials by calling the cheap `api.ping()` admin
     * endpoint. Does not upload, list, or mutate any asset.
     *
     * SPEC-078-GAPS GAP-078-232 — backs the public `/health/media` route.
     *
     * Returns `{ok: true}` when Cloudinary responds with `status === 'ok'`.
     * Any thrown error or non-ok response resolves to `{ok: false, message}`
     * with a sanitized message (the SDK's `error.message` plus, when present,
     * `http_code`). Secrets are NEVER included in the message.
     *
     * @returns Health check result indicating whether auth succeeded
     */
    async healthCheck(): Promise<HealthCheckResult> {
        try {
            const response = (await cloudinary.api.ping()) as { status?: string } | undefined;
            if (response?.status === 'ok') {
                return { ok: true };
            }
            return {
                ok: false,
                message: `Unexpected Cloudinary ping response: ${JSON.stringify(response ?? null)}`
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const httpCode =
                typeof err === 'object' && err !== null
                    ? (err as { http_code?: unknown }).http_code
                    : undefined;
            const suffix = typeof httpCode === 'number' ? ` (http_code=${httpCode})` : '';
            return { ok: false, message: `${message}${suffix}` };
        }
    }

    /**
     * Uploads a Buffer using upload_stream (wraps callback API in a Promise).
     *
     * Always applies two hardcoded defaults that callers cannot override:
     * - `invalidate: true` — purges the CDN edge cache when overwriting an
     *   existing `publicId` (e.g. avatar or gallery overwrites). Without this,
     *   Cloudinary may serve the stale asset for hours even after a successful
     *   upload.
     * - `eager_async: true` — when the caller supplies `eager: [...]`
     *   transformations, Cloudinary processes them in the background instead of
     *   blocking the HTTP response. Omitting this flag would tie response
     *   latency to eager-transform processing time.
     *
     * Intentionally NOT enabled: `exif`, `faces`, `moderation`. These flags
     * trigger paid Cloudinary add-ons that are not part of our pipeline.
     *
     * @param buffer - Raw file buffer to upload
     * @param options - Cloudinary upload options passed to the stream
     * @returns Resolved Cloudinary upload response
     */
    private uploadBuffer(
        buffer: Buffer,
        options: Record<string, unknown>
    ): Promise<CloudinaryUploadResponse> {
        // Merge caller options first, then apply hardcoded defaults so they
        // cannot be overridden by the caller.
        const streamOptions: Record<string, unknown> = {
            ...options,
            invalidate: true,
            eager_async: true
        };
        return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(streamOptions, (error, result) => {
                if (error) {
                    reject(error);
                } else if (result) {
                    resolve({
                        secure_url: result.secure_url,
                        public_id: result.public_id,
                        width: result.width,
                        height: result.height,
                        format: result.format,
                        bytes: result.bytes
                    });
                } else {
                    reject(new Error('Cloudinary returned no result'));
                }
            });
            // Surface stream-level transport errors so the promise rejects instead
            // of hanging silently when the underlying socket fails.
            stream.on('error', reject);
            stream.end(buffer);
        });
    }
}
