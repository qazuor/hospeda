import type { ImageProvider } from '@repo/media';
import type { Actor } from '@repo/service-core';
import type { ImageCache } from './cloudinary-cache.js';
import { IdMapper } from './idMapper.js';

/**
 * Context configuration for seed operations
 */
export interface SeedContext {
    /**
     * Whether to continue processing when encountering errors
     * @default false
     */
    continueOnError: boolean;

    /**
     * Whether to validate manifests before seeding
     * @default true
     */
    validateManifests: boolean;

    /**
     * Whether to reset database before seeding
     * @default false
     */
    resetDatabase: boolean;

    /**
     * Entities to exclude from seeding
     * @default []
     */
    exclude: string[];

    /**
     * Actor to use for seeding operations
     * @default undefined (will be set after super admin is created)
     */
    actor?: Actor;

    /**
     * ID mapper for converting seed IDs to real database IDs
     * Used for handling relationships between entities during seeding
     */
    idMapper: IdMapper;

    /**
     * Cloudinary image provider, or undefined when Cloudinary is not configured.
     * When undefined, image uploads are skipped and original URLs are kept.
     */
    imageProvider?: ImageProvider;

    /**
     * In-memory Cloudinary cache, populated at seed startup.
     * Only set when `imageProvider` is defined.
     */
    imageCache?: ImageCache;

    /**
     * Absolute path to the Cloudinary cache JSON file.
     * Only set when `imageProvider` is defined.
     */
    imageCachePath?: string;

    /**
     * Environment label for Cloudinary folder paths, e.g. 'development'.
     * Defaults to NODE_ENV.
     */
    imageEnv?: string;

    /**
     * Current entity being processed (for error tracking)
     * @internal
     */
    currentEntity?: string;

    /**
     * Current file being processed (for error tracking)
     * @internal
     */
    currentFile?: string;
}

/**
 * Default seed context configuration
 */
export const defaultSeedContext: SeedContext = {
    continueOnError: false,
    validateManifests: true,
    resetDatabase: false,
    exclude: [],
    idMapper: new IdMapper()
};

/**
 * Create a seed context with custom options
 */
export function createSeedContext(overrides: Partial<SeedContext> = {}): SeedContext {
    return {
        ...defaultSeedContext,
        ...overrides
    };
}
