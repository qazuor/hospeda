import type { ImageProvider, UploadOptions } from '@repo/media/server';
import { safeExternalFetch, safeExternalFetchBuffer } from '@repo/utils/safe-fetch';
import type { ServiceConfig } from '../../types';
import { serviceLogger } from '../../utils/service-logger';
import type { ServiceLogger } from '../../utils/service-logger';

export type StockImageProvider = 'unsplash' | 'pexels';

export interface ImportStockImageInput {
    readonly provider: StockImageProvider;
    readonly providerId: string;
    readonly fullUrl: string;
    readonly downloadLocation?: string;
    readonly photographer: string;
    readonly photographerUrl: string;
    readonly folder: string;
    readonly tags?: readonly string[];
}

export interface ImportStockImageResult {
    readonly url: string;
    readonly publicId: string;
    readonly width: number;
    readonly height: number;
    readonly attribution: {
        readonly photographer: string;
        readonly sourceUrl: string;
        readonly license: string;
        readonly provider: StockImageProvider;
    };
}

export interface ImageImportServiceConfig extends ServiceConfig {
    readonly mediaProvider: ImageProvider;
}

const UNSPLASH_LICENSE = 'Unsplash License';
const PEXELS_LICENSE = 'Pexels License';
const DOWNLOAD_TIMEOUT_MS = 15000;

export class ImageImportService {
    private readonly config: ImageImportServiceConfig;
    private readonly logger: ServiceLogger;

    constructor(config: ImageImportServiceConfig) {
        this.config = config;
        this.logger = serviceLogger;
    }

    async import(input: ImportStockImageInput): Promise<ImportStockImageResult> {
        const { provider, fullUrl, downloadLocation, photographer, photographerUrl, folder, tags } =
            input;

        this.logger.info(
            { provider, providerId: input.providerId, folder },
            'Stock image import started'
        );

        if (provider === 'unsplash' && downloadLocation) {
            await this.triggerUnsplashDownload(downloadLocation);
        }

        const buffer = await this.downloadImage(fullUrl);
        const uploadResult = await this.uploadToCloudinary(buffer, folder, tags, provider);
        const attribution = this.buildAttribution(photographer, photographerUrl, provider);

        this.logger.info(
            {
                provider,
                providerId: input.providerId,
                publicId: uploadResult.publicId
            },
            'Stock image import completed'
        );

        return {
            url: uploadResult.url,
            publicId: uploadResult.publicId,
            width: uploadResult.width,
            height: uploadResult.height,
            attribution
        };
    }

    private async triggerUnsplashDownload(downloadLocation: string): Promise<void> {
        this.logger.info({ downloadLocation }, 'Triggering Unsplash download tracking');

        const result = await safeExternalFetch({
            url: downloadLocation,
            timeoutMs: 5000,
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Hospeda/1.0'
            }
        });

        if (result.ok) {
            this.logger.info('Unsplash download trigger succeeded');
        } else {
            this.logger.warn({ error: result.error }, 'Unsplash download trigger failed');
        }
    }

    private async downloadImage(url: string): Promise<Buffer> {
        this.logger.debug({ url }, 'Downloading image from provider');

        const result = await safeExternalFetchBuffer({
            url,
            timeoutMs: DOWNLOAD_TIMEOUT_MS,
            headers: {
                'User-Agent': 'Hospeda/1.0',
                Accept: 'image/*'
            }
        });

        if (!result.ok) {
            throw new Error(`Failed to download image: ${result.error}`);
        }

        return result.body;
    }

    private async uploadToCloudinary(
        buffer: Buffer,
        folder: string,
        tags: readonly string[] | undefined,
        provider: StockImageProvider
    ): Promise<{ url: string; publicId: string; width: number; height: number }> {
        const uploadOptions: UploadOptions = {
            file: buffer,
            folder,
            tags: [...(tags ?? []), 'stock', provider],
            overwrite: true
        };

        this.logger.debug({ folder, tags: uploadOptions.tags }, 'Uploading to Cloudinary');

        const result = await this.config.mediaProvider.upload(uploadOptions);

        return {
            url: result.url,
            publicId: result.publicId,
            width: result.width,
            height: result.height
        };
    }

    private buildAttribution(
        photographer: string,
        photographerUrl: string,
        provider: StockImageProvider
    ): ImportStockImageResult['attribution'] {
        return {
            photographer,
            sourceUrl: photographerUrl,
            license: provider === 'unsplash' ? UNSPLASH_LICENSE : PEXELS_LICENSE,
            provider
        };
    }
}
