import type { Actor } from '@repo/service-core';
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
     * Whether to run migrations before seeding
     * @default false
     */
    runMigrations: boolean;

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
    runMigrations: false,
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
