/**
 * Admin Tour Config Schema
 *
 * Zod schemas, inferred TypeScript types, and target ID registry for the
 * role-based guided welcome tour system (SPEC-174). This file is a sibling of
 * the existing IA config schema (`schema.ts`) and imports only from
 * `primitives.ts` to avoid an ESM circular dependency:
 *
 *   tour.schema.ts → primitives.ts  (no cycle)
 *   schema.ts      → primitives.ts  (no cycle)
 *   schema.ts      → tour.schema.ts (no cycle — one-directional)
 *
 * **Why `primitives.ts`**: `schema.ts` will import `ToursRecordSchema` to extend
 * `AdminIAConfigSchema` with a `tours` field. If `tour.schema.ts` imported from
 * `schema.ts` instead, we would have a cycle. The `primitives.ts` extraction
 * was introduced specifically for this seam.
 *
 * ## Schemas defined here
 *
 * - {@link TourStepSchema} / {@link TourStep} — a single spotlight step.
 * - {@link TourSchema} / {@link Tour} — a complete tour definition.
 * - {@link ToursRecordSchema} / {@link ToursRecord} — the full catalog map.
 *
 * ## Target registry
 *
 * - {@link KNOWN_DATA_TOUR_IDS} — `ReadonlySet<string>` of all static
 *   `data-tour` attribute values that appear in the layout.
 * - {@link DATA_TOUR_SECTION_PREFIX} — prefix for dynamic per-section targets.
 *
 * @see apps/admin/src/config/ia/primitives.ts — I18nLabel + PermissionGate
 * @see apps/admin/src/config/ia/schema.ts — will extend AdminIAConfigSchema
 * @see SPEC-174 §7.1, §7.7
 */

import { z } from 'zod';
import { I18nLabelSchema, PermissionGateSchema } from './primitives';

// ============================================================================
// DATA-TOUR TARGET REGISTRY (§7.7)
// ============================================================================

/**
 * Prefix for dynamic per-section `data-tour` targets.
 *
 * Section targets are of the form `main-menu-section-<sectionId>` where
 * `<sectionId>` is the key from `sections` in the IA config. They are
 * constructed at render time by `MainMenu.tsx` and are not enumerable at
 * schema-definition time, so the cross-reference validation in `schema.ts`
 * uses this prefix constant to detect them and delegates the check to the
 * assembled config's section IDs.
 *
 * @example
 * ```ts
 * const target = `${DATA_TOUR_SECTION_PREFIX}catalogo`; // 'main-menu-section-catalogo'
 * ```
 */
export const DATA_TOUR_SECTION_PREFIX = 'main-menu-section-' as const;

/**
 * Registry of all static `data-tour` attribute IDs used across the admin
 * layout. Each entry corresponds to a `data-tour="<id>"` attribute on a layout
 * element. Steps whose `target` references one of these IDs will have the
 * matching DOM element spotlighted by driver.js.
 *
 * **Maintenance rule (§T1)**: When you add a new `data-tour` attribute to a
 * layout component, you MUST also add the ID here. The `AdminIAConfigSchema`
 * `superRefine` cross-check §T1 validates that every non-`center` step target
 * (after stripping the `data-tour:` prefix) resolves to an ID in this set or
 * matches the dynamic section prefix.
 *
 * Dynamic section targets (`main-menu-section-<sectionId>`) are handled
 * separately via the {@link DATA_TOUR_SECTION_PREFIX} constant — the §T1
 * check verifies that the suffix matches a known section ID in the config.
 *
 * | ID | Location |
 * |----|----------|
 * | `main-menu` | `MainMenu.tsx` — the full top-level navigation menu |
 * | `sidebar` | `Sidebar.tsx` — the secondary left navigation rail |
 * | `dashboard-region` | Dashboard page — the main widget grid area |
 * | `quick-create` | `QuickCreate.tsx` — the "+" quick-create button in the topbar |
 * | `command-palette` | `Header.tsx` — the Cmd+K command-palette trigger |
 * | `notifications` | `Header.tsx` — the notification bell button |
 * | `user-menu` | `header-user.tsx` — the avatar / user dropdown |
 * | `bottom-nav` | `BottomNav.tsx` — the mobile bottom navigation bar |
 *
 * @see SPEC-174 §7.7
 */
export const KNOWN_DATA_TOUR_IDS: ReadonlySet<string> = new Set([
    'main-menu',
    'sidebar',
    'dashboard-region',
    'quick-create',
    'command-palette',
    'notifications',
    'user-menu',
    'bottom-nav'
]);

// ============================================================================
// TOUR STEP (§7.1)
// ============================================================================

/**
 * Pattern that a `data-tour:<id>` step target must match.
 *
 * The id part (after the `data-tour:` prefix) must consist of lowercase
 * alphanumeric characters and hyphens only — matching the HTML `data-tour`
 * attribute value convention used in the layout components.
 *
 * Examples:
 * - `data-tour:main-menu` — valid
 * - `data-tour:sidebar` — valid
 * - `data-tour:UPPER` — INVALID (uppercase rejected)
 * - `data-tour:has_underscore` — INVALID (underscore rejected)
 */
const DATA_TOUR_TARGET_REGEX = /^data-tour:[a-z0-9-]+$/;

/**
 * Validated step target — one of two forms:
 *
 * - `'center'` — the step is shown centered on the viewport with no element
 *   highlight (driver.js `element` is omitted / set to null).
 * - `'data-tour:<id>'` — the step spotlights the DOM element whose
 *   `data-tour` attribute equals `<id>`. The id part must match
 *   `[a-z0-9-]+`. Cross-reference validation (§T1) in `schema.ts` checks
 *   that the id resolves to a known layout target.
 *
 * @example
 * ```ts
 * const center: TourStepTarget = 'center';
 * const element: TourStepTarget = 'data-tour:main-menu';
 * ```
 */
export const TourStepTargetSchema = z.union([
    z.literal('center'),
    z.string().regex(DATA_TOUR_TARGET_REGEX, {
        message: 'target must be "center" or "data-tour:<id>" where <id> matches [a-z0-9-]+'
    })
]);

/** Inferred TypeScript type for {@link TourStepTargetSchema}. */
export type TourStepTarget = z.infer<typeof TourStepTargetSchema>;

/**
 * Driver.js step side — controls which side of the target element the popover
 * appears on. Maps directly to driver.js `popover.side`.
 *
 * @example
 * ```ts
 * const side: TourStepSide = 'right';
 * ```
 */
export const TourStepSideSchema = z.enum(['top', 'right', 'bottom', 'left']);

/** Inferred TypeScript type for {@link TourStepSideSchema}. */
export type TourStepSide = z.infer<typeof TourStepSideSchema>;

/**
 * Driver.js step alignment — controls how the popover aligns relative to the
 * target element on the perpendicular axis. Maps directly to driver.js
 * `popover.align`.
 *
 * @example
 * ```ts
 * const align: TourStepAlign = 'start';
 * ```
 */
export const TourStepAlignSchema = z.enum(['start', 'center', 'end']);

/** Inferred TypeScript type for {@link TourStepAlignSchema}. */
export type TourStepAlign = z.infer<typeof TourStepAlignSchema>;

/**
 * A single spotlight step in a tour.
 *
 * Steps are presented sequentially. Each step targets either the viewport
 * center or a specific `data-tour` DOM element. Steps with a `permissions`
 * gate are filtered out at runtime for users who lack the required permission
 * — driver.js skips missing elements gracefully.
 *
 * @example
 * ```ts
 * const step: TourStep = {
 *   id: 'main-nav',
 *   target: 'data-tour:main-menu',
 *   title: { es: 'Tu menú principal', en: 'Your main menu', pt: 'Seu menu principal' },
 *   body: { es: 'Desde aquí...', en: 'From here...', pt: 'Daqui...' },
 *   side: 'right',
 * };
 * ```
 */
export const TourStepSchema = z.object({
    /**
     * Unique identifier within the tour. Must be non-empty.
     * Used for deduplication validation (step ids must be unique per tour).
     */
    id: z.string().min(1),

    /**
     * The DOM element to spotlight, or `'center'` for a viewport-centered
     * step. See {@link TourStepTargetSchema} for the accepted formats.
     */
    target: TourStepTargetSchema,

    /**
     * Step heading text — shown as the popover title. All three locales are
     * required (same contract as `I18nLabelSchema`).
     */
    title: I18nLabelSchema,

    /**
     * Step body text — shown as the popover description. All three locales
     * are required.
     */
    body: I18nLabelSchema,

    /**
     * Which side of the target element the popover appears on.
     * Optional — driver.js chooses automatically when omitted.
     */
    side: TourStepSideSchema.optional(),

    /**
     * Popover alignment relative to the target on the perpendicular axis.
     * Optional — driver.js defaults to `'start'` when omitted.
     */
    align: TourStepAlignSchema.optional(),

    /**
     * OR-logic permission gate: the step is shown only if the current user
     * holds at least one of the listed permission expressions. Omit to show
     * the step to every tour participant.
     *
     * Steps filtered out by the permission gate are skipped silently —
     * driver.js moves on to the next step, and a warning is emitted by
     * `adminLogger` when the target element is absent from the DOM.
     */
    permissions: PermissionGateSchema.optional()
});

/** Inferred TypeScript type for {@link TourStepSchema}. */
export type TourStep = z.infer<typeof TourStepSchema>;

// ============================================================================
// TOUR ROLES (§7.1, D10)
// ============================================================================

/**
 * The four enabled admin roles in v1. Used for `Tour.roles`.
 * Mirrors the enabled roles in `RoleEnum` (HOST, EDITOR, ADMIN, SUPER_ADMIN).
 *
 * @see SPEC-174 §5 D10
 */
export const TourRoleSchema = z.enum(['HOST', 'EDITOR', 'ADMIN', 'SUPER_ADMIN']);

/** Inferred TypeScript type for {@link TourRoleSchema}. */
export type TourRole = z.infer<typeof TourRoleSchema>;

// ============================================================================
// TOUR (§7.1)
// ============================================================================

/**
 * A complete tour definition.
 *
 * Object-level invariants (enforced by `.superRefine`):
 * - `kind === 'contextual'` → `route` is required.
 * - `kind === 'welcome'` → `route` must be absent (welcome tours fire on the
 *   dashboard regardless of current route via the redirect logic — D13).
 * - All step `id` values within a single tour must be unique.
 *
 * @example
 * ```ts
 * // Welcome tour (no route)
 * const hostWelcome: Tour = {
 *   id: 'host.welcome',
 *   roles: ['HOST'],
 *   kind: 'welcome',
 *   version: 1,
 *   trigger: 'auto-first-visit',
 *   showWelcomeModal: true,
 *   steps: [{ id: 'greeting', target: 'center', title: {...}, body: {...} }],
 * };
 *
 * // Contextual tour (route required)
 * const hostAccommodations: Tour = {
 *   id: 'host.misAlojamientos',
 *   roles: ['HOST'],
 *   kind: 'contextual',
 *   route: '/me/accommodations',
 *   version: 1,
 *   trigger: 'auto-first-visit',
 *   showWelcomeModal: false,
 *   steps: [{ id: 'list', target: 'data-tour:sidebar', title: {...}, body: {...} }],
 * };
 * ```
 */
export const TourSchema = z
    .object({
        /**
         * Catalog identifier — must be globally unique within the tours map.
         * Convention: `'<role>.<contextKey>'` e.g. `'host.welcome'`.
         */
        id: z.string().min(1),

        /**
         * Roles this tour is offered to.
         *
         * `'all'` is a shorthand meaning every enabled role (v1 roles only:
         * HOST / EDITOR / ADMIN / SUPER_ADMIN). An explicit array targets
         * specific roles — the cross-reference validation §T2 in `schema.ts`
         * verifies that every listed role is present and enabled in the config.
         */
        roles: z.union([z.literal('all'), z.array(TourRoleSchema).min(1)]),

        /**
         * Tour category.
         * - `'welcome'` — shown once on first login, triggers from `/dashboard`.
         * - `'contextual'` — shown once on first visit to a specific route.
         */
        kind: z.enum(['welcome', 'contextual']),

        /**
         * The route this contextual tour is associated with.
         *
         * Required when `kind === 'contextual'`; must be absent (undefined)
         * when `kind === 'welcome'`. The cross-reference validation §T3 in
         * `schema.ts` ensures the route matches a known section route.
         */
        route: z.string().startsWith('/').optional(),

        /**
         * Config version — a positive integer. Bumping this value causes the
         * auto-trigger to re-offer the tour to users whose stored seenVersion
         * is lower (see §10 versioning semantics).
         *
         * The minimum value is 1 (v1 tours start at 1 per convention).
         */
        version: z.number().int().positive(),

        /**
         * When and how this tour is triggered automatically.
         *
         * - `'auto-first-visit'` — triggered automatically the first time the
         *   user visits the associated route (welcome → `/dashboard`; contextual
         *   → the tour's `route`). Respects the version check.
         * - `'manual'` — only triggered when the user explicitly requests it
         *   ("Ver guía" / "Ver guía de esta página"). Version check is ignored.
         */
        trigger: z.enum(['auto-first-visit', 'manual']),

        /**
         * Whether to show the welcome modal (Radix Dialog) before the spotlight
         * walkthrough begins. When `true`, the user sees a warm greeting dialog
         * with "Saltar" / "Mostrame →" buttons; "Mostrame" starts driver.js.
         *
         * Typically `true` for `kind: 'welcome'` and `false` for contextual.
         */
        showWelcomeModal: z.boolean(),

        /**
         * Ordered list of spotlight steps. Must contain at least one step.
         * Step ids must be unique within the tour (enforced by `superRefine`).
         */
        steps: z.array(TourStepSchema).min(1)
    })
    .superRefine((tour, ctx) => {
        // Contextual tours require route; welcome tours must NOT have route.
        if (tour.kind === 'contextual' && !tour.route) {
            ctx.addIssue({
                code: 'custom',
                path: ['route'],
                message: "route is required when kind === 'contextual'"
            });
        }
        if (tour.kind === 'welcome' && tour.route !== undefined) {
            ctx.addIssue({
                code: 'custom',
                path: ['route'],
                message: "route must be absent when kind === 'welcome'"
            });
        }

        // Step IDs must be unique within a tour.
        const stepIds = tour.steps.map((s) => s.id);
        const seen = new Set<string>();
        const duplicates: string[] = [];
        for (const id of stepIds) {
            if (seen.has(id)) {
                duplicates.push(id);
            } else {
                seen.add(id);
            }
        }
        if (duplicates.length > 0) {
            ctx.addIssue({
                code: 'custom',
                path: ['steps'],
                message: `Duplicate step ids in tour '${tour.id}': ${duplicates.join(', ')}`
            });
        }
    });

/** Inferred TypeScript type for {@link TourSchema}. */
export type Tour = z.infer<typeof TourSchema>;

// ============================================================================
// TOURS RECORD (§7.1)
// ============================================================================

/**
 * The full tour catalog — a map from tour id to tour definition.
 *
 * Used as the value of the `tours` field in `AdminIAConfigSchema`. Validated
 * at boot alongside the rest of the IA config.
 *
 * @example
 * ```ts
 * const catalog: ToursRecord = {
 *   'host.welcome': { id: 'host.welcome', roles: ['HOST'], kind: 'welcome', ... },
 *   'host.misAlojamientos': { id: 'host.misAlojamientos', roles: ['HOST'], kind: 'contextual', ... },
 * };
 * ```
 */
export const ToursRecordSchema = z.record(z.string(), TourSchema);

/** Inferred TypeScript type for {@link ToursRecordSchema}. */
export type ToursRecord = z.infer<typeof ToursRecordSchema>;
