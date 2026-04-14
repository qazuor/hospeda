import { v2 as cloudinary } from 'cloudinary';
import type {
    DeleteByPrefixOptions,
    DeleteOptions,
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
    constructor(config: CloudinaryProviderConfig) {
        if (!config.cloudName) {
            throw new ConfigurationError('Missing HOSPEDA_CLOUDINARY_CLOUD_NAME');
        }
        if (!config.apiKey) {
            throw new ConfigurationError('Missing HOSPEDA_CLOUDINARY_API_KEY');
        }
        if (!config.apiSecret) {
            throw new ConfigurationError('Missing HOSPEDA_CLOUDINARY_API_SECRET');
        }

        cloudinary.config({
            cloud_name: config.cloudName,
            api_key: config.apiKey,
            api_secret: config.apiSecret
        });
    }

    /**
     * Uploads a file buffer to Cloudinary.
     *
     * @param options - Upload parameters including file buffer and folder path
     * @returns Resolved upload result with URL and dimensions
     * @throws {Error} If Cloudinary returns an incomplete or missing response
     */
    async upload(options: UploadOptions): Promise<UploadResult> {
        const { file, folder, publicId, tags, overwrite } = options;

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
     * is treated as success rather than an error.
     *
     * @param options - Contains the public ID of the asset to delete
     */
    async delete(options: DeleteOptions): Promise<void> {
        await cloudinary.uploader.destroy(options.publicId, {
            invalidate: true
        });
        // result.result is 'ok' or 'not found' — both are acceptable (idempotent delete)
    }

    /**
     * Deletes all assets under a folder prefix via the Admin API.
     *
     * @param options - Contains the folder prefix to delete
     */
    async deleteByPrefix(options: DeleteByPrefixOptions): Promise<void> {
        await cloudinary.api.delete_resources_by_prefix(options.prefix);
    }

    /**
     * Uploads a Buffer using upload_stream (wraps callback API in a Promise).
     *
     * @param buffer - Raw file buffer to upload
     * @param options - Cloudinary upload options passed to the stream
     * @returns Resolved Cloudinary upload response
     */
    private uploadBuffer(
        buffer: Buffer,
        options: Record<string, unknown>
    ): Promise<CloudinaryUploadResponse> {
        return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
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
            stream.end(buffer);
        });
    }
}
