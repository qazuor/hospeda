/**
 * HOS-141 T-007 — Geocode confidence tiering (pipeline stage 5b, §6.3.1).
 *
 * Every raw geocode hit is classified into a confidence tier from the
 * provider's own match-quality signal (Nominatim `importance`). Only `high`
 * and `medium` hits are accepted as coordinates; `low` is treated as
 * effectively unresolved (coordinates left null, listed in the report),
 * because a wrong coordinate is worse than a missing one — it actively
 * corrupts proximity search instead of merely not participating in it.
 */
import type { RawGeocodeHit } from './geocoder.js';
import type { ConfidenceTier, GeocodeResult } from './types.js';

/**
 * Importance thresholds for tier classification. Tunable; validated cheaply by
 * the dry-run (T-017) before the full 717-row run. Nominatim `importance` is
 * roughly 0..1, higher meaning a more prominent/confident match.
 */
export const CONFIDENCE_THRESHOLDS = {
    /** `importance >= HIGH` -> `high`. */
    high: 0.5,
    /** `importance >= MEDIUM` (and `< HIGH`) -> `medium`. */
    medium: 0.35
} as const;

/**
 * Classifies a raw geocode hit into `high` / `medium` / `low` from its
 * provider importance signal.
 *
 * @param hit - The raw geocode hit.
 * @returns The confidence tier (never `unresolved` — that is reserved for a
 *   null hit, handled by {@link resolveConfidence}).
 */
export function classifyConfidence(hit: RawGeocodeHit): Exclude<ConfidenceTier, 'unresolved'> {
    if (hit.importance >= CONFIDENCE_THRESHOLDS.high) {
        return 'high';
    }
    if (hit.importance >= CONFIDENCE_THRESHOLDS.medium) {
        return 'medium';
    }
    return 'low';
}

/**
 * The outcome of tiering a (possibly null) geocode hit: the tier for reporting,
 * and the accepted {@link GeocodeResult} (only for `high`/`medium`; `null`
 * otherwise so a low/absent match never writes coordinates).
 */
export interface ConfidenceOutcome {
    /** The tier, including `unresolved` for a null hit. */
    readonly tier: ConfidenceTier;
    /** The accepted coordinate, or `null` when rejected/absent. */
    readonly result: GeocodeResult | null;
}

/**
 * Resolves a raw hit (or `null`) into a {@link ConfidenceOutcome}: accepts
 * `high`/`medium` as a written coordinate, rejects `low` (kept for the report
 * but not written), and reports `unresolved` for a null hit.
 *
 * @param hit - The raw geocode hit, or `null` when the provider had no match.
 * @returns The tier + accepted result.
 */
export function resolveConfidence(hit: RawGeocodeHit | null): ConfidenceOutcome {
    if (hit === null) {
        return { tier: 'unresolved', result: null };
    }
    const tier = classifyConfidence(hit);
    if (tier === 'low') {
        return { tier, result: null };
    }
    return {
        tier,
        result: { lat: hit.lat, long: hit.long, confidence: tier, provider: hit.provider }
    };
}
