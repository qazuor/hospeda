import { AccommodationModel, OwnerPromotionModel, TouristPriceAlertModel } from '@repo/db';
import type { Accommodation, OwnerPromotion, PriceAlert } from '@repo/schemas';
import { LifecycleStatusEnum } from '@repo/schemas';

/**
 * A single-page fetch size for the active-promotions, active-alerts, and
 * per-owner-accommodation scans. Mirrors `MAX_PAGE_SIZE`
 * (`packages/db/src/base/base.model.ts`) — `BaseModel.findAll()` silently
 * caps any larger request at that value, so requesting exactly the cap keeps
 * the pagination math (`items.length === pageSize` ⇒ "there might be more")
 * correct without hardcoding a second constant that could drift from the
 * model's real cap.
 */
const SCAN_PAGE_SIZE = 200;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Input for {@link PromoOfferEvaluatorService.evaluatePromoOffers}.
 */
export interface EvaluatePromoOffersInput {
    /**
     * Only promotions that were created OR updated on or after this instant
     * are considered.
     *
     * IMPORTANT — `activatedAt` substitution: the original SPEC-286 task text
     * asked for `(created_at >= since OR activated_at >= since)`, but there is
     * NO `activated_at` column on `owner_promotions`
     * (`packages/db/src/schemas/owner-promotion/owner_promotion.dbschema.ts`)
     * — `OwnerPromotionService._afterUpdate` only emits an in-memory
     * `ACTIVATED` lifecycle event (structured logging, no dedicated
     * timestamp column) when a promotion transitions to `ACTIVE`
     * (`ownerPromotion.lifecycle-events.ts`). This evaluator uses
     * `(createdAt >= since OR updatedAt >= since)` instead: any promotion
     * that just transitioned to `ACTIVE` within the window necessarily had
     * its `updatedAt` bumped by that same `UPDATE` statement (standard
     * audit-field behavior — see `BaseAuditFields`), so this correctly
     * captures both "brand new promo" (via `createdAt`) and "promo just
     * activated" (via `updatedAt`) without requiring a dedicated column.
     */
    since: Date;
    /**
     * Override for "now" when evaluating each promotion's active window
     * (`validFrom <= now <= validUntil`). Defaults to `new Date()`. Exposed
     * mainly so tests can pin a fixed instant instead of depending on the
     * real wall clock (mirrors the injectable-threshold pattern in
     * `PriceDropEvaluatorService`'s constructor).
     */
    now?: Date;
}

/**
 * A single promo-offer match: one active, in-window owner promotion that
 * applies to an accommodation a tourist has a price-alert subscription on.
 *
 * Field-for-field identical to `PromoOfferMatch` in
 * `packages/notifications/src/types/alert.types.ts` (T-008) — that copy is
 * intentionally re-declared there (not imported) to avoid a circular
 * dependency between `@repo/service-core` and `@repo/notifications`. Keep
 * both shapes in sync if either changes.
 */
export interface PromoOfferMatch {
    /** ID of the owner promotion that qualified. */
    promotionId: string;
    /** ID of the accommodation the promotion applies to. */
    accommodationId: string;
    /** Display name of the accommodation. */
    accommodationName: string;
    /** Slug of the accommodation, used to build the CTA link. */
    accommodationSlug: string;
    /** Title of the promotion, as configured by the owner. */
    promotionTitle: string;
    /** Kind of discount the promotion applies. */
    discountType: string;
    /** Discount value (percentage points or centavos, depending on `discountType`). */
    discountValue: number;
    /** Expiration date of the promotion, or `null` if it does not expire. */
    validUntil: Date | null;
}

/**
 * Pure-computation input for {@link isPromotionQualifying}. Every field is a
 * plain primitive/Date so the window decision can be unit-tested with
 * hand-built dates — no model/mocking required.
 */
export interface IsPromotionQualifyingInput {
    /** `createdAt` of the candidate promotion. */
    createdAt: Date;
    /** `updatedAt` of the candidate promotion. */
    updatedAt: Date;
    /** `validFrom` of the candidate promotion. */
    validFrom: Date;
    /** `validUntil` of the candidate promotion, or `null`/`undefined` for "never expires". */
    validUntil: Date | null | undefined;
    /** Start of the evaluation window (the cron's `since` input). */
    since: Date;
    /** The instant "now" is evaluated at (injected for deterministic tests). */
    now: Date;
}

/**
 * Pure-computation input for {@link buildPromoOfferMatch}.
 */
export interface BuildPromoOfferMatchInput {
    /** The qualifying owner promotion. */
    promotion: OwnerPromotion;
    /** The accommodation the promotion applies to (targeted, or one of the
     * owner's accommodations for an owner-wide promotion). */
    accommodation: Accommodation;
}

// ---------------------------------------------------------------------------
// Pure computation (no I/O — trivially unit-testable)
// ---------------------------------------------------------------------------

/**
 * Decides whether a promotion qualifies for the current digest run.
 *
 * Pure function: no DB access, no side effects. Two independent conditions
 * must both hold:
 * 1. Recency — `createdAt >= since OR updatedAt >= since` (see the
 *    `activatedAt`-substitution note on {@link EvaluatePromoOffersInput}).
 * 2. Active window — `validFrom <= now AND (validUntil IS NULL OR validUntil >= now)`,
 *    mirroring `OwnerPromotionService.buildActiveWindowCondition`
 *    (`services/owner-promotion/ownerPromotion.service.ts`) so this
 *    evaluator's notion of "currently valid" never diverges from what the
 *    public search endpoint considers valid.
 *
 * Note: `lifecycleState === 'ACTIVE'`, `planRestricted === false`, and
 * `deletedAt === null` are enforced separately as DB-level `where` filters in
 * {@link PromoOfferEvaluatorService.fetchAllActivePromotions} — they are not
 * re-checked here.
 *
 * @param input - RO-RO input bag (see {@link IsPromotionQualifyingInput}).
 * @returns `true` when the promotion should be included in this run's evaluation.
 */
export function isPromotionQualifying({
    createdAt,
    updatedAt,
    validFrom,
    validUntil,
    since,
    now
}: IsPromotionQualifyingInput): boolean {
    const changedRecently = createdAt >= since || updatedAt >= since;
    const isWithinValidWindow = validFrom <= now && (validUntil == null || validUntil >= now);
    return changedRecently && isWithinValidWindow;
}

/**
 * Builds the {@link PromoOfferMatch} payload for a qualifying
 * promotion/accommodation pair.
 *
 * Pure function: no DB access, no side effects. Unlike
 * `calculatePriceDropMatch` (T-006) there is no numeric threshold decision to
 * make here — a promotion either applies to the given accommodation or it
 * does not, and that set-membership decision is made by the caller (see
 * {@link PromoOfferEvaluatorService.evaluatePromoOffers}) before this function
 * is invoked. This function only shapes the output payload, but is kept
 * separate so the field mapping can be tested without mocking any model.
 *
 * @param input - RO-RO input bag (see {@link BuildPromoOfferMatchInput}).
 * @returns The {@link PromoOfferMatch} payload.
 */
export function buildPromoOfferMatch({
    promotion,
    accommodation
}: BuildPromoOfferMatchInput): PromoOfferMatch {
    return {
        promotionId: promotion.id,
        accommodationId: accommodation.id,
        accommodationName: accommodation.name,
        accommodationSlug: accommodation.slug,
        promotionTitle: promotion.title,
        discountType: promotion.discountType,
        discountValue: promotion.discountValue,
        validUntil: promotion.validUntil ?? null
    };
}

// ---------------------------------------------------------------------------
// I/O orchestration
// ---------------------------------------------------------------------------

/**
 * Cron-only, stateless evaluator that scans every active, in-window owner
 * promotion and reports which subscribed tourists (via `tourist_price_alerts`)
 * should be notified of it in the daily digest.
 *
 * Deliberately NOT a `BaseCrudService`/`BaseService` — same reasoning as
 * `PriceDropEvaluatorService` (T-006): there is no actor, no permission
 * model, and this is invoked exclusively by the internal system caller (the
 * T-007 `alerts-digest` cron job, via T-012's wiring).
 *
 * Algorithm:
 * 1. Fetch every `ACTIVE`, non-plan-restricted, non-soft-deleted owner
 *    promotion (DB-level `where` filter — see
 *    {@link fetchAllActivePromotions}), then narrow to the ones that qualify
 *    for THIS run via the pure {@link isPromotionQualifying} (recency +
 *    active-window check). This mirrors `PriceDropEvaluatorService`'s style
 *    of fetching a broad active set from the DB and applying the
 *    time-sensitive decision in JS, where it is trivially unit-testable.
 * 2. Fetch every active (`isActive: true`, not soft-deleted) price alert and
 *    group it by `accommodationId` — this is the single batched read that
 *    avoids one query per promotion per accommodation.
 * 3. For each qualifying promotion, resolve its "relevant accommodation set":
 *    - Targeted promotion (`accommodationId` set): the set is just that one
 *      accommodation.
 *    - Owner-wide promotion (`accommodationId` is `null` — SPEC-285 D-4):
 *      the set is EVERY accommodation owned by `promotion.ownerId`, fetched
 *      once per distinct owner and cached, not once per promotion.
 * 4. For each accommodation in that set, look up matching alerts from the
 *    step-2 grouped map (in-memory, no additional queries) and emit one
 *    {@link PromoOfferMatch} per matching alert, keyed by `alert.userId`.
 */
export class PromoOfferEvaluatorService {
    private readonly ownerPromotionModel: OwnerPromotionModel;
    private readonly accommodationModel: AccommodationModel;
    private readonly alertModel: TouristPriceAlertModel;

    constructor(deps?: {
        ownerPromotionModel?: OwnerPromotionModel;
        accommodationModel?: AccommodationModel;
        alertModel?: TouristPriceAlertModel;
    }) {
        this.ownerPromotionModel = deps?.ownerPromotionModel ?? new OwnerPromotionModel();
        this.accommodationModel = deps?.accommodationModel ?? new AccommodationModel();
        this.alertModel = deps?.alertModel ?? new TouristPriceAlertModel();
    }

    /**
     * Scans every active, in-window owner promotion changed since `since`,
     * and returns the subscribed tourists who should hear about it.
     *
     * @param input - RO-RO input bag (see {@link EvaluatePromoOffersInput}).
     * @returns A `Map` from `userId` to that user's `PromoOfferMatch[]`. Users
     *   with no qualifying match are simply absent from the map (never an
     *   empty-array entry) — mirrors {@link PriceDropEvaluatorService}'s
     *   contract exactly, since T-007 merges both maps by key presence.
     */
    async evaluatePromoOffers({
        since,
        now = new Date()
    }: EvaluatePromoOffersInput): Promise<Map<string, PromoOfferMatch[]>> {
        const result = new Map<string, PromoOfferMatch[]>();

        const activePromotions = await this.fetchAllActivePromotions();
        const promotions = activePromotions.filter((promotion) =>
            isPromotionQualifying({
                createdAt: promotion.createdAt,
                updatedAt: promotion.updatedAt,
                validFrom: promotion.validFrom,
                validUntil: promotion.validUntil,
                since,
                now
            })
        );
        if (promotions.length === 0) {
            return result;
        }

        const alerts = await this.fetchAllActiveAlerts();
        if (alerts.length === 0) {
            return result;
        }

        const alertsByAccommodationId = new Map<string, PriceAlert[]>();
        for (const alert of alerts) {
            const existing = alertsByAccommodationId.get(alert.accommodationId);
            if (existing) {
                existing.push(alert);
            } else {
                alertsByAccommodationId.set(alert.accommodationId, [alert]);
            }
        }

        // Targeted promotions reference exactly one accommodation each —
        // batch-fetch them all in a single `findByIds()` call.
        const targetedAccommodationIds = [
            ...new Set(
                promotions
                    .map((promotion) => promotion.accommodationId)
                    .filter((id): id is string => id !== null && id !== undefined)
            )
        ];
        const targetedAccommodations =
            await this.accommodationModel.findByIds(targetedAccommodationIds);

        const accommodationById = new Map<string, Accommodation>(
            targetedAccommodations.map((accommodation) => [accommodation.id, accommodation])
        );

        // Owner-wide promotions (accommodationId IS NULL, SPEC-285 D-4) expand
        // to every accommodation the owner has. Fetch once per distinct owner
        // (not once per promotion) and cache both the per-owner list and the
        // individual accommodations, so a later targeted promotion for the
        // same accommodation does not trigger a redundant fetch.
        const ownerWideOwnerIds = [
            ...new Set(
                promotions
                    .filter((promotion) => !promotion.accommodationId)
                    .map((promotion) => promotion.ownerId)
            )
        ];
        const accommodationsByOwnerId = new Map<string, Accommodation[]>();
        for (const ownerId of ownerWideOwnerIds) {
            const ownerAccommodations = await this.fetchAllAccommodationsForOwner(ownerId);
            accommodationsByOwnerId.set(ownerId, ownerAccommodations);
            for (const accommodation of ownerAccommodations) {
                accommodationById.set(accommodation.id, accommodation);
            }
        }

        for (const promotion of promotions) {
            const relevantAccommodations = promotion.accommodationId
                ? [accommodationById.get(promotion.accommodationId)].filter(
                      (accommodation): accommodation is Accommodation => accommodation !== undefined
                  )
                : (accommodationsByOwnerId.get(promotion.ownerId) ?? []);

            for (const accommodation of relevantAccommodations) {
                const matchingAlerts = alertsByAccommodationId.get(accommodation.id);
                if (!matchingAlerts) {
                    continue;
                }

                const match = buildPromoOfferMatch({ promotion, accommodation });

                for (const alert of matchingAlerts) {
                    const existing = result.get(alert.userId);
                    if (existing) {
                        existing.push(match);
                    } else {
                        result.set(alert.userId, [match]);
                    }
                }
            }
        }

        return result;
    }

    /**
     * Pages through every `ACTIVE`, non-plan-restricted, non-soft-deleted
     * `owner_promotions` row, regardless of its recency or valid-date window
     * (those two checks are applied afterward by the pure
     * {@link isPromotionQualifying}, mirroring how
     * `PriceDropEvaluatorService.evaluatePriceDrops` fetches ALL active
     * alerts and applies its own time-window check in JS).
     *
     * `BaseModel.findAll()` caps `pageSize` at `MAX_PAGE_SIZE` (200) — a
     * single call is NOT exhaustive once there are more than 200 active
     * promotions platform-wide, which this cron-run scan must never silently
     * under-report.
     *
     * @internal
     */
    private async fetchAllActivePromotions(): Promise<OwnerPromotion[]> {
        const promotions: OwnerPromotion[] = [];
        let page = 1;

        for (;;) {
            const { items } = await this.ownerPromotionModel.findAll(
                {
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    planRestricted: false,
                    deletedAt: null
                },
                { page, pageSize: SCAN_PAGE_SIZE }
            );
            promotions.push(...items);

            if (items.length < SCAN_PAGE_SIZE) {
                break;
            }
            page += 1;
        }

        return promotions;
    }

    /**
     * Pages through every active, non-deleted `tourist_price_alerts` row.
     *
     * Mirrors `PriceDropEvaluatorService.fetchAllActiveAlerts()`'s exact
     * pagination-loop pattern (T-006) — kept as a local duplicate rather than
     * a shared utility since both call sites are small and independent
     * (YAGNI); extract a shared helper only if a third caller appears.
     *
     * @internal
     */
    private async fetchAllActiveAlerts(): Promise<PriceAlert[]> {
        const alerts: PriceAlert[] = [];
        let page = 1;

        for (;;) {
            const { items } = await this.alertModel.findAll(
                { isActive: true, deletedAt: null },
                { page, pageSize: SCAN_PAGE_SIZE }
            );
            alerts.push(...items);

            if (items.length < SCAN_PAGE_SIZE) {
                break;
            }
            page += 1;
        }

        return alerts;
    }

    /**
     * Pages through every non-soft-deleted accommodation owned by `ownerId`.
     *
     * Used exclusively to expand an owner-wide promotion
     * (`accommodationId: null`, SPEC-285 D-4) into the concrete set of
     * accommodations it applies to. Called at most once per distinct
     * `ownerId` per {@link evaluatePromoOffers} run (see the caching in that
     * method), never once per promotion.
     *
     * @internal
     */
    private async fetchAllAccommodationsForOwner(ownerId: string): Promise<Accommodation[]> {
        const accommodations: Accommodation[] = [];
        let page = 1;

        for (;;) {
            const { items } = await this.accommodationModel.findAll(
                { ownerId, deletedAt: null },
                { page, pageSize: SCAN_PAGE_SIZE }
            );
            accommodations.push(...items);

            if (items.length < SCAN_PAGE_SIZE) {
                break;
            }
            page += 1;
        }

        return accommodations;
    }
}
