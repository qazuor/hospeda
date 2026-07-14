/**
 * Accommodation occupancy calendar service (HOS-43 Phase 1 — manual).
 *
 * Structural precedent: mirrors `accommodation.featured-toggle.ts` — fetch the
 * accommodation via the model, 404 if missing/soft-deleted, enforce
 * ownership (`hasPermission(actor, ...ANY)` OR `..._OWN`-equivalent +
 * `actor.id === accommodation.ownerId`) inline (no declarative `ownership:`
 * route config), throw `ServiceError` on denial. Functions return plain
 * values/arrays (not the service-core `Result<T>` envelope) — same
 * convention as `setAccommodationFeaturedToggle`/`getAccommodationFeaturedEntitlement`,
 * which this module is the direct sibling of.
 *
 * **Permission model (spec section 4.4 / 6):**
 * - Reads (owner or admin) require ONLY ownership / `ACCOMMODATION_OCCUPANCY_VIEW`
 *   — no `CAN_USE_CALENDAR` gate. A host who lost their calendar entitlement
 *   (e.g. downgraded plan) must still be able to SEE their existing occupancy
 *   data; only the ability to add/change it is gated.
 * - Writes (add/batch-toggle/remove) require `ACCOMMODATION_OCCUPANCY_MANAGE`
 *   AND ownership (or `ACCOMMODATION_UPDATE_ANY` staff bypass — there is no
 *   dedicated `ACCOMMODATION_OCCUPANCY_MANAGE_ANY` permission; reusing the
 *   existing accommodation-wide ANY permission for the staff bypass avoids
 *   adding a fourth permission for a single edge case). The `CAN_USE_CALENDAR`
 *   billing entitlement is enforced at the ROUTE layer (`requireEntitlement`
 *   in `apps/api/src/routes/accommodation/protected/{add,batch,remove}Occupancy.ts`),
 *   NOT here — gating it in the service via a direct DB-driven resolver
 *   diverged from the `loadEntitlements()` path the frontend gate trusts
 *   (which includes the HOST draft-defaults fallback), so a brand-new host
 *   with no subscription yet could see the calendar UI but have every write
 *   403. The route-level gate reads the same `userEntitlements` context the
 *   frontend gate is built on.
 *
 * @module services/accommodation/accommodation-occupancy
 */

import { AccommodationModel, accommodationOccupancyModel } from '@repo/db';
import type {
    Accommodation,
    AccommodationOccupancy,
    AccommodationOccupancyBatchInput,
    AccommodationOccupancyCreateInput,
    OccupancySourceEnum
} from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import { hasPermission } from '../../utils/permission.js';

/**
 * Minimal public-safe projection of an occupancy row (HOS-43 spec section 6:
 * "no internal notes/createdById leaked"). Deliberately omits `id`,
 * `accommodationId`, `externalEventId`, `note`, `createdById`, `createdAt`,
 * `updatedAt` — only what a tourist-facing consumer needs to know a day is
 * unavailable, and why (source, for a future "synced from Airbnb" badge).
 */
export interface PublicOccupancyEntry {
    readonly date: string;
    readonly isBlocked: boolean;
    readonly source: OccupancySourceEnum;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetches an accommodation by id, throwing `NOT_FOUND` when missing or
 * soft-deleted. Mirrors the guard in `setAccommodationFeaturedToggle`.
 *
 * The model is instantiated inside the function (not at module scope) so that
 * importing this module — e.g. via the service-core barrel — never touches the
 * `@repo/db` `AccommodationModel` export at load time. A top-level
 * `new AccommodationModel()` breaks collection of any test that partially mocks
 * `@repo/db` without that export. Matches `accommodation.featured-toggle.ts`.
 */
async function getAccommodationOrThrow(accommodationId: string): Promise<Accommodation> {
    const accommodationModel = new AccommodationModel();
    const accommodation = await accommodationModel.findById(accommodationId);
    if (!accommodation || accommodation.deletedAt !== null) {
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            `Accommodation not found: ${accommodationId}`
        );
    }
    return accommodation as Accommodation;
}

/**
 * Whether the actor may act as the accommodation's owner: either they ARE the
 * owner, or they hold the staff-wide `ACCOMMODATION_UPDATE_ANY` bypass.
 */
function isOwnerOrStaff(actor: Actor, accommodation: Accommodation): boolean {
    return (
        actor.id === accommodation.ownerId ||
        hasPermission(actor, PermissionEnum.ACCOMMODATION_UPDATE_ANY)
    );
}

/**
 * Enforces the protected-read ownership gate: the actor must own the
 * accommodation (or hold the staff `ACCOMMODATION_UPDATE_ANY` bypass).
 * No `CAN_USE_CALENDAR` check — reads are never gated by the entitlement.
 */
function assertOwnerReadAccess(actor: Actor, accommodation: Accommodation): void {
    if (!isOwnerOrStaff(actor, accommodation)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: actor must own this accommodation to view its occupancy calendar'
        );
    }
}

/**
 * Enforces the write gate for add/batch-toggle/remove: `ACCOMMODATION_OCCUPANCY_MANAGE`
 * AND ownership (or the `ACCOMMODATION_UPDATE_ANY` staff bypass). Does NOT
 * check `CAN_USE_CALENDAR` — that billing entitlement is enforced at the
 * route layer (`requireEntitlement`), not here (see module doc).
 */
function assertManageAccess(actor: Actor, accommodation: Accommodation): void {
    const hasManage = hasPermission(actor, PermissionEnum.ACCOMMODATION_OCCUPANCY_MANAGE);
    if (!hasManage || !isOwnerOrStaff(actor, accommodation)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: ACCOMMODATION_OCCUPANCY_MANAGE required, and actor must own this accommodation'
        );
    }
}

/**
 * Fetches occupancy rows for an accommodation — the full half-open range
 * `[from, to)` when both bounds are given, otherwise every row.
 */
async function fetchOccupancyRows(
    accommodationId: string,
    from?: string,
    to?: string
): Promise<AccommodationOccupancy[]> {
    if (from && to) {
        return accommodationOccupancyModel.findByAccommodationAndRange({
            accommodationId,
            from,
            to
        });
    }
    return accommodationOccupancyModel.findByAccommodation({ accommodationId });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Input for {@link getOwnerOccupancyForAccommodation}.
 */
export interface GetOwnerOccupancyForAccommodationInput {
    /** The actor requesting the calendar (must own the accommodation, or hold ACCOMMODATION_UPDATE_ANY). */
    readonly actor: Actor;
    /** The accommodation to read occupancy for. */
    readonly accommodationId: string;
    /** Inclusive lower bound, `YYYY-MM-DD`. Omit together with `to` to fetch every row. */
    readonly from?: string;
    /** Exclusive upper bound, `YYYY-MM-DD`. Omit together with `from` to fetch every row. */
    readonly to?: string;
}

/**
 * Reads an accommodation's occupancy calendar for its owner (protected
 * tier — `GET /api/v1/protected/accommodations/:id/occupancy`).
 *
 * Ownership-gated only — no `CAN_USE_CALENDAR` check (see module doc).
 *
 * @param input - Actor, accommodation id, and optional half-open date range.
 * @returns The full row set (with `note`/`createdById`/`source` intact — this
 *   is the owner-facing tier, not the public projection).
 * @throws {ServiceError} `NOT_FOUND` when the accommodation does not exist or
 *   is soft-deleted. `FORBIDDEN` when the actor does not own it and lacks
 *   `ACCOMMODATION_UPDATE_ANY`.
 */
export async function getOwnerOccupancyForAccommodation(
    input: GetOwnerOccupancyForAccommodationInput
): Promise<AccommodationOccupancy[]> {
    const { actor, accommodationId, from, to } = input;
    const accommodation = await getAccommodationOrThrow(accommodationId);
    assertOwnerReadAccess(actor, accommodation);
    return fetchOccupancyRows(accommodationId, from, to);
}

/**
 * Input for {@link getAdminOccupancyForAccommodation}.
 */
export interface GetAdminOccupancyForAccommodationInput {
    /** The actor requesting the calendar — must hold `ACCOMMODATION_OCCUPANCY_VIEW`. */
    readonly actor: Actor;
    /** The accommodation to read occupancy for. */
    readonly accommodationId: string;
    /** Inclusive lower bound, `YYYY-MM-DD`. Omit together with `to` to fetch every row. */
    readonly from?: string;
    /** Exclusive upper bound, `YYYY-MM-DD`. Omit together with `from` to fetch every row. */
    readonly to?: string;
}

/**
 * Reads an accommodation's occupancy calendar for staff (admin tier —
 * `GET /api/v1/admin/accommodations/:id/occupancy`).
 *
 * No ownership scoping (staff may view ANY accommodation's calendar);
 * re-checks `ACCOMMODATION_OCCUPANCY_VIEW` here as defense-in-depth even
 * though the admin route's `requiredPermissions` already enforces it via
 * middleware, in case this function is ever called from a context without
 * that middleware (e.g. a future cron/report).
 *
 * @param input - Actor, accommodation id, and optional half-open date range.
 * @returns The full row set for the accommodation.
 * @throws {ServiceError} `NOT_FOUND` when the accommodation does not exist or
 *   is soft-deleted. `FORBIDDEN` when the actor lacks `ACCOMMODATION_OCCUPANCY_VIEW`.
 */
export async function getAdminOccupancyForAccommodation(
    input: GetAdminOccupancyForAccommodationInput
): Promise<AccommodationOccupancy[]> {
    const { actor, accommodationId, from, to } = input;
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_OCCUPANCY_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: ACCOMMODATION_OCCUPANCY_VIEW required'
        );
    }
    await getAccommodationOrThrow(accommodationId);
    return fetchOccupancyRows(accommodationId, from, to);
}

/**
 * Input for {@link getPublicOccupancyForAccommodation}.
 */
export interface GetPublicOccupancyForAccommodationInput {
    /** The accommodation to read occupancy for. */
    readonly accommodationId: string;
    /** Inclusive lower bound, `YYYY-MM-DD`. Omit together with `to` to fetch every row. */
    readonly from?: string;
    /** Exclusive upper bound, `YYYY-MM-DD`. Omit together with `from` to fetch every row. */
    readonly to?: string;
}

/**
 * Reads an accommodation's BLOCKED days for the public tier (no actor —
 * `GET /api/v1/public/accommodations/:id/occupancy`).
 *
 * Returns the minimal {@link PublicOccupancyEntry} projection: `note` and
 * `createdById` are NEVER included in the response, and rows are filtered to
 * `isBlocked === true` (defensive — every Phase 1 row is already `true`, but
 * this keeps the contract correct if a future phase introduces a `false`
 * "explicitly free" row).
 *
 * @param input - Accommodation id and optional half-open date range.
 * @returns The public-safe occupancy projection.
 * @throws {ServiceError} `NOT_FOUND` when the accommodation does not exist or
 *   is soft-deleted.
 */
export async function getPublicOccupancyForAccommodation(
    input: GetPublicOccupancyForAccommodationInput
): Promise<PublicOccupancyEntry[]> {
    const { accommodationId, from, to } = input;
    await getAccommodationOrThrow(accommodationId);
    const rows = await fetchOccupancyRows(accommodationId, from, to);
    return rows
        .filter((row) => row.isBlocked)
        .map((row) => ({ date: row.date, isBlocked: row.isBlocked, source: row.source }));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Input for {@link addOccupancy}.
 */
export interface AddOccupancyInput {
    /** The actor performing the write (must own the accommodation, or hold ACCOMMODATION_UPDATE_ANY). */
    readonly actor: Actor;
    /** The single-day create input (carries `accommodationId`). */
    readonly input: AccommodationOccupancyCreateInput;
}

/**
 * Blocks a single day for an accommodation with `source=MANUAL`
 * (`POST /api/v1/protected/accommodations/:id/occupancy`).
 *
 * Idempotent (spec US-1): if the date already has a row — of ANY source —
 * the insert is a no-op (the model's `(accommodation_id, date)` unique
 * conflict target) and the existing row is returned instead of throwing.
 *
 * @param params - Actor and create input.
 * @returns The occupancy row for the requested date (newly inserted, or the
 *   pre-existing row when the date was already occupied).
 * @throws {ServiceError} `NOT_FOUND` when the accommodation does not exist or
 *   is soft-deleted. `FORBIDDEN` when the actor lacks `ACCOMMODATION_OCCUPANCY_MANAGE`
 *   / ownership. `INTERNAL_ERROR` in the (unreachable in practice) case where
 *   the conflict-skip row cannot be re-read.
 */
export async function addOccupancy(params: AddOccupancyInput): Promise<AccommodationOccupancy> {
    const { actor, input } = params;
    const accommodation = await getAccommodationOrThrow(input.accommodationId);
    assertManageAccess(actor, accommodation);

    const inserted = await accommodationOccupancyModel.batchUpsertManual({
        accommodationId: input.accommodationId,
        dates: [input.date],
        createdById: actor.id,
        note: input.note ?? null
    });

    if (inserted[0]) {
        return inserted[0];
    }

    // Conflict-skip: the date already had a row (any source). Idempotent
    // read-back instead of throwing (US-1: "re-togglear no duplica").
    const all = await accommodationOccupancyModel.findByAccommodation({
        accommodationId: input.accommodationId
    });
    const existing = all.find((row) => row.date === input.date);
    if (!existing) {
        // Unreachable in practice (the conflict that skipped the insert
        // implies a row exists), but fail loudly rather than return `undefined`.
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            `Occupancy row for ${input.date} could not be re-read after an insert conflict`
        );
    }
    return existing;
}

/**
 * Input for {@link batchToggleOccupancy}.
 */
export interface BatchToggleOccupancyInput {
    /** The actor performing the write (must own the accommodation, or hold ACCOMMODATION_UPDATE_ANY). */
    readonly actor: Actor;
    /** The batch toggle input (carries `accommodationId`, `dates`, `isBlocked`). */
    readonly input: AccommodationOccupancyBatchInput;
}

/**
 * Toggles a set of days blocked/unblocked for an accommodation
 * (`PATCH /api/v1/protected/accommodations/:id/occupancy/batch`).
 *
 * - `isBlocked: true` — idempotently upserts `source=MANUAL` rows for every
 *   date (pre-existing rows of any source are left untouched, per US-3).
 * - `isBlocked: false` — deletes only the `MANUAL` rows for those dates;
 *   sync-sourced rows (Phase 2/3) are never removable through this endpoint.
 *
 * Returns the POST-operation state for exactly the requested dates (whether
 * newly inserted, pre-existing, deleted, or an untouched sync row left behind
 * by an unblock) — a single re-fetch after the write, rather than trusting
 * the model's insert/delete return values, keeps the response correct in
 * every idempotent branch without duplicating the "what does each row look
 * like now" logic here.
 *
 * @param params - Actor and batch input.
 * @returns The current occupancy rows for the requested dates after the operation.
 * @throws {ServiceError} `NOT_FOUND` when the accommodation does not exist or
 *   is soft-deleted. `FORBIDDEN` when the actor lacks `ACCOMMODATION_OCCUPANCY_MANAGE`
 *   / ownership.
 */
export async function batchToggleOccupancy(
    params: BatchToggleOccupancyInput
): Promise<AccommodationOccupancy[]> {
    const { actor, input } = params;
    const accommodation = await getAccommodationOrThrow(input.accommodationId);
    assertManageAccess(actor, accommodation);

    if (input.isBlocked) {
        await accommodationOccupancyModel.batchUpsertManual({
            accommodationId: input.accommodationId,
            dates: input.dates,
            createdById: actor.id,
            note: input.note ?? null
        });
    } else {
        await accommodationOccupancyModel.deleteManualByDates({
            accommodationId: input.accommodationId,
            dates: input.dates
        });
    }

    const requestedDates = new Set(input.dates);
    const all = await accommodationOccupancyModel.findByAccommodation({
        accommodationId: input.accommodationId
    });
    return all.filter((row) => requestedDates.has(row.date));
}

/**
 * Input for {@link removeOccupancy}.
 */
export interface RemoveOccupancyInput {
    /** The actor performing the write (must own the accommodation, or hold ACCOMMODATION_UPDATE_ANY). */
    readonly actor: Actor;
    /** The accommodation to unblock a date on. */
    readonly accommodationId: string;
    /** `YYYY-MM-DD` date to unblock. */
    readonly date: string;
}

/**
 * Unblocks a single day for an accommodation
 * (`DELETE /api/v1/protected/accommodations/:id/occupancy/:date`).
 *
 * Only removes a `source=MANUAL` row for the date — a sync-sourced row
 * (Phase 2/3) for the same date is left untouched (US-1).
 *
 * @param params - Actor, accommodation id, and date.
 * @returns Whether a `MANUAL` row was actually deleted.
 * @throws {ServiceError} `NOT_FOUND` when the accommodation does not exist or
 *   is soft-deleted. `FORBIDDEN` when the actor lacks `ACCOMMODATION_OCCUPANCY_MANAGE`
 *   / ownership.
 */
export async function removeOccupancy(params: RemoveOccupancyInput): Promise<{ deleted: boolean }> {
    const { actor, accommodationId, date } = params;
    const accommodation = await getAccommodationOrThrow(accommodationId);
    assertManageAccess(actor, accommodation);

    const deletedCount = await accommodationOccupancyModel.deleteManualByDate({
        accommodationId,
        date
    });
    return { deleted: deletedCount > 0 };
}

// ---------------------------------------------------------------------------
// Reusable ownership guards (HOS-157 Phase 2 — calendar sync route layer)
// ---------------------------------------------------------------------------

/**
 * Input for {@link assertOccupancyManageAccess} / {@link assertOccupancyReadAccess}.
 */
export interface AssertOccupancyAccessInput {
    /** The actor whose access is being checked. */
    readonly actor: Actor;
    /** The accommodation the actor is trying to act on. */
    readonly accommodationId: string;
}

/**
 * Asserts the actor may MANAGE the accommodation's occupancy calendar
 * (`ACCOMMODATION_OCCUPANCY_MANAGE` + ownership, or the `ACCOMMODATION_UPDATE_ANY`
 * staff bypass), reusing the exact same gate as the manual write endpoints.
 *
 * Exposed for the Phase 2 Google Calendar sync routes (in `apps/api`, which
 * hold the OAuth/vault code and cannot live in service-core) so they enforce
 * the identical ownership + permission model without duplicating it. The
 * `CAN_SYNC_EXTERNAL_CALENDAR` billing entitlement is enforced separately at
 * the route via `requireEntitlement` (same split as `CAN_USE_CALENDAR` for the
 * manual endpoints — see this module's doc).
 *
 * @param input - Actor and accommodation id.
 * @returns The fetched accommodation (owner resolved).
 * @throws {ServiceError} `NOT_FOUND` when the accommodation does not exist or is
 * soft-deleted. `FORBIDDEN` when the actor lacks manage access.
 */
export async function assertOccupancyManageAccess(
    input: AssertOccupancyAccessInput
): Promise<Accommodation> {
    const accommodation = await getAccommodationOrThrow(input.accommodationId);
    assertManageAccess(input.actor, accommodation);
    return accommodation;
}

/**
 * Asserts the actor may READ the accommodation's occupancy calendar
 * (ownership, or the `ACCOMMODATION_UPDATE_ANY` staff bypass) — no entitlement
 * or MANAGE permission required, matching the read gate of the manual
 * endpoints. Used by the Phase 2 sync-status route.
 *
 * @param input - Actor and accommodation id.
 * @returns The fetched accommodation (owner resolved).
 * @throws {ServiceError} `NOT_FOUND` when the accommodation does not exist or is
 * soft-deleted. `FORBIDDEN` when the actor does not own it and lacks the staff bypass.
 */
export async function assertOccupancyReadAccess(
    input: AssertOccupancyAccessInput
): Promise<Accommodation> {
    const accommodation = await getAccommodationOrThrow(input.accommodationId);
    assertOwnerReadAccess(input.actor, accommodation);
    return accommodation;
}
