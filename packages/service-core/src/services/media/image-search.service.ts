import { safeExternalFetch } from '@repo/utils/safe-fetch';
import type { ServiceConfig } from '../../types';
import { serviceLogger } from '../../utils/service-logger';
import type { ServiceLogger } from '../../utils/service-logger';

export type StockImageProvider = 'unsplash' | 'pexels';

export interface StockImageResult {
    readonly providerId: string;
    readonly provider: StockImageProvider;
    readonly thumbUrl: string;
    readonly fullUrl: string;
    readonly width: number;
    readonly height: number;
    readonly photographer: string;
    readonly photographerUrl: string;
    readonly downloadLocation?: string;
}

export interface SearchImagesInput {
    readonly provider: StockImageProvider;
    readonly query: string;
    readonly orientation?: 'landscape' | 'portrait' | 'squarish';
    readonly page?: number;
    readonly perPage?: number;
}

export interface ImageSearchServiceConfig extends ServiceConfig {
    readonly unsplashAccessKey: string;
    readonly pexelsApiKey: string;
}

export class ImageSearchService {
    private readonly config: ImageSearchServiceConfig;
    private readonly logger: ServiceLogger;

    constructor(config: ImageSearchServiceConfig) {
        this.config = config;
        this.logger = serviceLogger;
    }

    async search(input: SearchImagesInput): Promise<StockImageResult[]> {
        const { provider, query, orientation, page = 1, perPage = 20 } = input;

        this.logger.info({ provider, query, orientation, page, perPage }, 'Image search request');

        if (provider === 'unsplash') {
            return this.searchUnsplash(query, orientation, page, perPage);
        }

        return this.searchPexels(query, orientation, page, perPage);
    }

    private async searchUnsplash(
        query: string,
        orientation: SearchImagesInput['orientation'],
        page: number,
        perPage: number
    ): Promise<StockImageResult[]> {
        const params = new URLSearchParams({
            query,
            page: String(page),
            per_page: String(Math.min(perPage, 30)),
            orientation: orientation ?? '',
            client_id: this.config.unsplashAccessKey
        });

        const url = `https://api.unsplash.com/search/photos?${params.toString()}`;

        const result = await safeExternalFetch({
            url,
            timeoutMs: 10000,
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Hospeda/1.0'
            }
        });

        if (!result.ok) {
            this.logger.warn(
                { error: result.error, status: result.status },
                'Unsplash search failed'
            );
            return [];
        }

        return this.mapUnsplashResponse(result.body);
    }

    private async searchPexels(
        query: string,
        orientation: SearchImagesInput['orientation'],
        page: number,
        perPage: number
    ): Promise<StockImageResult[]> {
        const params = new URLSearchParams({
            query,
            page: String(page),
            per_page: String(Math.min(perPage, 80)),
            orientation: orientation ?? ''
        });

        const url = `https://api.pexels.com/v1/search?${params.toString()}`;

        const result = await safeExternalFetch({
            url,
            timeoutMs: 10000,
            headers: {
                Authorization: this.config.pexelsApiKey,
                Accept: 'application/json',
                'User-Agent': 'Hospeda/1.0'
            }
        });

        if (!result.ok) {
            this.logger.warn(
                { error: result.error, status: result.status },
                'Pexels search failed'
            );
            return [];
        }

        return this.mapPexelsResponse(result.body);
    }

    private mapUnsplashResponse(body: string): StockImageResult[] {
        try {
            const data = JSON.parse(body) as {
                results: Array<{
                    id: string;
                    urls: { small: string; full: string; regular: string; raw: string };
                    width: number;
                    height: number;
                    user: { name: string; links: { html: string } };
                    links: { download_location: string };
                }>;
            };

            return data.results.map((photo) => ({
                providerId: photo.id,
                provider: 'unsplash' as const,
                thumbUrl: photo.urls.small,
                fullUrl: photo.urls.regular,
                width: photo.width,
                height: photo.height,
                photographer: photo.user.name,
                photographerUrl: photo.user.links.html,
                downloadLocation: photo.links.download_location
            }));
        } catch (err) {
            this.logger.error({ err }, 'Failed to parse Unsplash response');
            return [];
        }
    }

    private mapPexelsResponse(body: string): StockImageResult[] {
        try {
            const data = JSON.parse(body) as {
                photos: Array<{
                    id: string;
                    src: { small: string; large: string; original: string };
                    width: number;
                    height: number;
                    photographer: string;
                    photographer_url: string;
                }>;
            };

            return data.photos.map((photo) => ({
                providerId: String(photo.id),
                provider: 'pexels' as const,
                thumbUrl: photo.src.small,
                fullUrl: photo.src.large,
                width: photo.width,
                height: photo.height,
                photographer: photo.photographer,
                photographerUrl: photo.photographer_url
            }));
        } catch (err) {
            this.logger.error({ err }, 'Failed to parse Pexels response');
            return [];
        }
    }
}
