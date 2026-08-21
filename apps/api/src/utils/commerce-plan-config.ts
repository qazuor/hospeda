/**
 * Pure parser for the commerce vertical → plan-slug configuration (HOS-688).
 *
 * ---
 * WHY ONE VAR AND NOT TWO
 *
 * §6.8 gives each commerce vertical its own plan, which raises the question of
 * how the environment names them. Two independent variables
 * (`..._GASTRONOMY_PLAN_ID`, `..._EXPERIENCE_PLAN_ID`) can be **half-set** —
 * one vertical sells and the other answers 503 while the site looks perfectly
 * healthy, which is the failure mode hardest to notice. One variable is either
 * configured or it is not.
 *
 * ## WHY IT IS PARSED HERE AND NOT IN THE RESOLVER
 *
 * `apps/api/src/utils/env-schema.ts` is import-pure by contract — zod only, no
 * app imports, enforced by `env-schema-purity.guard.test.ts` — and this module
 * is likewise dependency-free so `env.ts`'s `.superRefine` can call it at BOOT.
 * That is what turns a mistyped mapping into a container that refuses to start
 * rather than a 503 the first time somebody tries to pay (AC-35).
 *
 * The resolver (`services/commerce-plan-resolver.ts`) calls the same function
 * on the same string, so boot validation and request-time resolution can never
 * disagree.
 * ---
 *
 * @module utils/commerce-plan-config
 */

/** The two commerce verticals, in the spelling both the env var and the DB use. */
export const COMMERCE_VERTICALS = ['gastronomy', 'experience'] as const;

/** One commerce vertical. */
export type CommercePlanVertical = (typeof COMMERCE_VERTICALS)[number];

/** A complete vertical → plan-slug mapping. */
export type CommercePlanSlugMap = Readonly<Record<CommercePlanVertical, string>>;

/** Outcome of {@link parseCommercePlanSlugMap}. */
export type CommercePlanConfigResult =
    | { readonly ok: true; readonly map: CommercePlanSlugMap }
    | { readonly ok: false; readonly error: string };

/** Slug shape accepted for a plan name: lowercase kebab, as every plan slug is. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Parses `gastronomy:<slug>,experience:<slug>` into a complete mapping.
 *
 * Every rejection below is a boot failure by design. Partial acceptance is the
 * thing this parser exists to prevent: a mapping missing one vertical, or
 * naming a vertical that does not exist, would leave that vertical's checkout
 * dead while every other page on the site kept working.
 *
 * @param raw - The raw env value. `undefined`/blank means "not configured".
 * @returns The parsed map, or the reason it was rejected.
 *
 * @example
 * ```ts
 * parseCommercePlanSlugMap('gastronomy:gastronomy-premium,experience:experience-premium');
 * // → { ok: true, map: { gastronomy: 'gastronomy-premium', experience: 'experience-premium' } }
 * ```
 */
export function parseCommercePlanSlugMap(raw: string | undefined): CommercePlanConfigResult {
    if (raw === undefined || raw.trim() === '') {
        return { ok: false, error: 'value is empty' };
    }

    const entries = new Map<string, string>();

    for (const rawPair of raw.split(',')) {
        const pair = rawPair.trim();
        if (pair === '') {
            continue;
        }

        const separator = pair.indexOf(':');
        if (separator === -1) {
            return {
                ok: false,
                error: `entry '${pair}' is not in '<vertical>:<plan-slug>' form`
            };
        }

        const vertical = pair.slice(0, separator).trim();
        const slug = pair.slice(separator + 1).trim();

        if (!(COMMERCE_VERTICALS as readonly string[]).includes(vertical)) {
            return {
                ok: false,
                error: `unknown vertical '${vertical}' (expected one of: ${COMMERCE_VERTICALS.join(', ')})`
            };
        }
        if (!SLUG_PATTERN.test(slug)) {
            return {
                ok: false,
                error: `plan slug '${slug}' for vertical '${vertical}' is not a valid slug`
            };
        }
        if (entries.has(vertical)) {
            return { ok: false, error: `vertical '${vertical}' is listed more than once` };
        }

        entries.set(vertical, slug);
    }

    const missing = COMMERCE_VERTICALS.filter((vertical) => !entries.has(vertical));
    if (missing.length > 0) {
        return {
            ok: false,
            // The half-set failure mode, caught: a mapping covering only one
            // vertical would sell that one and 503 the other.
            error: `no plan configured for vertical(s): ${missing.join(', ')}`
        };
    }

    return {
        ok: true,
        map: {
            gastronomy: entries.get('gastronomy') as string,
            experience: entries.get('experience') as string
        }
    };
}
