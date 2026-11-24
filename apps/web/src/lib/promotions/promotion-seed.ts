/**
 * Session-stable promotion pick seed (HOS-2589 D-7).
 *
 * The free quota is a random pick; the seed makes it stable for the browser session
 * and renewed in a new one. Seeds are stored per page/context in `sessionStorage`
 * (`promos:seed:<context>`). When storage throws (private mode, blocked site data)
 * an in-memory map keeps the page working for the life of the tab.
 *
 * @module lib/promotions/promotion-seed
 */

/** In-memory fallback when `sessionStorage` is unavailable. */
const memorySeeds = new Map<string, string>();

/** The key prefix of every stored seed. */
export const PROMOTION_SEED_PREFIX = 'promos:seed:';

/** A seed matching the API's `PromotionSeedSchema` (8-64 of `[A-Za-z0-9_-]`). */
const SEED_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Generates a fresh seed.
 *
 * @returns A 32-char hex seed.
 */
function generateSeed(): string {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns the seed of a context, creating and storing it on first use.
 *
 * @param input - `context`: e.g. `accommodation:<id>`, `venue:<id>` or `listing`.
 * @returns `{ seed }`.
 */
export function getPromotionSeed(input: { readonly context: string }): { readonly seed: string } {
    const key = `${PROMOTION_SEED_PREFIX}${input.context}`;
    try {
        const stored = globalThis.sessionStorage.getItem(key);
        if (stored && SEED_PATTERN.test(stored)) return { seed: stored };
        const seed = generateSeed();
        globalThis.sessionStorage.setItem(key, seed);
        return { seed };
    } catch {
        const remembered = memorySeeds.get(key);
        if (remembered) return { seed: remembered };
        const seed = generateSeed();
        memorySeeds.set(key, seed);
        return { seed };
    }
}
