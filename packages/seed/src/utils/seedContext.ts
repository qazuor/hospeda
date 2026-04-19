import type { ImageProvider } from '@repo/media/server';
import type { Actor } from '@repo/service-core';
import type { ImageCache } from './cloudinary-cache.js';
import { IdMapper } from './idMapper.js';

/**
 * Discriminates whether an image job originates from the `required` or `example`
 * seed track. `example` jobs skip Cloudinary uploads entirely and preserve the
 * raw URL + attribution metadata coming from the seed JSON.
 */
export type SeedSource = 'required' | 'example';

/**
 * Per-run image processing counters, used to produce the final tally log line
 * at the end of the seed run.
 *
 * - `uploaded`: new successful Cloudinary uploads.
 * - `cached`: cache hits that skipped the network round-trip.
 * - `failures`: fetch/upload failures (either loud or tolerated via fallback).
 * - `skippedExample`: image jobs skipped because they came from the `example`
 *   track.
 */
export interface ImageProcessingCounters {
    uploaded: number;
    cached: number;
    failures: number;
    skippedExample: number;
}

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
     * Environment label for Cloudinary folder paths, e.g. 'dev', 'test', 'preview', 'prod'.
     * Resolved via `resolveEnvironment()` from `@repo/media/server`.
     */
    imageEnv?: string;

    /**
     * Discriminator set by `runRequiredSeeds` / `runExampleSeeds` before each
     * seed batch runs. Drives the behaviour of the Cloudinary image processor:
     * `required` → upload, `example` → skip (keep raw URL + attribution).
     */
    seedSource?: SeedSource;

    /**
     * When `true` and `seedSource === 'required'`, a fetch/upload failure is
     * logged as warn and the original URL is kept instead of aborting the run.
     * When `false` (default), required-source failures are fatal.
     */
    allowRequiredFallback?: boolean;

    /**
     * Mutable per-run counters for image processing telemetry. Populated by
     * the cloudinary image processor and printed at the end of the run.
     */
    imageCounters?: ImageProcessingCounters;

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

/**
 * Creates a fresh zeroed {@link ImageProcessingCounters} instance.
 */
export function createImageProcessingCounters(): ImageProcessingCounters {
    return {
        uploaded: 0,
        cached: 0,
        failures: 0,
        skippedExample: 0
    };
}
