import { resolveEnvironment } from '@repo/media/server';
import { MediaSchema } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { processEntityImages } from './cloudinary-image-processor.js';
import { errorHistory } from './errorHistory.js';
import { STATUS_ICONS } from './icons.js';
import { loadJsonFiles } from './loadJsonFile.js';
import { logger } from './logger.js';
import type { SeedContext } from './seedContext.js';
import { seedRunner } from './seedRunner.js';
import { summaryTracker } from './summaryTracker.js';

/**
 * Service constructor type - compatible with service constructors
 */
// biome-ignore lint/suspicious/noExplicitAny: Service constructors have varying signatures
type ServiceConstructor<T = unknown> = new (ctx: any, ...args: any[]) => T;

/**
 * Minimal model constructor shape required for the deterministic-id direct
 * insert path (HOS-25 T-015). Compatible with any `@repo/db` model class
 * extending `BaseModelImpl`, which always exposes a no-arg constructor and
 * `create(data)`.
 */
type SeedModelConstructor = new () => {
    create: (data: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Minimal model constructor shape required for the skip-if-exists lookup
 * (HOS-735). Compatible with any `@repo/db` model class extending
 * `BaseModelImpl`, whose `findOne(where)` does NOT filter soft-deleted rows.
 * That is deliberate: a soft-deleted row still occupies its UNIQUE key, so for
 * "would the insert collide?" it counts as existing.
 */
type SeedLookupModelConstructor = new () => {
    findOne: (where: Record<string, unknown>) => Promise<{ id?: string } | null>;
};

/**
 * Service result type with optional data and error information
 */
interface ServiceResult {
    /** Result data containing the created entity */
    data?: { id?: string };
    /** Error information if the operation failed */
    error?: { message: string; code: string; details?: Record<string, unknown> };
}

/**
 * Configuration for creating a seed factory.
 *
 * This interface defines all the options available for customizing
 * the behavior of a seed factory, including callbacks for different
 * stages of the seeding process.
 */
export interface SeedFactoryConfig<T = unknown, R = unknown> {
    // Basic configuration
    /** Name of the entity being seeded */
    entityName: string;
    /** Service class to use for creating entities */
    serviceClass: ServiceConstructor;
    /** Folder path containing the JSON files */
    folder: string;
    /** Array of JSON file names to process */
    files: string[];

    // Customizable callbacks
    /** Function to normalize data before creation */
    normalizer?: (data: Record<string, unknown>) => R;
    /** Function to get display information for an entity */
    getEntityInfo?: (item: unknown, context: SeedContext) => string;
    /** Function called before processing each item */
    preProcess?: (item: T, context: SeedContext) => Promise<void>;
    /** Function called after processing each item */
    postProcess?: (result: unknown, item: T, context: SeedContext) => Promise<void>;
    /** Custom error handler for individual items */
    errorHandler?: (item: unknown, index: number, error: Error) => void;
    /** Function to build relationships after entity creation */
    relationBuilder?: (result: unknown, item: T, context: SeedContext) => Promise<void>;

    // Advanced configuration
    /** Whether to continue processing when encountering errors */
    continueOnError?: boolean;
    /** Function to validate data before creation */
    validateBeforeCreate?: (data: Record<string, unknown> | R) => boolean | Promise<boolean>;
    /** Function to transform the result after creation */
    transformResult?: (result: unknown) => unknown;

    /**
     * Opt-in skip-if-exists (HOS-735). Makes a re-run of the seed additive
     * instead of failing on the first duplicate UNIQUE key.
     *
     * For each item the factory calls `getWhere(item, normalizedData)` and looks
     * the row up through `modelClass.findOne`. When a row is found the factory:
     *
     * - does NOT create anything, and does NOT touch the existing row (an
     *   operator's edits to a catalog row survive a re-run);
     * - does NOT process images (no upload for a row that will not be written);
     * - DOES record the seed-id -> real-id mapping, so downstream seeds that
     *   resolve relations through the `IdMapper` (destinations -> attractions,
     *   sponsorship packages -> levels) keep working on a re-run;
     * - does NOT run `postProcess` / `relationBuilder` (they describe the
     *   creation of the row, and would collide on their own deterministic
     *   keys), but DOES run `onExisting`, the explicit hook for the parts of
     *   `postProcess` that are safe and useful to repeat (idempotent healing).
     *
     * `getWhere` receives the RAW item and the normalized payload; return the
     * UNIQUE-key predicate (`{ slug }`, `{ email }`, ...). Omitting this option
     * keeps the previous behavior byte-for-byte.
     */
    existing?: {
        /** Model class used for the lookup (no-arg constructor exposing `findOne`). */
        modelClass: SeedLookupModelConstructor;
        /** Builds the UNIQUE-key predicate that identifies this item's row. */
        getWhere: (item: unknown, normalizedData: unknown) => Record<string, unknown>;
        /** Optional idempotent hook run instead of `postProcess` when the row already exists. */
        onExisting?: (result: unknown, item: T, context: SeedContext) => Promise<void>;
    };

    /**
     * Optional opt-in mechanism (HOS-25 T-015) for persisting an explicit,
     * caller-derived id instead of letting the database assign a random one
     * via the `defaultRandom()` column default.
     *
     * **Why this can't go through `service.create()`**: standard entity create
     * schemas omit `id` by convention (e.g. `@repo/schemas`'
     * `AccommodationCreateInputSchema = AccommodationSchema.omit({ id: true, ... })`,
     * documented as "Omits auto-generated fields (id, audit timestamps)").
     * `BaseCrudWrite.create()` validates its input against that schema via
     * `schema.safeParseAsync(params)` — a plain Zod object schema strips any key
     * that isn't part of its shape, so an `id` present in the payload is
     * silently dropped before it ever reaches `model.create()`. There is
     * currently no supported way to make `service.create()` honor an incoming
     * `id` for these entities.
     *
     * When `getId(item)` returns a value for a given fixture, this factory
     * bypasses `service.create()` for that item and instead performs a
     * **direct model insert** — the same pattern `required/systemUser.seed.ts`
     * uses for `SYSTEM_USER_ID`. `BaseModelImpl.create()` fully supports an
     * explicit primary key on `INSERT`; the column's `defaultRandom()` only
     * applies when the value is omitted.
     *
     * **Trade-off (read before enabling)**: bypassing `service.create()` also
     * bypasses its entire lifecycle — permission checks (`_canCreate`), the
     * *service's own* `normalizers.create`, and its `_beforeCreate`/
     * `_afterCreate` hooks (e.g. auto-slug generation, computed defaults).
     * This factory's own `preProcess` / `normalizer` / `validateBeforeCreate` /
     * `postProcess` / `relationBuilder` callbacks are unaffected and still run
     * exactly as configured. Only enable this for an entity once you've
     * confirmed none of the bypassed service-level hooks are load-bearing for
     * that entity's fixtures — or move any load-bearing computation into this
     * factory's own `normalizer`/`preProcess` first.
     *
     * When this option is omitted entirely (the default), or `getId()` returns
     * `undefined` for a specific item, behavior is byte-for-byte unchanged:
     * every item goes through `service.create()` and receives a
     * database-assigned random id.
     */
    deterministicId?: {
        /** Model class to instantiate for the direct insert. Must expose a no-arg constructor and `create(data)`, like any `@repo/db` model extending `BaseModelImpl`. */
        modelClass: SeedModelConstructor;
        /**
         * Derives the explicit id to persist for a given raw fixture item
         * (the same `item` passed to `preProcess`/`normalizer`, i.e. before
         * normalization). Return `undefined` to fall back to the default
         * `service.create()` path for that specific item.
         */
        getId: (item: unknown) => string | undefined;
    };
}

/**
 * Validates that the actor exists in the context.
 *
 * @param context - Seed context containing the actor
 * @returns The validated actor
 * @throws {Error} When actor is not available in context
 */
const validateActor = (context: SeedContext): Actor => {
    if (!context.actor) {
        throw new Error(
            `${STATUS_ICONS.Error} Actor not available in context. Super admin must be loaded first.`
        );
    }
    return context.actor;
};

/**
 * Default normalizer that passes through the data unchanged.
 *
 * @param data - Input data to normalize
 * @returns The same data without modification
 */
const defaultNormalizer = (data: Record<string, unknown>) => data;

/**
 * Default entity info formatter that extracts the name field.
 *
 * @param item - Entity item to format
 * @param context - Seed context (unused in default implementation)
 * @returns Formatted string with the entity name
 */
const defaultGetEntityInfo = (item: unknown, _context: SeedContext) => {
    const itemData = item as Record<string, unknown>;
    const name = itemData.name as string;
    return `"${name}"`;
};

/**
 * Creates a seed factory with customizable callbacks.
 *
 * This factory function provides a complete seeding solution with:
 * - JSON file loading and processing
 * - Progress tracking and logging
 * - Error handling and recovery
 * - Relationship building
 * - Customizable data transformation
 * - ID mapping and persistence
 *
 * @param config - Configuration for the seed factory
 * @returns A function that can be called with a seed context to execute the seeding
 *
 * @example
 * ```typescript
 * const seedUsers = createSeedFactory({
 *   entityName: 'Users',
 *   serviceClass: UserService,
 *   folder: 'src/data/user',
 *   files: ['users.json'],
 *   getEntityInfo: (user, context) => user.email
 * });
 *
 * await seedUsers(seedContext);
 * ```
 */
export const createSeedFactory = <T = unknown, R = unknown>(config: SeedFactoryConfig<T, R>) => {
    return async (context: SeedContext) => {
        // Validate actor
        validateActor(context);

        // Set current entity for error tracking
        context.currentEntity = config.entityName;

        // Load JSON files
        const items = await loadJsonFiles(config.folder, config.files);

        await seedRunner({
            entityName: config.entityName,
            items,
            context,

            // Use custom callback or default
            getEntityInfo: config.getEntityInfo || defaultGetEntityInfo,

            async process(item: unknown, index: number) {
                // Set current file for error tracking
                context.currentFile = config.files[index];

                // Pre-process callback
                if (config.preProcess) {
                    try {
                        await config.preProcess(item as T, context);
                    } catch (error) {
                        errorHistory.recordError(
                            config.entityName,
                            config.files[index] || `item-${index}`,
                            'Pre-processing failed',
                            error
                        );
                        throw error;
                    }
                }

                // Normalize data (custom or default)
                let normalizedData = config.normalizer
                    ? config.normalizer(item as Record<string, unknown>)
                    : defaultNormalizer(item as Record<string, unknown>);

                // HOS-735 skip-if-exists: an already-present row is neither created,
                // nor image-processed, nor validated. Only its id is needed (mapping).
                const existingRow = config.existing
                    ? await new config.existing.modelClass().findOne(
                          config.existing.getWhere(item, normalizedData)
                      )
                    : null;

                let result: ServiceResult;
                if (existingRow) {
                    logger.info(
                        `${STATUS_ICONS.Info} ${config.entityName}: already exists, skipping create (id: ${existingRow.id})`
                    );
                    result = { data: { id: existingRow.id } };
                } else {
                    // Process images: replace original URLs with Cloudinary URLs for the
                    // `required` seed source; skip entirely for `example` (preserve raw URL +
                    // attribution metadata from T-010).
                    const seedSource = context.seedSource ?? 'required';
                    const shouldProcess =
                        seedSource === 'example' ||
                        (context.imageProvider && context.imageCache && context.imageCachePath);
                    if (shouldProcess) {
                        const itemData = item as Record<string, unknown>;
                        const entityId = (itemData.id as string | undefined) ?? `item-${index}`;
                        normalizedData = (await processEntityImages({
                            data: normalizedData as Record<string, unknown>,
                            entityType: config.entityName.toLowerCase(),
                            entityId,
                            provider: context.imageProvider ?? null,
                            // These are safe no-ops when example/provider-null paths are taken.
                            cache: context.imageCache ?? {},
                            cachePath: context.imageCachePath ?? '',
                            env: context.imageEnv ?? resolveEnvironment(),
                            seedSource,
                            allowRequiredFallback: context.allowRequiredFallback ?? false,
                            counters: context.imageCounters
                        })) as typeof normalizedData;
                    }

                    // SPEC-078-GAPS GAP-078-084 — fail loudly on malformed media
                    // shape. Runs unconditionally (after potential cloudinary
                    // rewrite) so seeds reject invalid fixtures even when no
                    // image provider is configured. Skip when the entity has no
                    // `media` block (sponsors, organizers, attractions, etc.).
                    const processedMedia = (normalizedData as Record<string, unknown>).media;
                    if (processedMedia !== undefined && processedMedia !== null) {
                        try {
                            MediaSchema.parse(processedMedia);
                        } catch (error) {
                            errorHistory.recordError(
                                config.entityName,
                                config.files[index] || `item-${index}`,
                                'Media validation failed (MediaSchema.parse)',
                                error
                            );
                            throw error;
                        }
                    }

                    // Custom validation
                    if (config.validateBeforeCreate) {
                        try {
                            const isValid = await config.validateBeforeCreate(normalizedData);
                            if (!isValid) {
                                const error = new Error('Custom validation failed');
                                errorHistory.recordError(
                                    config.entityName,
                                    config.files[index] || `item-${index}`,
                                    'Validation failed',
                                    error
                                );
                                throw error;
                            }
                        } catch (error) {
                            errorHistory.recordError(
                                config.entityName,
                                config.files[index] || `item-${index}`,
                                'Validation error',
                                error
                            );
                            throw error;
                        }
                    }

                    const actor = validateActor(context);

                    // Resolve an explicit deterministic id (HOS-25 T-015), if this
                    // seed opted in. `item` is the raw fixture item (pre-normalization),
                    // matching the convention used by `getEntityInfo`/`preProcess`.
                    const deterministicIdConfig = config.deterministicId;
                    const explicitId = deterministicIdConfig?.getId(item);

                    if (deterministicIdConfig && explicitId !== undefined) {
                        // Deterministic-id path: bypass service.create() entirely and
                        // insert directly via the model — see the `deterministicId`
                        // JSDoc on `SeedFactoryConfig` for why this is necessary and
                        // what lifecycle steps are skipped as a result.
                        const model = new deterministicIdConfig.modelClass();
                        const entity = await model.create({
                            ...(normalizedData as Record<string, unknown>),
                            id: explicitId,
                            createdById: actor.id,
                            updatedById: actor.id
                        });
                        result = { data: entity as { id?: string } };
                    } else {
                        // Default path (unchanged): create entity via the service,
                        // which assigns a database-generated random id.
                        const serviceContext = { logger };
                        const service = new config.serviceClass(serviceContext) as {
                            create: (actor: Actor, data: unknown) => Promise<ServiceResult>;
                        };
                        result = await service.create(actor, normalizedData);
                    }

                    if (result.error) {
                        const error = new Error(result.error.message || 'Service creation failed');
                        errorHistory.recordError(
                            config.entityName,
                            config.files[index] || `item-${index}`,
                            `Service error: ${result.error.message}`,
                            error
                        );
                        throw error;
                    }
                }

                // Transform result if needed
                const finalResult = config.transformResult
                    ? config.transformResult(result)
                    : result;

                // Save ID mapping if available
                const serviceResult = finalResult as ServiceResult;
                if (serviceResult?.data?.id) {
                    const itemData = item as Record<string, unknown>;
                    const seedId = itemData.id as string;
                    if (!seedId) {
                        const error = new Error(
                            `${STATUS_ICONS.Error} [SEED_FACTORY] Could not get ID from item ${itemData.id}`
                        );
                        errorHistory.recordError(
                            config.entityName,
                            config.files[index] || `item-${index}`,
                            'ID mapping failed',
                            error
                        );
                        throw error;
                    }

                    // Get entity name for better logging
                    const entityName = config.getEntityInfo
                        ? config.getEntityInfo(item, context)
                        : undefined;

                    context.idMapper.setMapping(
                        config.entityName.toLowerCase(),
                        seedId,
                        serviceResult.data.id,
                        entityName
                    );
                }

                // Post-process callback. For a row that already existed the creation
                // hooks do not apply; only the explicit idempotent `onExisting` runs.
                if (existingRow && config.existing?.onExisting) {
                    try {
                        await config.existing.onExisting(finalResult, item as T, context);
                    } catch (error) {
                        errorHistory.recordError(
                            config.entityName,
                            config.files[index] || `item-${index}`,
                            'On-existing hook failed',
                            error
                        );
                        throw error;
                    }
                }
                if (!existingRow && config.postProcess) {
                    try {
                        await config.postProcess(finalResult, item as T, context);
                    } catch (error) {
                        errorHistory.recordError(
                            config.entityName,
                            config.files[index] || `item-${index}`,
                            'Post-processing failed',
                            error
                        );
                        throw error;
                    }
                }

                // Relation builder callback
                if (!existingRow && config.relationBuilder) {
                    try {
                        await config.relationBuilder(finalResult, item as T, context);
                    } catch (error) {
                        errorHistory.recordError(
                            config.entityName,
                            config.files[index] || `item-${index}`,
                            'Relation building failed',
                            error
                        );
                        // Don't throw here as the main entity was created successfully
                        logger.warn(
                            `${STATUS_ICONS.Warning} Failed to build relations for ${config.entityName}: ${error instanceof Error ? error.message : String(error)}`
                        );
                    }
                }

                // Track success
                summaryTracker.trackSuccess(config.entityName);
            },

            onError: config.errorHandler
        });
    };
};
