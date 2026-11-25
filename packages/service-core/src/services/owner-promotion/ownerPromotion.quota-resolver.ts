/**
 * The one visibility rule of the free / VIP promotions model (HOS-2589 §7.3).
 *
 * Pure: no database, no clock, no random source. A seeded PRNG replaces
 * `Math.random`, so the same seed over the same set of promotions always picks
 * the same ones (D-7, session-stable pick) and tests are deterministic (AC-6).
 *
 * - A VIP reader sees every promotion.
 * - Anybody else (a free tourist or an anonymous visitor, the same branch, D-1)
 *   sees up to `freeQuota` «para todos» (`plus`) promotions, picked at random;
 *   every other promotion (the remaining `plus` and every `vip`) is locked.
 * - Output order: visible first, then locked `plus`, then locked `vip`.
 *
 * «Per page» means per call: one detail page's promotions or one page of the
 * listing. The quota does not carry across calls and never applies to badges.
 */
import { TouristAudienceEnum } from '@repo/schemas';

/** The minimum a promotion must expose to be resolved. */
export interface ResolvablePromotion {
    readonly id: string;
    readonly touristAudience: TouristAudienceEnum | `${TouristAudienceEnum}`;
}

/** One resolved promotion: whether the reader sees it in full. */
export interface PromotionVisibilityDecision<T extends ResolvablePromotion> {
    readonly kind: 'visible' | 'locked';
    readonly promotion: T;
}

/** Input of {@link resolvePromotionVisibility}. RO-RO. */
export interface ResolvePromotionVisibilityInput<T extends ResolvablePromotion> {
    /** Every promotion of the page, in any order. */
    readonly promotions: readonly T[];
    /** `vip_promotions_access` on the reader's TOURIST effective set. */
    readonly isVip: boolean;
    /** The catalog limit `max_free_visible_promotions`; 0 when it could not be read. */
    readonly freeQuota: number;
    /** The session seed of the page (opaque). */
    readonly seed: string;
}

/**
 * Hashes a string into a 32-bit unsigned seed (FNV-1a).
 *
 * @param params - `value`: the string to hash.
 * @returns A 32-bit unsigned integer.
 */
export function hashSeed({ value }: { readonly value: string }): number {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

/**
 * A seeded pseudo-random generator (mulberry32). Not cryptographic: it only has to
 * spread a pick evenly and be reproducible.
 *
 * @param params - `seed`: a 32-bit unsigned integer.
 * @returns A function returning floats in `[0, 1)`.
 */
export function createSeededRandom({ seed }: { readonly seed: number }): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Resolves which promotions of one page the reader sees in full.
 *
 * The shuffle input is the seed plus the sorted ids of the `plus` promotions, so
 * the same seed over the same set gives the same pick and a changed set a fresh one.
 *
 * @param input - See {@link ResolvePromotionVisibilityInput}.
 * @returns One decision per promotion: visible first, then locked `plus`, then locked `vip`.
 */
export function resolvePromotionVisibility<T extends ResolvablePromotion>({
    promotions,
    isVip,
    freeQuota,
    seed
}: ResolvePromotionVisibilityInput<T>): PromotionVisibilityDecision<T>[] {
    if (isVip) return promotions.map((promotion) => ({ kind: 'visible', promotion }));

    const plus = promotions
        .filter((promotion) => promotion.touristAudience === TouristAudienceEnum.PLUS)
        .slice()
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const vip = promotions.filter(
        (promotion) => promotion.touristAudience !== TouristAudienceEnum.PLUS
    );

    const random = createSeededRandom({
        seed: hashSeed({ value: `${seed}|${plus.map((promotion) => promotion.id).join(',')}` })
    });
    const shuffled = plus.slice();
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(random() * (index + 1));
        const current = shuffled[index] as T;
        shuffled[index] = shuffled[swap] as T;
        shuffled[swap] = current;
    }

    const quota = Number.isFinite(freeQuota) ? Math.max(0, Math.floor(freeQuota)) : 0;
    return [
        ...shuffled.slice(0, quota).map((promotion) => ({ kind: 'visible' as const, promotion })),
        ...shuffled.slice(quota).map((promotion) => ({ kind: 'locked' as const, promotion })),
        ...vip.map((promotion) => ({ kind: 'locked' as const, promotion }))
    ];
}

/** Filler alphabet of a placeholder name. Lowercase letters only. */
const FILLER = 'abcdefghijklmnopqrstuvwxyz';

/** Fallback length when the real place name is unknown (an owner-wide promotion). */
const UNKNOWN_NAME_LENGTH = 12;

/**
 * Builds the placeholder that stands where a locked card's place name would be
 * (D-5). Same character count as the real name, filler letters derived from the
 * seed and the per-response index, never from the real name's letters. Words are
 * broken at seeded positions, not at the real name's spaces.
 *
 * @param params - `realName` (or `null` when there is none), `seed`, `index`.
 * @returns A string of `realName.length` characters, never equal to `realName`.
 */
export function buildPlaceholderName({
    realName,
    seed,
    index
}: {
    readonly realName: string | null;
    readonly seed: string;
    readonly index: number;
}): string {
    const length = Math.max(1, realName?.length ?? UNKNOWN_NAME_LENGTH);
    const random = createSeededRandom({
        seed: hashSeed({ value: `${seed}#placeholder#${index}` })
    });
    let out = '';
    let sinceSpace = 0;
    for (let position = 0; position < length; position += 1) {
        const canBreak = sinceSpace >= 3 && position < length - 2;
        if (canBreak && random() < 0.2) {
            out += ' ';
            sinceSpace = 0;
            continue;
        }
        out += FILLER[Math.floor(random() * FILLER.length)];
        sinceSpace += 1;
    }
    if (out === realName) {
        // Astronomically unlikely, but a placeholder must never BE the name.
        const first = out.charCodeAt(0);
        const shifted = FILLER[(FILLER.indexOf(String.fromCharCode(first)) + 1) % FILLER.length];
        out = `${shifted}${out.slice(1)}`;
    }
    return out;
}
