import { AccommodationModel, TouristPriceAlertModel } from '@repo/db';
import type { Accommodation, PriceAlert } from '@repo/schemas';

/**
 * Fallback threshold (percent) used when neither a per-alert
 * `targetPercentDrop` nor a valid `HOSPEDA_ALERT_PRICE_DROP_THRESHOLD_PCT`
 * env value is available. Kept as a named constant so the default is
 * documented in exactly one place (mirrors the registry entry's
 * `defaultValue: '5'` in `packages/config/src/env-registry.hospeda.ts`).
 */
const FALLBACK_DEFAULT_THRESHOLD_PCT = 5;

/**
 * A single-page fetch size for the active-alerts scan. Mirrors
 * `MAX_PAGE_SIZE` (`packages/db/src/base/base.model.ts`) — `BaseModel.findAll()`
 * silently caps any larger request at that value, so requesting exactly the
 * cap keeps the pagination math (`items.length === pageSize` ⇒ "there might be
 * more") correct without hardcoding a second constant that could drift from
 * the model's real cap.
 */
const ALERT_SCAN_PAGE_SIZE = 200;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Input for {@link PriceDropEvaluatorService.evaluatePriceDrops}.
 */
export interface EvaluatePriceDropsInput {
    /**
     * Only accommodations whose `updatedAt` is on or after this instant are
     * considered — accommodations that have not changed since the last cron
     * run cannot have a new price drop to report, so re-evaluating them on
     * every run would be wasted work (and, worse, would re-notify users about
     * a drop they were already told about in a previous digest).
     */
    since: Date;
}

/**
 * A single price-drop match: one alert whose subscribed accommodation has
 * dropped in price past the applicable threshold since the evaluation
 * window started.
 */
export interface PriceDropMatch {
    /** The `tourist_price_alerts` row that matched. */
    alertId: string;
    /** The user to notify (map key in {@link EvaluatePriceDropsInput}'s result). */
    userId: string;
    /** The accommodation whose price dropped. */
    accommodationId: string;
    /** Accommodation slug snapshot, for building the CTA link in the digest email. */
    accommodationSlug: string;
    /** Accommodation name snapshot, for display in the digest email. */
    accommodationName: string;
    /** Price (integer centavos) recorded when the alert was created. */
    basePriceSnapshot: number;
    /** Current accommodation price (integer centavos), converted at evaluation time. */
    currentPrice: number;
    /** Percentage drop from `basePriceSnapshot` to `currentPrice` (positive number). */
    dropPercent: number;
    /** Accommodation's price currency, when set. */
    currency: string | undefined;
}

/**
 * Pure-computation input for {@link calculatePriceDropMatch}. Every field is a
 * plain primitive so the calculation can be unit-tested with hand-built
 * numbers — no model/mocking required.
 */
export interface CalculatePriceDropMatchInput {
    alertId: string;
    userId: string;
    accommodationId: string;
    accommodationSlug: string;
    accommodationName: string;
    /** Price (integer centavos) recorded when the alert was created. */
    basePriceSnapshot: number;
    /** Current accommodation price, ALREADY converted to integer centavos by the caller. */
    currentPriceCentavos: number;
    currency: string | undefined;
    /** Per-alert threshold (1-100), or `null` for "notify on any drop". */
    targetPercentDrop: number | null;
    /** Platform-wide fallback threshold, used when `targetPercentDrop` is `null`. */
    globalDefaultThresholdPercent: number;
}

// ---------------------------------------------------------------------------
// Pure computation (no I/O — trivially unit-testable)
// ---------------------------------------------------------------------------

/**
 * Decides whether a single alert/accommodation pair constitutes a price-drop
 * match, and computes the match payload when it does.
 *
 * Pure function: no DB access, no env reads, no side effects. All inputs are
 * plain primitives so every threshold edge case (drop past/below threshold,
 * price increase, price unchanged, null `targetPercentDrop` falling back to
 * the global default) can be tested directly with numbers, without mocking a
 * model or a DB round trip.
 *
 * `dropPercent = (basePriceSnapshot - currentPriceCentavos) / basePriceSnapshot * 100`.
 * A match requires `dropPercent > 0` (price actually went down — a price
 * increase yields a negative `dropPercent`, an unchanged price yields exactly
 * `0`, neither of which is `> 0`) AND `dropPercent >= threshold`, where
 * `threshold` is the alert's own `targetPercentDrop` when set, otherwise the
 * platform-wide default.
 *
 * @param input - RO-RO input bag (see {@link CalculatePriceDropMatchInput}).
 * @returns The {@link PriceDropMatch} payload when the drop qualifies, or
 *   `null` when it does not (no drop, drop below threshold, or a
 *   non-positive `basePriceSnapshot` that would make the percentage
 *   undefined/meaningless).
 */
export function calculatePriceDropMatch(
    input: CalculatePriceDropMatchInput
): PriceDropMatch | null {
    const {
        basePriceSnapshot,
        currentPriceCentavos,
        targetPercentDrop,
        globalDefaultThresholdPercent
    } = input;

    // A zero/negative snapshot would make the percentage undefined (division
    // by zero) or meaningless — there is no legitimate accommodation price of
    // 0, but guard defensively rather than propagate NaN/Infinity into a
    // notification payload.
    if (basePriceSnapshot <= 0) {
        return null;
    }

    const dropPercent = ((basePriceSnapshot - currentPriceCentavos) / basePriceSnapshot) * 100;
    const threshold = targetPercentDrop ?? globalDefaultThresholdPercent;

    if (dropPercent <= 0 || dropPercent < threshold) {
        return null;
    }

    return {
        alertId: input.alertId,
        userId: input.userId,
        accommodationId: input.accommodationId,
        accommodationSlug: input.accommodationSlug,
        accommodationName: input.accommodationName,
        basePriceSnapshot,
        currentPrice: currentPriceCentavos,
        dropPercent,
        currency: input.currency
    };
}

/**
 * Resolves the platform-wide default drop threshold from
 * `HOSPEDA_ALERT_PRICE_DROP_THRESHOLD_PCT`.
 *
 * Read directly from `process.env` rather than through an app-level env
 * schema (e.g. `apps/api/src/utils/env.ts`) — `service-core` is a dependency
 * OF `apps/api`, so it cannot import the app's env module without creating a
 * circular/inverted dependency. This mirrors the existing direct
 * `process.env.HOSPEDA_EXTREP_REFRESH_RATE_LIMIT` read in
 * `accommodation-external-reputation.service.ts`. `apps/api`'s Zod schema
 * still validates and coerces this same variable for the app's own config
 * surface (`packages/config`'s registry cross-validation) — this function is
 * an independent, package-local read of the same raw variable.
 *
 * @returns The parsed integer percentage, or {@link FALLBACK_DEFAULT_THRESHOLD_PCT}
 *   (5) when the env var is unset, non-numeric, or out of the 1-100 range.
 */
export function resolveGlobalDefaultThresholdPercent(): number {
    const raw = process.env.HOSPEDA_ALERT_PRICE_DROP_THRESHOLD_PCT;
    if (raw === undefined || raw.trim() === '') {
        return FALLBACK_DEFAULT_THRESHOLD_PCT;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
        return FALLBACK_DEFAULT_THRESHOLD_PCT;
    }
    return parsed;
}

// ---------------------------------------------------------------------------
// I/O orchestration
// ---------------------------------------------------------------------------

/**
 * Cron-only, stateless evaluator that scans every active price-alert
 * subscription and reports which ones have crossed their drop threshold.
 *
 * Deliberately NOT a `BaseCrudService`/`BaseService` — there is no actor, no
 * permission model, and no single entity being CRUD'd. This is a plain,
 * constructor-injected computation service, matching the style of
 * `resolveRenewalPromoEffect` (`services/billing/promo-code/promo-code.renewal.ts`):
 * a narrow, DI-friendly, non-CRUD unit invoked exclusively by internal
 * system callers (here, the T-007 `alerts-digest` cron job).
 *
 * The class only orchestrates I/O (paginated model reads, unit conversion).
 * All threshold/percentage logic lives in the pure {@link calculatePriceDropMatch}
 * function above so it can be tested without mocking a DB round trip for
 * every edge case.
 */
export class PriceDropEvaluatorService {
    private readonly alertModel: TouristPriceAlertModel;
    private readonly accommodationModel: AccommodationModel;
    private readonly globalDefaultThresholdPercent: number;

    constructor(deps?: {
        alertModel?: TouristPriceAlertModel;
        accommodationModel?: AccommodationModel;
        /**
         * Override for the platform-wide default threshold. Defaults to
         * {@link resolveGlobalDefaultThresholdPercent}'s env-derived value.
         * Exposed mainly so tests can inject a fixed value without mutating
         * `process.env`.
         */
        globalDefaultThresholdPercent?: number;
    }) {
        this.alertModel = deps?.alertModel ?? new TouristPriceAlertModel();
        this.accommodationModel = deps?.accommodationModel ?? new AccommodationModel();
        this.globalDefaultThresholdPercent =
            deps?.globalDefaultThresholdPercent ?? resolveGlobalDefaultThresholdPercent();
    }

    /**
     * Scans every active (`isActive: true`, not soft-deleted) price alert,
     * resolves its accommodation's current price, and returns the alerts
     * whose accommodation has dropped in price past the applicable threshold.
     *
     * Algorithm:
     * 1. Fetch ALL active alerts, paging through `TouristPriceAlertModel.findAll()`
     *    (see {@link fetchAllActiveAlerts} — a single call is NOT exhaustive
     *    once there are more than `MAX_PAGE_SIZE` (200) active alerts).
     * 2. Batch-fetch the referenced accommodations with a single
     *    `AccommodationModel.findByIds()` call (avoids one `findById` round
     *    trip per alert).
     * 3. For each alert, skip it when its accommodation was not touched
     *    within the `since` window (`accommodation.updatedAt < since` — no
     *    price change to report) or has gone missing (hard-deleted, or a
     *    dangling reference).
     * 4. Convert the accommodation's current price to integer centavos (see
     *    the unit-conversion note below) and delegate the threshold decision
     *    to the pure {@link calculatePriceDropMatch}.
     * 5. Group matches by `userId` (the shape the T-007 digest cron consumes
     *    directly — one entry per user, ready to merge with promo-offer
     *    matches into a single digest payload).
     *
     * @param input - RO-RO input bag (see {@link EvaluatePriceDropsInput}).
     * @returns A `Map` from `userId` to that user's `PriceDropMatch[]`. Users
     *   with no qualifying drop are simply absent from the map (never an
     *   empty-array entry).
     */
    async evaluatePriceDrops({
        since
    }: EvaluatePriceDropsInput): Promise<Map<string, PriceDropMatch[]>> {
        const result = new Map<string, PriceDropMatch[]>();

        const alerts = await this.fetchAllActiveAlerts();
        if (alerts.length === 0) {
            return result;
        }

        const accommodationIds = [...new Set(alerts.map((alert) => alert.accommodationId))];
        const accommodations = await this.accommodationModel.findByIds(accommodationIds);
        const accommodationById = new Map<string, Accommodation>(
            accommodations.map((accommodation) => [accommodation.id, accommodation])
        );

        for (const alert of alerts) {
            const accommodation = accommodationById.get(alert.accommodationId);
            // Accommodation was hard-deleted or the FK is otherwise dangling —
            // nothing to evaluate.
            if (!accommodation) {
                continue;
            }

            // No price change since the last cron run: skip re-evaluating a
            // price that could not possibly have moved.
            if (accommodation.updatedAt < since) {
                continue;
            }

            const priceInDecimalCurrency = accommodation.price?.price;
            if (priceInDecimalCurrency === null || priceInDecimalCurrency === undefined) {
                continue;
            }

            // UNIT-CONVERSION NOTE: `accommodation.price.price` (AccommodationPriceSchema)
            // is a plain decimal currency amount (e.g. ARS pesos, `20000`), NOT
            // centavos, while `PriceAlert.basePriceSnapshot` is integer
            // centavos (the project-wide money convention). This is the exact
            // conversion `AlertSubscriptionService._beforeCreate` applies when
            // it FIRST snapshots the price — it must be repeated identically
            // here, otherwise comparing a decimal-pesos current price against
            // a centavos-integer baseline would produce a drop percentage
            // off by a factor of 100.
            const currentPriceCentavos = Math.round(priceInDecimalCurrency * 100);

            const match = calculatePriceDropMatch({
                alertId: alert.id,
                userId: alert.userId,
                accommodationId: alert.accommodationId,
                accommodationSlug: accommodation.slug,
                accommodationName: accommodation.name,
                basePriceSnapshot: alert.basePriceSnapshot,
                currentPriceCentavos,
                currency: accommodation.price?.currency,
                targetPercentDrop: alert.targetPercentDrop,
                globalDefaultThresholdPercent: this.globalDefaultThresholdPercent
            });

            if (match) {
                const existing = result.get(alert.userId);
                if (existing) {
                    existing.push(match);
                } else {
                    result.set(alert.userId, [match]);
                }
            }
        }

        return result;
    }

    /**
     * Pages through every active, non-deleted `tourist_price_alerts` row.
     *
     * `BaseModel.findAll()` caps `pageSize` at `MAX_PAGE_SIZE` (200,
     * `packages/db/src/base/base.model.ts`) — a single call is NOT exhaustive
     * once there are more than 200 active alerts in the table, which this
     * cron-run scan must never silently under-report. Keeps paging while a
     * page comes back full (`items.length === pageSize`); a short page is the
     * signal that the scan has reached the end.
     *
     * @internal
     */
    private async fetchAllActiveAlerts(): Promise<PriceAlert[]> {
        const alerts: PriceAlert[] = [];
        let page = 1;

        for (;;) {
            const { items } = await this.alertModel.findAll(
                { isActive: true, deletedAt: null },
                { page, pageSize: ALERT_SCAN_PAGE_SIZE }
            );
            alerts.push(...items);

            if (items.length < ALERT_SCAN_PAGE_SIZE) {
                break;
            }
            page += 1;
        }

        return alerts;
    }
}
