import { AccommodationModel, OwnerPromotionModel } from '@repo/db';
import type { OwnerPromotionCreateInput } from '@repo/schemas';
import {
    LifecycleStatusEnum,
    OwnerPromotionDiscountTypeEnum,
    PermissionEnum,
    RoleEnum,
    TouristAudienceEnum
} from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { OwnerPromotionService } from '@repo/service-core';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';

/**
 * Narrow spec shape this module needs from a `TestUserSpec` (see
 * `testUsers.seed.ts`). Kept separate to avoid a circular import between the
 * two files. Mirrors {@link import('./hostAccommodation.js').HostAccommodationSpec}.
 */
export interface HostPromotionSpec {
    readonly email: string;
    readonly displayName: string;
}

/**
 * Actor permission set for the seed-owned promotion lifecycle: only creation
 * is needed here (no update/delete performed by the seed).
 */
const HOST_PROMOTION_ACTOR_PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.OWNER_PROMOTION_CREATE
];

/**
 * Resolves the local (before `@`) portion of an email, used to build stable,
 * per-host slugs (e.g. `host-pro@local.test` → `host-pro`). Duplicated from
 * `hostAccommodation.ts` (not exported there) to avoid a cross-module coupling
 * for a 3-line helper.
 */
export function emailLocalPart(email: string): string {
    return email.split('@')[0] ?? email;
}

/**
 * Returns a new `Date` at UTC midnight, offset by `days` from `anchor`
 * (negative `days` moves into the past). `anchor` must already be a
 * UTC-midnight `Date` (see {@link todayAtUtcMidnight}).
 *
 * BETA-88 note: `owner_promotions.validFrom` / `validUntil` are semantically
 * date-only values rendered in UTC by the web owner UI. Building them from a
 * local-timezone `Date` (e.g. `new Date(); d.setDate(d.getDate() + 7)`) can
 * shift the stored instant across a day boundary depending on the host
 * machine's timezone, reproducing the BETA-88 off-by-one. Always anchor to
 * UTC midnight first, then offset in whole days.
 *
 * @param anchor - A UTC-midnight `Date` to offset from.
 * @param days - Number of days to add (negative for a past date).
 * @returns A new UTC-midnight `Date`.
 */
export function utcMidnightOffset(anchor: Date, days: number): Date {
    return new Date(
        Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() + days)
    );
}

/**
 * Returns "today" normalized to UTC midnight (00:00:00.000Z), used as the
 * anchor for every offset computed by {@link utcMidnightOffset}.
 */
export function todayAtUtcMidnight(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Input for {@link buildHostPromotionInputs}.
 */
export interface BuildHostPromotionInputsInput {
    /** The narrow test-user spec (email + displayName). */
    readonly spec: HostPromotionSpec;
    /** Real DB id of the owning user. */
    readonly ownerId: string;
    /** Real DB id of the owner's seeded accommodation these promotions attach to. */
    readonly accommodationId: string;
    /** UTC-midnight anchor date ("today") the validity windows are offset from. */
    readonly today: Date;
}

/**
 * Builds the two `OwnerPromotionCreateInput` payloads seeded per HOST test
 * user (BETA-89): one currently active, one expired/archived.
 *
 * Pure function (no I/O) so it is unit-testable in isolation against
 * `OwnerPromotionCreateInputSchema`, mirroring
 * `buildHostAccommodationCoreFields` in `hostAccommodation.ts`.
 *
 * @param input - See {@link BuildHostPromotionInputsInput}.
 * @returns `{ active, expired }` — both valid against
 *   `OwnerPromotionCreateInputSchema`.
 *
 * @example
 * ```ts
 * const { active, expired } = buildHostPromotionInputs({
 *   spec: { email: 'host-pro@local.test', displayName: 'Host Pro' },
 *   ownerId: 'uuid-owner',
 *   accommodationId: 'uuid-accommodation',
 *   today: todayAtUtcMidnight()
 * });
 * ```
 */
export function buildHostPromotionInputs(input: BuildHostPromotionInputsInput): {
    active: OwnerPromotionCreateInput;
    expired: OwnerPromotionCreateInput;
} {
    const { spec, ownerId, accommodationId, today } = input;
    const slugSuffix = emailLocalPart(spec.email);

    const active: OwnerPromotionCreateInput = {
        slug: `promo-activa-${slugSuffix}`,
        ownerId,
        accommodationId,
        title: `20% de descuento — ${spec.displayName}`,
        description:
            'Promoción de prueba (seed) actualmente vigente, generada automáticamente para ejercitar el listado de promociones del propietario (BETA-89). No representa una oferta real.',
        discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
        discountValue: 20,
        minNights: 2,
        validFrom: utcMidnightOffset(today, -7),
        validUntil: utcMidnightOffset(today, 60),
        maxRedemptions: 50,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        touristAudience: TouristAudienceEnum.PLUS
    };

    const expired: OwnerPromotionCreateInput = {
        slug: `promo-vencida-${slugSuffix}`,
        ownerId,
        accommodationId,
        title: `Descuento de temporada — ${spec.displayName}`,
        description:
            'Promoción de prueba (seed) vencida y archivada, generada automáticamente para ejercitar los distintos estados del listado de promociones del propietario (BETA-89). No representa una oferta real.',
        discountType: OwnerPromotionDiscountTypeEnum.FIXED,
        discountValue: 5000,
        minNights: null,
        validFrom: utcMidnightOffset(today, -90),
        validUntil: utcMidnightOffset(today, -10),
        maxRedemptions: null,
        lifecycleState: LifecycleStatusEnum.ARCHIVED,
        touristAudience: TouristAudienceEnum.PLUS
    };

    return { active, expired };
}

/**
 * Resolves the id of the given owner's fully-featured seed accommodation
 * (created by {@link import('./hostAccommodation.js').ensureHostAccommodation}
 * earlier in the same seed run). Re-resolves by query instead of threading the
 * id through the caller, since `ensureHostAccommodation` only reports
 * `'created' | 'skipped'`.
 *
 * @throws {Error} When the owner has no non-deleted accommodation — indicates
 *   `ensureHostAccommodation` did not run (or failed) before this helper.
 */
async function resolveOwnerAccommodationId(ownerId: string, email: string): Promise<string> {
    const accommodationModel = new AccommodationModel();
    const { items } = await accommodationModel.findAll(
        { ownerId, deletedAt: null },
        { page: 1, pageSize: 1 }
    );
    const accommodation = items[0];
    if (!accommodation) {
        throw new Error(
            `Cannot seed host promotions for ${email}: owner has no accommodation. ensureHostAccommodation must run successfully before ensureHostPromotion.`
        );
    }
    return accommodation.id;
}

/**
 * Ensures the given HOST test user owns exactly two owner promotions attached
 * to their seeded accommodation (BETA-89): one currently active (valid date
 * window, `lifecycleState: ACTIVE`) and one expired/archived (past date
 * window, `lifecycleState: ARCHIVED`). This gives the "Mis promociones"
 * list/CRUD flows (web) and the admin owner-promotions list real data to
 * exercise locally, across both lifecycle badge states.
 *
 * Idempotent: if the user already owns at least one non-deleted promotion,
 * this is a no-op (logs and returns `'skipped'`). Never creates additional
 * promotions for the same test user on a re-run — this seed re-runs against
 * live staging.
 *
 * Created via `OwnerPromotionService.create()` (not a raw model insert) so
 * the normal `_beforeCreate` slug-uniqueness hook and lifecycle-event
 * emission run exactly as they would for a real owner request — mirrors how
 * {@link import('./hostAccommodation.js').ensureHostAccommodation} uses
 * `AccommodationService.create()` for its own top-level entity.
 *
 * @param params - `{ userId, spec }` — the owner's real DB id and the narrow
 *   test-user spec. The owner's accommodation id is resolved internally via
 *   {@link resolveOwnerAccommodationId}.
 * @returns `'created'` when new promotions were inserted, `'skipped'` when
 *   the user already had at least one.
 *
 * @throws {Error} When the owner has no accommodation yet, or when
 *   `OwnerPromotionService.create` fails validation/permissions.
 *
 * @example
 * ```ts
 * await ensureHostPromotion({
 *   userId: 'uuid-host-pro',
 *   spec: { email: 'host-pro@local.test', displayName: 'Host Pro' }
 * });
 * ```
 */
export async function ensureHostPromotion(params: {
    readonly userId: string;
    readonly spec: HostPromotionSpec;
}): Promise<'created' | 'skipped'> {
    const { userId, spec } = params;

    const promotionModel = new OwnerPromotionModel();
    const existing = await promotionModel.findByOwnerId(userId);
    if (existing.total > 0) {
        logger.info(
            `${STATUS_ICONS.Skip}    Skipping host promotions for ${spec.email} — already owns ${existing.total} promotion(s)`
        );
        return 'skipped';
    }

    const accommodationId = await resolveOwnerAccommodationId(userId, spec.email);

    const actor: Actor = {
        id: userId,
        role: RoleEnum.SUPER_ADMIN,
        permissions: HOST_PROMOTION_ACTOR_PERMISSIONS
    };

    const service = new OwnerPromotionService({});
    const { active, expired } = buildHostPromotionInputs({
        spec,
        ownerId: userId,
        accommodationId,
        today: todayAtUtcMidnight()
    });

    for (const input of [active, expired]) {
        const createResult = await service.create(actor, input);
        if (!createResult.data) {
            throw new Error(
                `Failed to create host promotion "${input.title}" for ${spec.email}: ${createResult.error?.message ?? 'unknown error'}`
            );
        }
    }

    logger.success({
        msg: `${STATUS_ICONS.Success}  Created 2 host promotions (1 active, 1 archived) for ${spec.email}`
    });

    return 'created';
}
