/**
 * In-memory implementation of the {@link ImageProvider} interface for tests.
 *
 * Stores uploaded buffers and metadata in an internal Map keyed by the
 * resolved Cloudinary-style publicId. Returns a URL on the canonical
 * `res.cloudinary.com` host so the existing `extractPublicId` helper and
 * anything else that validates Cloudinary URLs keeps working unmodified.
 *
 * This is intentionally dumb: no transform parsing, no version handling.
 * It only needs to satisfy the storage contract so tests can exercise the
 * upload/delete round-trip without hitting the network.
 *
 * Lives under `@repo/media/test-utils` and MUST NOT be imported from
 * production code paths.
 */

import type {
    DeleteByPrefixOptions,
    DeleteOptions,
    ImageProvider,
    UploadOptions,
    UploadResult
} from '../server/types.js';

/**
 * Canonical Cloudinary delivery host. Matches `extractPublicId`'s strict
 * hostname check so URLs produced here can be parsed back out.
 */
const CLOUDINARY_HOSTNAME = 'res.cloudinary.com';

/**
 * Default cloud name used when building URLs. Arbitrary, but stable so tests
 * can assert on it if needed.
 */
const DEFAULT_CLOUD_NAME = 'test-cloud';

/**
 * Default width/height returned when the consumer doesn't specify them.
 */
const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 768;

/**
 * Shape of a record held by {@link InMemoryImageProvider}.
 */
export interface InMemoryImageRecord {
    readonly buffer: Buffer;
    readonly folder: string;
    readonly publicId: string;
    readonly tags: readonly string[];
    readonly width: number;
    readonly height: number;
    readonly url: string;
}

/**
 * Construction options for {@link InMemoryImageProvider}.
 */
export interface InMemoryImageProviderOptions {
    /**
     * Cloud name to use in the URL host path. Defaults to `test-cloud`.
     */
    readonly cloudName?: string;
    /**
     * Fixed width reported for every upload. Defaults to 1024.
     */
    readonly width?: number;
    /**
     * Fixed height reported for every upload. Defaults to 768.
     */
    readonly height?: number;
}

/**
 * Build a Cloudinary-style HTTPS URL for a given publicId.
 *
 * @param cloudName - Cloudinary cloud name segment
 * @param publicId - Resolved publicId (folder + name, no extension)
 * @returns Cloudinary HTTPS URL with a v1 version segment
 */
function buildUrl(cloudName: string, publicId: string): string {
    return `https://${CLOUDINARY_HOSTNAME}/${cloudName}/image/upload/v1/${publicId}`;
}

/**
 * In-memory test double for the Cloudinary-backed {@link ImageProvider}.
 *
 * @example
 * ```ts
 * const provider = new InMemoryImageProvider();
 * const result = await provider.upload({
 *   file: Buffer.from('fake'),
 *   folder: 'hospeda/prod/accommodations/abc',
 *   publicId: 'featured'
 * });
 * provider.get(result.publicId)?.buffer; // round-trip access
 * ```
 */
export class InMemoryImageProvider implements ImageProvider {
    private readonly store = new Map<string, InMemoryImageRecord>();
    private readonly cloudName: string;
    private readonly width: number;
    private readonly height: number;
    private uploadCounter = 0;

    constructor(options: InMemoryImageProviderOptions = {}) {
        this.cloudName = options.cloudName ?? DEFAULT_CLOUD_NAME;
        this.width = options.width ?? DEFAULT_WIDTH;
        this.height = options.height ?? DEFAULT_HEIGHT;
    }

    /**
     * Stores the buffer in memory and returns a Cloudinary-style URL.
     *
     * @param options - Upload options (folder, publicId, tags, file)
     * @returns Upload result with publicId, url, and dimensions
     */
    async upload(options: UploadOptions): Promise<UploadResult> {
        const { file, folder, publicId, tags } = options;
        const resolvedName = publicId ?? `generated-${++this.uploadCounter}`;
        const fullPublicId = `${folder}/${resolvedName}`;
        const url = buildUrl(this.cloudName, fullPublicId);

        const record: InMemoryImageRecord = {
            buffer: file,
            folder,
            publicId: fullPublicId,
            tags: tags ? [...tags] : [],
            width: this.width,
            height: this.height,
            url
        };

        this.store.set(fullPublicId, record);

        return {
            url,
            publicId: fullPublicId,
            width: this.width,
            height: this.height
        };
    }

    /**
     * Removes the asset with the given publicId, if present. Idempotent.
     *
     * @param options - Contains the publicId to delete
     */
    async delete(options: DeleteOptions): Promise<void> {
        this.store.delete(options.publicId);
    }

    /**
     * Removes every asset whose publicId starts with the given prefix.
     *
     * @param options - Contains the folder prefix to delete
     */
    async deleteByPrefix(options: DeleteByPrefixOptions): Promise<void> {
        const prefix = options.prefix;
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) {
                this.store.delete(key);
            }
        }
    }

    /**
     * Returns the stored record for a publicId, or undefined if absent.
     *
     * @param publicId - Resolved publicId
     */
    get(publicId: string): InMemoryImageRecord | undefined {
        return this.store.get(publicId);
    }

    /**
     * Returns true when the given publicId is present in the store.
     *
     * @param publicId - Resolved publicId
     */
    has(publicId: string): boolean {
        return this.store.has(publicId);
    }

    /**
     * Returns every stored record. Useful for test assertions.
     */
    list(): readonly InMemoryImageRecord[] {
        return Array.from(this.store.values());
    }

    /**
     * Clears every stored record. Useful between test runs.
     */
    clear(): void {
        this.store.clear();
        this.uploadCounter = 0;
    }

    /**
     * Returns the current number of stored records.
     */
    get size(): number {
        return this.store.size;
    }
}
