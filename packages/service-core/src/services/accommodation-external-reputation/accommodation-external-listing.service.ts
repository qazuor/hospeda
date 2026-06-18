/**
 * AccommodationExternalListingService (SPEC-237 T-007)
 *
 * Owner CRUD for external listing configuration rows.
 *
 * Each accommodation can have at most one listing per platform
 * (unique (accommodationId, platform) in the DB). The service:
 * - Validates ownership via {@link PermissionEnum.ACCOMMODATION_UPDATE_OWN}.
 * - Validates the actor owns the accommodation before any mutation.
 * - Maps `ALREADY_EXISTS`-style DB errors to a typed `VALIDATION_ERROR`.
 * - Exposes `setMasterToggle` to flip `accommodations.showExternalReputation`.
 *
 * This service deliberately does NOT extend {@link BaseCrudService}.  It is
 * a thin, stateless helper that owns no lifecycle pipeline — the same style
 * used by the billing and weather services.
 *
 * @module services/accommodation-external-reputation/accommodation-external-listing.service
 */

import type {
    AccommodationExternalListingModel,
    AccommodationModel,
    DrizzleClient
} from '@repo/db';
import type {
    AccommodationExternalListing,
    CreateAccommodationExternalListingInput,
    UpdateAccommodationExternalListingInput
} from '@repo/schemas';
import {
    CreateAccommodationExternalListingSchema,
    PermissionEnum,
    ServiceErrorCode,
    UpdateAccommodationExternalListingSchema
} from '@repo/schemas';
import { z } from 'zod';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import { hasPermission } from '../../utils/permission.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Checks that the given actor holds `ACCOMMODATION_UPDATE_OWN` or
 * `ACCOMMODATION_UPDATE_ANY`, and — when only `_OWN` is present — that the
 * accommodation's `ownerId` matches the actor id.
 *
 * @throws {ServiceError} FORBIDDEN if the permission check fails.
 */
function assertCanUpdateAccommodation(actor: Actor, accommodationOwnerId: string): void {
    const hasAny = hasPermission(actor, PermissionEnum.ACCOMMODATION_UPDATE_ANY);
    const hasOwn = hasPermission(actor, PermissionEnum.ACCOMMODATION_UPDATE_OWN);

    if (hasAny) {
        return;
    }

    if (hasOwn && actor.id === accommodationOwnerId) {
        return;
    }

    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Permission denied: ACCOMMODATION_UPDATE_OWN or ACCOMMODATION_UPDATE_ANY required, and actor must own the accommodation'
    );
}

/**
 * Returns the `ownerId` of the accommodation, throwing NOT_FOUND when it does
 * not exist or has been soft-deleted.
 */
async function resolveAccommodationOwnerId(
    accommodationModel: AccommodationModel,
    accommodationId: string,
    tx?: DrizzleClient
): Promise<string> {
    const accommodation = await accommodationModel.findById(accommodationId, tx);
    if (!accommodation || accommodation.deletedAt !== null) {
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            `Accommodation not found: ${accommodationId}`
        );
    }
    return accommodation.ownerId;
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

/**
 * Service for managing accommodation external listing configuration rows
 * (SPEC-237).
 *
 * Owner operations (`add`, `update`, `remove`, `setMasterToggle`) require
 * {@link PermissionEnum.ACCOMMODATION_UPDATE_OWN} and that the actor owns the
 * target accommodation, OR {@link PermissionEnum.ACCOMMODATION_UPDATE_ANY}
 * (admin override).
 *
 * @example
 * ```ts
 * const svc = new AccommodationExternalListingService(ctx, listingModel, accommodationModel);
 * const result = await svc.add(actor, {
 *   accommodationId: 'uuid',
 *   platform: ExternalPlatformEnum.GOOGLE,
 *   url: 'https://maps.google.com/...',
 *   showLink: true,
 *   showReviews: false,
 * });
 * ```
 */
export class AccommodationExternalListingService {
    private readonly listingModel: AccommodationExternalListingModel;
    private readonly accommodationModel: AccommodationModel;

    constructor(
        _ctx: ServiceConfig,
        listingModel: AccommodationExternalListingModel,
        accommodationModel: AccommodationModel
    ) {
        this.listingModel = listingModel;
        this.accommodationModel = accommodationModel;
    }

    // -------------------------------------------------------------------------
    // add
    // -------------------------------------------------------------------------

    /**
     * Registers a new external listing link for the given accommodation.
     *
     * Each accommodation may have at most one listing per platform. A duplicate
     * (accommodationId, platform) pair is rejected as a `VALIDATION_ERROR` with
     * reason `DUPLICATE_PLATFORM`.
     *
     * @param actor - The actor performing the operation.
     * @param data - Create input (accommodationId, platform, url, showLink, showReviews).
     * @param ctx - Optional service context (transaction).
     * @returns The newly created listing row on success; a typed error on failure.
     */
    async add(
        actor: Actor,
        data: CreateAccommodationExternalListingInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationExternalListing>> {
        const parsed = CreateAccommodationExternalListingSchema.safeParse(data);
        if (!parsed.success) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: `Validation failed: ${parsed.error.message}`
                }
            };
        }

        try {
            const ownerId = await resolveAccommodationOwnerId(
                this.accommodationModel,
                parsed.data.accommodationId,
                ctx?.tx
            );
            assertCanUpdateAccommodation(actor, ownerId);

            const row = await this.listingModel.create(
                {
                    ...parsed.data,
                    verified: false,
                    createdById: actor.id,
                    updatedById: actor.id
                } as unknown as Partial<AccommodationExternalListing>,
                ctx?.tx
            );

            if (!row) {
                return {
                    error: {
                        code: ServiceErrorCode.INTERNAL_ERROR,
                        message: 'Failed to create external listing'
                    }
                };
            }

            return { data: row };
        } catch (err) {
            if (err instanceof ServiceError) {
                return { error: { code: err.code, message: err.message, details: err.details } };
            }
            // Map DB unique-constraint violation to typed VALIDATION_ERROR
            const message = err instanceof Error ? err.message : String(err);
            if (
                message.toLowerCase().includes('unique') ||
                message.toLowerCase().includes('duplicate') ||
                message.toLowerCase().includes('conflict')
            ) {
                return {
                    error: {
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        message: `A listing for platform ${parsed.data.platform} already exists for this accommodation`,
                        details: { reason: 'DUPLICATE_PLATFORM' }
                    }
                };
            }
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error: ${message}`
                }
            };
        }
    }

    // -------------------------------------------------------------------------
    // update
    // -------------------------------------------------------------------------

    /**
     * Updates an existing external listing configuration.
     *
     * Platform is immutable after creation — callers that need to change the
     * platform must `remove` the existing listing and `add` a new one.
     *
     * @param actor - The actor performing the operation.
     * @param id - The listing row UUID.
     * @param data - Partial update (url, showLink, showReviews, externalId).
     * @param ctx - Optional service context (transaction).
     * @returns The updated listing row on success; a typed error on failure.
     */
    async update(
        actor: Actor,
        id: string,
        data: UpdateAccommodationExternalListingInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationExternalListing>> {
        const parsed = UpdateAccommodationExternalListingSchema.safeParse(data);
        if (!parsed.success) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: `Validation failed: ${parsed.error.message}`
                }
            };
        }

        try {
            const listing = await this.listingModel.findById(id, ctx?.tx);
            if (!listing || listing.deletedAt !== null) {
                return {
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: `External listing not found: ${id}`
                    }
                };
            }

            const ownerId = await resolveAccommodationOwnerId(
                this.accommodationModel,
                listing.accommodationId,
                ctx?.tx
            );
            assertCanUpdateAccommodation(actor, ownerId);

            const updated = await this.listingModel.update(
                { id },
                {
                    ...parsed.data,
                    updatedById: actor.id
                } as unknown as Partial<AccommodationExternalListing>,
                ctx?.tx
            );

            if (!updated) {
                return {
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: `External listing not found after update: ${id}`
                    }
                };
            }

            return { data: updated };
        } catch (err) {
            if (err instanceof ServiceError) {
                return { error: { code: err.code, message: err.message, details: err.details } };
            }
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`
                }
            };
        }
    }

    // -------------------------------------------------------------------------
    // remove
    // -------------------------------------------------------------------------

    /**
     * Soft-deletes an external listing configuration.
     *
     * The corresponding reputation cache row is NOT deleted by this call — the
     * background fetcher and the public display query both check `listing.showLink
     * | listing.showReviews`, so soft-deleted listings are naturally excluded from
     * public reads and future fetch runs.
     *
     * @param actor - The actor performing the operation.
     * @param id - The listing row UUID.
     * @param ctx - Optional service context (transaction).
     * @returns `{ data: true }` on success; a typed error on failure.
     */
    async remove(actor: Actor, id: string, ctx?: ServiceContext): Promise<ServiceOutput<boolean>> {
        try {
            const listing = await this.listingModel.findById(id, ctx?.tx);
            if (!listing || listing.deletedAt !== null) {
                return {
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: `External listing not found: ${id}`
                    }
                };
            }

            const ownerId = await resolveAccommodationOwnerId(
                this.accommodationModel,
                listing.accommodationId,
                ctx?.tx
            );
            assertCanUpdateAccommodation(actor, ownerId);

            await this.listingModel.softDelete({ id }, ctx?.tx);

            return { data: true };
        } catch (err) {
            if (err instanceof ServiceError) {
                return { error: { code: err.code, message: err.message, details: err.details } };
            }
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`
                }
            };
        }
    }

    // -------------------------------------------------------------------------
    // setMasterToggle
    // -------------------------------------------------------------------------

    /**
     * Flips the `accommodations.showExternalReputation` master toggle for the
     * given accommodation.
     *
     * When `false`, the public detail page hides all external reputation blocks
     * regardless of individual listing `showLink` / `showReviews` flags.
     *
     * @param actor - The actor performing the operation.
     * @param accommodationId - UUID of the accommodation.
     * @param value - The new value for `showExternalReputation`.
     * @param ctx - Optional service context (transaction).
     * @returns `{ data: true }` on success; a typed error on failure.
     */
    async setMasterToggle(
        actor: Actor,
        accommodationId: string,
        value: boolean,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<boolean>> {
        const idSchema = z.string().uuid();
        const parsed = idSchema.safeParse(accommodationId);
        if (!parsed.success) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: `Invalid accommodationId: ${parsed.error.message}`
                }
            };
        }

        try {
            const ownerId = await resolveAccommodationOwnerId(
                this.accommodationModel,
                accommodationId,
                ctx?.tx
            );
            assertCanUpdateAccommodation(actor, ownerId);

            await this.accommodationModel.update(
                { id: accommodationId },
                { showExternalReputation: value, updatedById: actor.id } as unknown as Parameters<
                    typeof this.accommodationModel.update
                >[1],
                ctx?.tx
            );

            return { data: true };
        } catch (err) {
            if (err instanceof ServiceError) {
                return { error: { code: err.code, message: err.message, details: err.details } };
            }
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`
                }
            };
        }
    }
}
