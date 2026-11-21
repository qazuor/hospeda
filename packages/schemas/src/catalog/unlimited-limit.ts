/**
 * The "unlimited" value of a catalog LIMIT (HOS-2403).
 *
 * `plan_version_limit.value` is an `integer` with `CHECK (value >= 0)`, so a
 * limit with no cap is stored as the int4 maximum (Coord-41, migration 0144).
 * Entitlements say "unlimited" with `Infinity`; limits say it with this
 * sentinel. The effective-set fold treats it as ABSORBING under `SUM`
 * (clarification of M-ENT-01), and every view renders it as "unlimited".
 */
export const UNLIMITED_LIMIT_VALUE = 2147483647 as const;

/**
 * Whether a raw limit value means "unlimited".
 *
 * At-or-above, not equality: a value past the sentinel (an old cached
 * aggregate, a summed overflow) must never surface as a huge number.
 *
 * @param input.value - A raw limit value, from a plan or an effective set.
 * @returns `true` for the sentinel, anything above it, and `Infinity`.
 */
export function isUnlimitedLimit({ value }: { readonly value: number }): boolean {
    return value >= UNLIMITED_LIMIT_VALUE;
}
