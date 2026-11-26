/**
 * @file photo-allowance-fixture.ts
 * @description Builders for the `photo-allowance` answer the shared photo
 * editor reads (HOS-2495), so every PhotoSection test states its cap the same
 * way the API does.
 */

import type { ListingPhotoAllowance } from '@repo/schemas';

/** Photo limit key of each listing vertical. */
const LIMIT_KEY = {
    accommodation: 'max_photos_per_accommodation',
    venue: 'max_photos_per_venue',
    experience: 'max_photos_per_experience'
} as const;

/** Options of {@link buildPhotoAllowance}. */
export interface BuildPhotoAllowanceOptions {
    readonly vertical?: keyof typeof LIMIT_KEY;
    /** A finite cap, `'unlimited'`, or `'none'` (no plan). */
    readonly cap: number | 'unlimited' | 'none';
    readonly used?: number;
    readonly hiddenCount?: number;
    readonly source?: ListingPhotoAllowance['source'];
    readonly breakdown?: ListingPhotoAllowance['breakdown'];
    readonly coverAllowed?: boolean;
}

/**
 * Build an allowance payload.
 *
 * @param options - See {@link BuildPhotoAllowanceOptions}.
 * @returns A payload shaped like `ListingPhotoAllowanceSchema`.
 */
export function buildPhotoAllowance({
    vertical = 'accommodation',
    cap,
    used = 0,
    hiddenCount = 0,
    source = 'EFFECTIVE_SET',
    breakdown = null,
    coverAllowed
}: BuildPhotoAllowanceOptions): ListingPhotoAllowance {
    const base = {
        limitKey: LIMIT_KEY[vertical],
        source,
        used,
        hiddenCount,
        breakdown
    };
    if (cap === 'unlimited') {
        return { ...base, status: 'UNLIMITED', cap: null, coverAllowed: coverAllowed ?? true };
    }
    if (cap === 'none') {
        return { ...base, status: 'NONE', cap: 0, coverAllowed: coverAllowed ?? false };
    }
    return { ...base, status: 'LIMITED', cap, coverAllowed: coverAllowed ?? cap >= 1 };
}

/**
 * A resolved, successful `getAllowance` result.
 *
 * @param options - See {@link BuildPhotoAllowanceOptions}.
 * @returns `Promise<{ ok: true, data }>`.
 */
export function allowanceOk(options: BuildPhotoAllowanceOptions) {
    return Promise.resolve({ ok: true as const, data: buildPhotoAllowance(options) });
}

/**
 * A failed `getAllowance` result (a 5xx answer).
 *
 * @returns `Promise<{ ok: false, error }>`.
 */
export function allowanceFailed() {
    return Promise.resolve({
        ok: false as const,
        error: { status: 503, code: 'SERVICE_UNAVAILABLE', message: 'unavailable' }
    });
}
