/**
 * Admin IA — Permission Expansion Utilities (T-011)
 *
 * Provides `expandPermissions`, the runtime function that resolves
 * {@link PermissionExpression} arrays into concrete {@link PermissionEnum} values.
 *
 * This module is intentionally free of any framework or React dependencies —
 * it can be called from server-side boot code, tests, and rendering utilities
 * without side effects.
 *
 * @see apps/admin/src/config/ia/schema.ts — PermissionExpression type
 * @see .claude/audit/admin-redesign/proposals/02-config-schema.md §3.2
 */

import { PermissionEnum } from '@repo/schemas';
import type { PermissionExpression } from './schema';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * All known PermissionEnum values, computed once at module load.
 * Used for wildcard expansion — avoids repeated `Object.values()` calls.
 */
const ALL_PERMISSIONS: readonly PermissionEnum[] = Object.values(PermissionEnum);

/**
 * Set of all enum keys (NOT values) for fast membership checks on exact expressions.
 * PermissionExpression uses ENUM KEYS (e.g. `ACCOMMODATION_CREATE`), not enum values
 * (e.g. `'accommodation.create'`). This map lets us go key → value in O(1).
 */
const KEY_TO_VALUE: ReadonlyMap<string, PermissionEnum> = new Map(
    Object.entries(PermissionEnum).map(([key, value]) => [key, value as PermissionEnum])
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Input for {@link expandPermissions}.
 */
export interface ExpandPermissionsInput {
    /**
     * Array of permission expressions to expand. Each entry is one of:
     * - `'*'` — expands to all `PermissionEnum` values.
     * - `'FOO_*'` — expands to all enum keys that start with the `FOO_` prefix.
     * - `'EXACT_KEY'` — maps to the single matching `PermissionEnum` value.
     */
    readonly expressions: readonly PermissionExpression[];
}

/**
 * Expands an array of {@link PermissionExpression} into deduplicated
 * `PermissionEnum` values.
 *
 * Resolution rules:
 * - `'*'` → all `PermissionEnum` values.
 * - `'FOO_*'` → all enum members whose **key** starts with `'FOO_'`.
 * - `'EXACT_KEY'` → the single enum member with that **key**.
 *   Throws `Error` if the key is not a member of `PermissionEnum`.
 *
 * Results are deduplicated using a `Set` so overlapping expressions (e.g.
 * `['ACCOMMODATION_*', 'ACCOMMODATION_CREATE']`) produce no duplicates.
 *
 * @param input - RO-RO input containing the expressions to expand.
 * @returns Deduplicated array of resolved `PermissionEnum` values.
 *
 * @throws {Error} If an exact expression does not match any `PermissionEnum` key.
 *
 * @example
 * ```ts
 * // Universal wildcard — all permissions
 * expandPermissions({ expressions: ['*'] });
 * // → [PermissionEnum.ACCOMMODATION_CREATE, PermissionEnum.ACCOMMODATION_UPDATE_OWN, ...]
 *
 * // Prefix wildcard — all ACCOMMODATION_ members
 * expandPermissions({ expressions: ['ACCOMMODATION_*'] });
 * // → [PermissionEnum.ACCOMMODATION_CREATE, PermissionEnum.ACCOMMODATION_UPDATE_OWN, ...]
 *
 * // Exact expression
 * expandPermissions({ expressions: ['CONVERSATION_VIEW_OWN'] });
 * // → [PermissionEnum.CONVERSATION_VIEW_OWN]
 *
 * // Mixed with deduplication
 * expandPermissions({ expressions: ['ACCOMMODATION_*', 'CONVERSATION_VIEW_OWN'] });
 * // → [...all ACCOMMODATION_ values, PermissionEnum.CONVERSATION_VIEW_OWN]
 *
 * // Unknown key throws
 * expandPermissions({ expressions: ['NOPE_CREATE'] });
 * // → Error: Unknown permission: NOPE_CREATE
 * ```
 */
export function expandPermissions({ expressions }: ExpandPermissionsInput): PermissionEnum[] {
    const result = new Set<PermissionEnum>();

    for (const expr of expressions) {
        if (expr === '*') {
            // Universal wildcard → add all known permissions
            for (const perm of ALL_PERMISSIONS) {
                result.add(perm);
            }
        } else if (expr.endsWith('_*')) {
            // Prefix wildcard — strip the trailing `*` to get the prefix `FOO_`
            const prefix = expr.slice(0, -1); // e.g. 'ACCOMMODATION_*' → 'ACCOMMODATION_'
            let matched = false;
            for (const [key, value] of KEY_TO_VALUE) {
                if (key.startsWith(prefix)) {
                    result.add(value);
                    matched = true;
                }
            }
            if (!matched) {
                throw new Error(`Unknown permission: ${expr}`);
            }
        } else {
            // Exact expression — must be a real PermissionEnum key
            const value = KEY_TO_VALUE.get(expr);
            if (value === undefined) {
                throw new Error(`Unknown permission: ${expr}`);
            }
            result.add(value);
        }
    }

    return Array.from(result);
}
