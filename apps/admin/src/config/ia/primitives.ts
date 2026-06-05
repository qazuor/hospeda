/**
 * Admin IA Config — Core Primitives
 *
 * This module extracts the four foundational schema primitives from `schema.ts`
 * into a standalone file. The separation exists to prevent an ESM circular
 * dependency: `tour.schema.ts` (SPEC-174) needs these primitives but also
 * needs to be imported by `schema.ts` (to extend `AdminIAConfigSchema` with a
 * `tours` field). Importing primitives from this dedicated module instead of
 * from `schema.ts` breaks that cycle.
 *
 * **Backward compatibility**: `schema.ts` re-exports everything from this file
 * so all existing imports of these types from `@/config/ia/schema` continue to
 * work without any changes to consumers.
 *
 * Primitives defined here:
 *   - {@link I18nLabelSchema} / {@link I18nLabel}
 *   - {@link PermissionExpressionSchema} / {@link PermissionExpression}
 *   - {@link PermissionGateSchema} / {@link PermissionGate}
 *   - {@link OnMissingSchema} / {@link OnMissing}
 *
 * @see apps/admin/src/config/ia/schema.ts — re-exports all of these for backward compat
 * @see apps/admin/src/config/ia/tour.schema.ts — primary consumer of this module
 */

import { z } from 'zod';

// ============================================================================
// I18nLabel
// ============================================================================

/**
 * Tri-locale label required on every user-facing navigation string.
 *
 * All three locales (es, en, pt) must be supplied and non-empty. This prevents
 * the "we forgot to translate to pt" regression that the Phase-1 i18n audit
 * surfaced (SPEC-154 §11.3 — documented SSOT exception for admin IA labels).
 *
 * @example
 * ```ts
 * const label: I18nLabel = { es: 'Inicio', en: 'Home', pt: 'Início' };
 * ```
 */
export const I18nLabelSchema = z.object({
    es: z.string().min(1),
    en: z.string().min(1),
    pt: z.string().min(1)
});

/**
 * Inferred TypeScript type for {@link I18nLabelSchema}.
 *
 * @example
 * ```ts
 * const label: I18nLabel = { es: 'Catálogo', en: 'Catalog', pt: 'Catálogo' };
 * ```
 */
export type I18nLabel = z.infer<typeof I18nLabelSchema>;

// ============================================================================
// PermissionExpression
// ============================================================================

/**
 * A single permission expression — one of three forms:
 *
 * - **Exact**: an uppercase `PermissionEnum` value like `ACCOMMODATION_VIEW_ALL`.
 *   Pattern: `[A-Z][A-Z0-9_]+` with no trailing `*`.
 * - **Prefix wildcard**: a namespace prefix followed by `_*`, like `ACCOMMODATION_*`.
 *   At runtime `expandPermissions()` resolves this to all matching `PermissionEnum` values.
 * - **Universal wildcard**: the single character `*`.
 *   Resolved by `expandPermissions()` to all known `PermissionEnum` values.
 *
 * **Rejected examples**:
 * - `foo` — lowercase is always invalid.
 * - `FOO*` — wildcard must use underscore separator (`FOO_*`).
 * - `` (empty) — the regex requires at least one character.
 *
 * @example
 * ```ts
 * const expr: PermissionExpression = 'ACCOMMODATION_VIEW_ALL'; // exact
 * const wild: PermissionExpression = 'ACCOMMODATION_*';         // prefix wildcard
 * const all:  PermissionExpression = '*';                       // universal wildcard
 * ```
 */
export const PermissionExpressionSchema = z
    .string()
    .regex(
        /^(\*|[A-Z][A-Z0-9_]+(_\*)?|[A-Z][A-Z0-9_]+)$/,
        'Permission must be an exact PermissionEnum value, a prefix wildcard (FOO_*), or "*"'
    );

/**
 * Inferred TypeScript type for {@link PermissionExpressionSchema}.
 *
 * @example
 * ```ts
 * const p: PermissionExpression = 'BILLING_*';
 * ```
 */
export type PermissionExpression = z.infer<typeof PermissionExpressionSchema>;

// ============================================================================
// PermissionGate
// ============================================================================

/**
 * An OR-logic permission gate: the user passes if they hold **at least one**
 * of the listed permission expressions.
 *
 * Rules:
 * - Must contain at least one entry (empty gates are a config error).
 * - Each entry must be a valid {@link PermissionExpression}.
 * - Wildcard expressions are expanded at runtime via `expandPermissions()`.
 *
 * @example
 * ```ts
 * // User sees the item if they have either permission:
 * const gate: PermissionGate = ['CONVERSATION_VIEW_OWN', 'CONVERSATION_VIEW_ALL'];
 * ```
 */
export const PermissionGateSchema = z.array(PermissionExpressionSchema).min(1);

/**
 * Inferred TypeScript type for {@link PermissionGateSchema}.
 *
 * @example
 * ```ts
 * const gate: PermissionGate = ['ACCOMMODATION_VIEW_OWN'];
 * ```
 */
export type PermissionGate = z.infer<typeof PermissionGateSchema>;

// ============================================================================
// OnMissing
// ============================================================================

/**
 * Behavior when the current user lacks the permissions required to access a
 * navigation item (per SPEC-154 §8 cherry-pick rule).
 *
 * - `'disable'` — item renders greyed-out with a tooltip "Requiere permiso X".
 *   Default when the field is omitted on sidebar items.
 * - `'hide'`    — item is omitted from the DOM entirely (structurally inaccessible
 *   items like "Configuración crítica" for non-SUPER_ADMIN roles).
 *
 * @example
 * ```ts
 * const behavior: OnMissing = 'hide';   // item won't appear for unauthorized users
 * const fallback: OnMissing = 'disable'; // item appears but is non-interactive
 * ```
 */
export const OnMissingSchema = z.enum(['disable', 'hide']);

/**
 * Inferred TypeScript type for {@link OnMissingSchema}.
 *
 * @example
 * ```ts
 * const b: OnMissing = 'disable';
 * ```
 */
export type OnMissing = z.infer<typeof OnMissingSchema>;
