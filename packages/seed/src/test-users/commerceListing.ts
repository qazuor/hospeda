/**
 * Commerce-listing fixture for the SPEC-143 test-user matrix (HOS-694).
 *
 * The matrix had no way to reproduce an owner sitting AT their per-vertical
 * listing cap (AC-13 / AC-30): `commerce-gastronomy-at-cap@local.test` needs
 * exactly one gastronomy listing so the create route's
 * `enforceGastronomyLimit()` middleware refuses a second one locally, the
 * same way it refuses a real owner who already used their
 * `gastronomy-premium` plan's single slot.
 *
 * Mirrors `hostAccommodation.ts`'s shape (narrow spec interface, idempotency
 * check via a row count, a minimal actor, one direct `*Service` call) but
 * stays intentionally thinner: `enforceGastronomyLimit` counts rows via
 * `GastronomyService.count({ ownerId })` regardless of lifecycle/visibility
 * state, so this fixture needs no media, amenities, or FAQs to do its job —
 * a single DRAFT/PRIVATE row (the same shape the real owner-create route
 * produces, HOS-166 D-3) is sufficient.
 *
 * @module test-users/commerceListing
 */

import { DestinationModel, GastronomyModel } from '@repo/db';
import {
    type Destination,
    DestinationTypeEnum,
    type GastronomyAdminCreateInput,
    GastronomyAdminCreateInputSchema,
    GastronomyTypeEnum,
    LifecycleStatusEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/schemas';
import { type Actor, GastronomyService } from '@repo/service-core';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';

/**
 * Narrow spec shape this module needs from a `TestUserSpec` (see
 * `testUsers.seed.ts`). Kept separate to avoid a circular import between the
 * two files — same pattern as `HostAccommodationSpec` in `hostAccommodation.ts`.
 */
export interface CommerceListingSpec {
    readonly email: string;
    readonly displayName: string;
}

/**
 * Fallback CITY destination slug used to place the seed gastronomy listing.
 * Seeded by the required destination seed, so it is present on any DB that
 * has run `--required` (the precondition for `--test-users`).
 */
const DEFAULT_DESTINATION_SLUG = 'concepcion-del-uruguay';

/**
 * Resolves the CITY destination to use for the at-cap gastronomy fixture.
 *
 * Tries the well-known `concepcion-del-uruguay` slug first, falling back to
 * the first available CITY destination (sorted by slug for determinism) so
 * this does not hard-fail on a DB where that specific city was renamed or
 * removed — mirrors `resolveHostAccommodationDestination` in
 * `hostAccommodation.ts`.
 *
 * @throws {Error} When no CITY destination exists in the database.
 */
async function resolveDefaultDestination(destinationModel: DestinationModel): Promise<Destination> {
    const bySlug = await destinationModel.findOne({
        slug: DEFAULT_DESTINATION_SLUG,
        destinationType: DestinationTypeEnum.CITY
    });
    if (bySlug) {
        return bySlug;
    }

    const { items } = await destinationModel.findAll(
        { destinationType: DestinationTypeEnum.CITY, deletedAt: null },
        { page: 1, pageSize: 1, sortBy: 'slug', sortOrder: 'asc' }
    );
    const fallback = items[0];
    if (!fallback) {
        throw new Error(
            `No CITY destination found in the database (tried slug "${DEFAULT_DESTINATION_SLUG}" and a generic CITY fallback). Run the required seed (pnpm --filter @repo/seed seed --required) before seedTestUsers.`
        );
    }
    return fallback;
}

/**
 * Builds the create payload for the at-cap gastronomy fixture.
 *
 * Pure (no I/O) — validated via `GastronomyAdminCreateInputSchema.parse`, the
 * same schema `handleCreateGastronomyListing` re-parses through in the real
 * owner-create route, so every other `.default()` field (isFeatured,
 * moderationState, reviewsCount, averageRating) is populated identically to
 * a real request. `visibility: PRIVATE` / `lifecycleState: DRAFT` matches
 * D-3: every owner-created listing starts hidden.
 *
 * @param input.spec - The narrow test-user spec (email + displayName).
 * @param input.ownerId - Real DB id of the owning user.
 * @param input.destinationId - Real DB id of the CITY destination.
 * @returns A payload valid against `GastronomyAdminCreateInputSchema`.
 */
export function buildAtCapGastronomyListingInput(input: {
    readonly spec: CommerceListingSpec;
    readonly ownerId: string;
    readonly destinationId: string;
}): GastronomyAdminCreateInput {
    const { spec, ownerId, destinationId } = input;

    return GastronomyAdminCreateInputSchema.parse({
        name: `Comercio al tope — ${spec.displayName}`,
        summary: `Ficha de gastronomía de prueba (seed) que deja a "${spec.displayName}" en su tope de MAX_GASTRONOMIES (HOS-694).`,
        description: `Ficha de gastronomía generada automáticamente para el test user "${spec.displayName}" (HOS-694). Ocupa el único cupo del plan gastronomy-premium, así la ruta de creación de una segunda ficha lo rechaza en local (AC-13 / AC-30). No representa un comercio real.`,
        type: GastronomyTypeEnum.RESTAURANT,
        ownerId,
        destinationId,
        visibility: VisibilityEnum.PRIVATE,
        lifecycleState: LifecycleStatusEnum.DRAFT
    });
}

/**
 * Ensures the given COMMERCE_OWNER test user owns exactly one gastronomy
 * listing, so their `gastronomy-premium` subscription (`MAX_GASTRONOMIES: 1`)
 * starts AT its cap.
 *
 * Idempotent: if the user already owns at least one non-deleted gastronomy
 * listing, this is a no-op (logs and returns `'skipped'`) — never creates a
 * second one for the same test user on a re-run.
 *
 * @param params - `{ userId, spec }` — the owner's real DB id and the narrow
 *   test-user spec.
 * @returns `'created'` when a new listing was inserted, `'skipped'` when the
 *   user already had one.
 *
 * @throws {Error} When no CITY destination exists, or when
 *   `GastronomyService.create` fails validation.
 *
 * @example
 * ```ts
 * await ensureGastronomyAtCapListing({
 *   userId: 'uuid-commerce-gastronomy-at-cap',
 *   spec: { email: 'commerce-gastronomy-at-cap@local.test', displayName: 'Comercio Gastronomía Al Tope' }
 * });
 * ```
 */
export async function ensureGastronomyAtCapListing(params: {
    readonly userId: string;
    readonly spec: CommerceListingSpec;
}): Promise<'created' | 'skipped'> {
    const { userId, spec } = params;

    const gastronomyModel = new GastronomyModel();
    const existing = await gastronomyModel.findAll(
        { ownerId: userId, deletedAt: null },
        { page: 1, pageSize: 1 }
    );

    if (existing.total > 0) {
        logger.info(
            `${STATUS_ICONS.Skip}    Skipping at-cap gastronomy listing for ${spec.email} — already owns ${existing.total} gastronomy listing(s)`
        );
        return 'skipped';
    }

    const destinationModel = new DestinationModel();
    const destination = await resolveDefaultDestination(destinationModel);

    const createInput = buildAtCapGastronomyListingInput({
        spec,
        ownerId: userId,
        destinationId: destination.id
    });

    const actor: Actor = {
        id: userId,
        roles: [RoleEnum.COMMERCE_OWNER],
        permissions: []
    };

    const service = new GastronomyService({});
    const createResult = await service.create(actor, createInput);
    if (!createResult.data) {
        throw new Error(
            `Failed to create at-cap gastronomy listing for ${spec.email}: ${createResult.error?.message ?? 'unknown error'}`
        );
    }

    logger.success({
        msg: `${STATUS_ICONS.Success}  Created at-cap gastronomy listing "${createInput.name}" for ${spec.email}`
    });

    return 'created';
}
