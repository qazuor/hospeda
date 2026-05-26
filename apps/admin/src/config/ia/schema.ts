/**
 * Admin IA Config Schema
 *
 * Zod schemas and inferred TypeScript types for the config-driven Information
 * Architecture system (SPEC-154). This file is the single source of truth for
 * all structural types used throughout `apps/admin/src/config/ia/`.
 *
 * File layout (tasks build on top of each other in order):
 *   T-001 — Core primitives (I18nLabel, PermissionExpression, PermissionGate, OnMissing)
 *   T-002 — SectionSchema + SidebarItem discriminated union (link | group | separator)
 *   T-003 — SidebarConfig, TabItem, TabsConfig
 *   T-004 — DashboardConfig, TopbarConfig, MobileConfig
 *   T-005 — RoleConfig (enabled/disabled variants, mainMenu)
 *   T-006 — CreateActionConfig, AdminIAConfig (top-level composer)
 *
 * Usage:
 *   All other IA files import from this module.
 *   `index.ts` is the only consumer that should call `schema.parse(rawConfig)`.
 *
 * @see apps/admin/src/config/ia/index.ts
 * @see .claude/audit/admin-redesign/proposals/02-config-schema.md
 */

import { z } from 'zod';

// ============================================================================
// CORE PRIMITIVES
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

// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------

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

// ============================================================================
// SECTIONS (T-002)
// ============================================================================

/**
 * A top-level navigation section representing one entry in the main menu
 * (Level 1 of the IA hierarchy). Each section maps to a route and optionally
 * references a sidebar definition by ID.
 *
 * The `sidebar` field is nullable: pass `null` for sections that render
 * without a sidebar (e.g. a full-screen dashboard or a standalone page).
 *
 * @example
 * ```ts
 * const section: Section = {
 *   id: 'catalogo',
 *   label: { es: 'Catálogo', en: 'Catalog', pt: 'Catálogo' },
 *   icon: 'package',
 *   route: '/catalogo',
 *   defaultRoute: '/catalogo/dashboard',
 *   sidebar: 'catalogoSidebar',
 * };
 * ```
 */
export const SectionSchema = z.object({
    id: z.string().min(1),
    label: I18nLabelSchema,
    /** Icon ID from @repo/icons — validated at runtime by the renderer. */
    icon: z.string().min(1),
    /** Primary route for this section. Must begin with "/". */
    route: z.string().startsWith('/'),
    /**
     * Where the section opens by default. Falls back to `route` when omitted.
     * Must begin with "/".
     */
    defaultRoute: z.string().startsWith('/').optional(),
    /**
     * Reference to a sidebar definition by its ID.
     * Set to `null` for sections that have no sidebar.
     */
    sidebar: z.string().nullable()
});

/**
 * Inferred TypeScript type for {@link SectionSchema}.
 *
 * @example
 * ```ts
 * const s: Section = {
 *   id: 'inicio',
 *   label: { es: 'Inicio', en: 'Home', pt: 'Início' },
 *   icon: 'house',
 *   route: '/inicio',
 *   sidebar: 'inicioSidebar',
 * };
 * ```
 */
export type Section = z.infer<typeof SectionSchema>;

// ============================================================================
// SIDEBAR ITEMS — discriminated union (T-003)
// ============================================================================

/**
 * Common base fields shared by `link` and `group` sidebar item types.
 * Kept as a plain const object so it can be spread into each schema definition.
 *
 * `separator` intentionally does NOT spread these — it only carries an `id`.
 */
const ItemBaseFields = {
    id: z.string().min(1),
    label: I18nLabelSchema,
    /** Optional icon ID from @repo/icons. */
    icon: z.string().optional(),
    /**
     * OR-logic permission gate: the user sees the item if they hold at least
     * one of the listed permission expressions. Omit to show to anyone with
     * basic panel access.
     */
    permissions: PermissionGateSchema.optional(),
    /**
     * Behaviour when the current user lacks the required permissions.
     * Defaults to `'disable'` (renders greyed-out).
     */
    onMissing: OnMissingSchema.default('disable'),
    /** Badge source ID (e.g. `'unread-conversations'`). Optional. */
    badge: z.string().optional()
} as const;

/**
 * A sidebar item that navigates to a route when clicked.
 *
 * @example
 * ```ts
 * const link: LinkItem = {
 *   type: 'link',
 *   id: 'aloj-list',
 *   label: { es: 'Listado', en: 'List', pt: 'Lista' },
 *   route: '/catalogo/alojamientos',
 *   permissions: ['ACCOMMODATION_VIEW_ALL', 'ACCOMMODATION_VIEW_OWN'],
 * };
 * ```
 */
export const LinkItemSchema = z.object({
    type: z.literal('link'),
    ...ItemBaseFields,
    /** Target route — must begin with "/". */
    route: z.string().startsWith('/'),
    /** When `true`, the route is matched exactly (not as a prefix). */
    exact: z.boolean().default(false)
});

/**
 * Inferred TypeScript type for {@link LinkItemSchema}.
 *
 * @example
 * ```ts
 * const link: LinkItem = { type: 'link', id: 'dashboard', label: {...}, route: '/inicio/dashboard' };
 * ```
 */
export type LinkItem = z.infer<typeof LinkItemSchema>;

/**
 * A visual divider between sidebar items. Carries only an `id` — no label,
 * permissions, or icon. Always rendered if any sibling is visible.
 *
 * @example
 * ```ts
 * const sep: SeparatorItem = { type: 'separator', id: 'sep-1' };
 * ```
 */
export const SeparatorItemSchema = z.object({
    type: z.literal('separator'),
    id: z.string().min(1)
});

/**
 * Inferred TypeScript type for {@link SeparatorItemSchema}.
 *
 * @example
 * ```ts
 * const s: SeparatorItem = { type: 'separator', id: 'sep-actions' };
 * ```
 */
export type SeparatorItem = z.infer<typeof SeparatorItemSchema>;

/**
 * Items allowed INSIDE a group. Groups cannot contain other groups — nesting is
 * capped at two levels (sidebar root + one group deep) by design (UX anti-pattern).
 *
 * @example
 * ```ts
 * const child: GroupChildItem = { type: 'link', id: 'aloj-new', label: {...}, route: '/catalogo/alojamientos/new' };
 * ```
 */
export const GroupChildItemSchema = z.discriminatedUnion('type', [
    LinkItemSchema,
    SeparatorItemSchema
]);

/**
 * Inferred TypeScript type for {@link GroupChildItemSchema}.
 *
 * @example
 * ```ts
 * const child: GroupChildItem = { type: 'separator', id: 'sep-1' };
 * ```
 */
export type GroupChildItem = z.infer<typeof GroupChildItemSchema>;

/**
 * A collapsible group that contains link and separator children. Groups
 * CANNOT be nested inside other groups (enforced by {@link GroupChildItemSchema}).
 *
 * @example
 * ```ts
 * const group: GroupItem = {
 *   type: 'group',
 *   id: 'alojamientos',
 *   label: { es: 'Alojamientos', en: 'Accommodations', pt: 'Alojamentos' },
 *   defaultOpen: true,
 *   items: [
 *     { type: 'link', id: 'aloj-list', label: {...}, route: '/catalogo/alojamientos' },
 *     { type: 'link', id: 'aloj-new',  label: {...}, route: '/catalogo/alojamientos/new' },
 *   ],
 * };
 * ```
 */
export const GroupItemSchema = z.object({
    type: z.literal('group'),
    ...ItemBaseFields,
    /** Whether the group is expanded on first render. */
    defaultOpen: z.boolean().default(false),
    /** At least one child is required — an empty group is a config error. */
    items: z.array(GroupChildItemSchema).min(1)
});

/**
 * Inferred TypeScript type for {@link GroupItemSchema}.
 *
 * @example
 * ```ts
 * const g: GroupItem = { type: 'group', id: 'g1', label: {...}, items: [{...}] };
 * ```
 */
export type GroupItem = z.infer<typeof GroupItemSchema>;

/**
 * Top-level sidebar item — one of `link`, `group`, or `separator`.
 *
 * @example
 * ```ts
 * const item: SidebarItem = { type: 'separator', id: 'sep-bottom' };
 * ```
 */
export const SidebarItemSchema = z.discriminatedUnion('type', [
    LinkItemSchema,
    GroupItemSchema,
    SeparatorItemSchema
]);

/**
 * Inferred TypeScript type for {@link SidebarItemSchema}.
 *
 * @example
 * ```ts
 * const item: SidebarItem = { type: 'link', id: 'home', label: {...}, route: '/inicio' };
 * ```
 */
export type SidebarItem = z.infer<typeof SidebarItemSchema>;

/**
 * A named sidebar — a collection of top-level items that renders in the left
 * navigation rail when the associated section is active.
 *
 * @example
 * ```ts
 * const sidebar: Sidebar = {
 *   items: [
 *     { type: 'link', id: 'dashboard', label: {...}, route: '/catalogo/dashboard' },
 *     { type: 'separator', id: 'sep-1' },
 *     { type: 'group', id: 'alojamientos', label: {...}, items: [{...}] },
 *   ],
 * };
 * ```
 */
export const SidebarSchema = z.object({
    /** At least one item is required — an empty sidebar is a config error. */
    items: z.array(SidebarItemSchema).min(1)
});

/**
 * Inferred TypeScript type for {@link SidebarSchema}.
 *
 * @example
 * ```ts
 * const s: Sidebar = { items: [{ type: 'link', id: 'home', label: {...}, route: '/' }] };
 * ```
 */
export type Sidebar = z.infer<typeof SidebarSchema>;

// ============================================================================
// TABS (T-004)
// ============================================================================

/**
 * A single tab entry for a detail-page tab bar (Level 3 of the IA hierarchy).
 *
 * @example
 * ```ts
 * const tab: Tab = {
 *   id: 'gallery',
 *   label: { es: 'Fotos', en: 'Photos', pt: 'Fotos' },
 *   permissions: ['ACCOMMODATION_MEDIA_VIEW'],
 *   onMissing: 'hide',
 * };
 * ```
 */
export const TabSchema = z.object({
    id: z.string().min(1),
    label: I18nLabelSchema,
    /** Optional permission gate — omit to show to all authenticated users. */
    permissions: PermissionGateSchema.optional(),
    /** Behaviour when the user lacks permissions. Defaults to `'disable'`. */
    onMissing: OnMissingSchema.default('disable')
});

/**
 * Inferred TypeScript type for {@link TabSchema}.
 *
 * @example
 * ```ts
 * const t: Tab = { id: 'overview', label: { es: 'General', en: 'Overview', pt: 'Geral' } };
 * ```
 */
export type Tab = z.infer<typeof TabSchema>;

/**
 * Tab configuration for a specific entity's detail page.
 *
 * Design constraint: maximum **9 tabs** per entity (per IA doc §5 design rule).
 * Exceeding this limit is a configuration error that fails at boot.
 *
 * @example
 * ```ts
 * const config: TabsConfig = {
 *   entity: 'accommodation',
 *   tabs: [
 *     { id: 'overview',  label: { es: 'General', en: 'Overview', pt: 'Geral' } },
 *     { id: 'gallery',   label: { es: 'Fotos',   en: 'Photos',   pt: 'Fotos' }, permissions: ['ACCOMMODATION_MEDIA_VIEW'] },
 *   ],
 * };
 * ```
 */
export const TabsConfigSchema = z.object({
    /** Entity name this tab config applies to (e.g. `'accommodation'`, `'post'`). */
    entity: z.string().min(1),
    /** Ordered list of tabs. Min 1, max 9 (enforced by design rule). */
    tabs: z.array(TabSchema).min(1).max(9)
});

/**
 * Inferred TypeScript type for {@link TabsConfigSchema}.
 *
 * @example
 * ```ts
 * const tc: TabsConfig = { entity: 'event', tabs: [{ id: 'info', label: {...} }] };
 * ```
 */
export type TabsConfig = z.infer<typeof TabsConfigSchema>;

// ============================================================================
// DASHBOARD / WIDGETS / TOPBAR / MOBILE (T-005)
// ============================================================================

/**
 * Data scope for a dashboard widget.
 *
 * - `'own'`    — scoped to data owned by the current user.
 * - `'all'`    — global/platform-wide data.
 * - `'toggle'` — user can switch between own and all at runtime.
 *
 * @example
 * ```ts
 * const scope: WidgetScope = 'toggle';
 * ```
 */
export const WidgetScopeSchema = z.enum(['own', 'all', 'toggle']);

/**
 * Inferred TypeScript type for {@link WidgetScopeSchema}.
 *
 * @example
 * ```ts
 * const s: WidgetScope = 'own';
 * ```
 */
export type WidgetScope = z.infer<typeof WidgetScopeSchema>;

/**
 * Visual/behavioural type of a dashboard widget (V1 catalogue).
 *
 * - `'kpi'`      — single big number with optional delta.
 * - `'list'`     — top-N list (recent items, top performers, etc.).
 * - `'chart'`    — line/bar/area chart.
 * - `'feed'`     — chronological feed (activity log, audit preview).
 * - `'callout'`  — notice/banner with CTA.
 * - `'shortcut'` — group of quick-action buttons.
 * - `'map'`      — geographic visualisation.
 * - `'calendar'` — date-based visualisation (events, publishing schedule).
 *
 * @example
 * ```ts
 * const type: WidgetType = 'kpi';
 * ```
 */
export const WidgetTypeSchema = z.enum([
    'kpi',
    'list',
    'chart',
    'feed',
    'callout',
    'shortcut',
    'map',
    'calendar'
]);

/**
 * Inferred TypeScript type for {@link WidgetTypeSchema}.
 *
 * @example
 * ```ts
 * const t: WidgetType = 'chart';
 * ```
 */
export type WidgetType = z.infer<typeof WidgetTypeSchema>;

/**
 * A single dashboard widget definition.
 *
 * The `config` field is intentionally loose in V1 — each widget renderer
 * validates its own config shape with a local Zod schema. Post-V1 this
 * will become a discriminated union keyed by `type`.
 *
 * @example
 * ```ts
 * const widget: Widget = {
 *   id: 'my-accommodations-count',
 *   type: 'kpi',
 *   label: { es: 'Mis alojamientos', en: 'My accommodations', pt: 'Meus alojamentos' },
 *   scope: 'own',
 *   permissions: ['ACCOMMODATION_VIEW_OWN'],
 *   config: { source: 'accommodation.list.count.own' },
 * };
 * ```
 */
export const WidgetSchema = z.object({
    /** Unique within the dashboard. */
    id: z.string().min(1),
    type: WidgetTypeSchema,
    label: I18nLabelSchema,
    /** Optional permission gate — omit to show to all dashboard viewers. */
    permissions: PermissionGateSchema.optional(),
    /** Data scope. Defaults to `'all'`. */
    scope: WidgetScopeSchema.default('all'),
    /**
     * Widget-type-specific configuration. Kept loosely typed in V1 —
     * each renderer validates this with its own schema.
     */
    config: z.record(z.string(), z.unknown()).optional()
});

/**
 * Inferred TypeScript type for {@link WidgetSchema}.
 *
 * @example
 * ```ts
 * const w: Widget = { id: 'revenue', type: 'kpi', label: {...}, scope: 'all' };
 * ```
 */
export type Widget = z.infer<typeof WidgetSchema>;

/**
 * A dashboard definition — an ordered collection of widgets.
 *
 * @example
 * ```ts
 * const dashboard: Dashboard = {
 *   widgets: [
 *     { id: 'count', type: 'kpi', label: {...}, scope: 'own' },
 *   ],
 * };
 * ```
 */
export const DashboardSchema = z.object({
    /** At least one widget is required — an empty dashboard is a config error. */
    widgets: z.array(WidgetSchema).min(1)
});

/**
 * Inferred TypeScript type for {@link DashboardSchema}.
 *
 * @example
 * ```ts
 * const d: Dashboard = { widgets: [{ id: 'w1', type: 'list', label: {...}, scope: 'all' }] };
 * ```
 */
export type Dashboard = z.infer<typeof DashboardSchema>;

/**
 * Which create actions to show in the topbar quick-create button.
 *
 * - `'all'`        — shorthand: show all create actions available to this role.
 * - `string[]`     — explicit list of create-action IDs (at least one).
 * - `null`         — no quick-create button shown.
 *
 * @example
 * ```ts
 * const qc: QuickCreate = ['newAccommodation', 'newPost'];
 * ```
 */
export const QuickCreateSchema = z.union([z.literal('all'), z.array(z.string().min(1)).min(1)]);

/**
 * Topbar configuration for a role — controls the global action bar at the top
 * of the admin shell.
 *
 * @example
 * ```ts
 * const topbar: TopbarConfig = {
 *   showSearch: true,
 *   showQuickCreate: ['newAccommodation'],
 *   accountInMenu: false,
 * };
 * ```
 */
export const TopbarConfigSchema = z.object({
    /** Whether to show the Cmd+K command-palette search button. */
    showSearch: z.boolean(),
    /**
     * Which create actions to show in the "+" button.
     * `null` hides the button entirely.
     */
    showQuickCreate: QuickCreateSchema.nullable(),
    /**
     * When `true`, "Mi cuenta" appears in the main nav.
     * When `false`, it appears only in the avatar dropdown.
     */
    accountInMenu: z.boolean()
});

/**
 * Inferred TypeScript type for {@link TopbarConfigSchema}.
 *
 * @example
 * ```ts
 * const t: TopbarConfig = { showSearch: false, showQuickCreate: null, accountInMenu: true };
 * ```
 */
export type TopbarConfig = z.infer<typeof TopbarConfigSchema>;

/**
 * Mobile navigation configuration for a role.
 *
 * `bottomNav` contains section IDs to surface in the bottom navigation bar.
 * Min 2 (less doesn't justify a bottom nav); max 7. With 6–7 entries the bar
 * renders icon-only (compact mode) so it still fits a phone width.
 * Set to `null` to use hamburger menu only.
 *
 * @example
 * ```ts
 * const mobile: MobileConfig = {
 *   bottomNav: ['inicio', 'misAlojamientos', 'consultas', 'miCuenta'],
 *   fab: 'newAccommodation',
 * };
 * ```
 */
export const MobileConfigSchema = z.object({
    /**
     * Section IDs to surface in the bottom navigation bar.
     * Must be between 2 and 7 entries (6–7 render icon-only). Set to `null` for hamburger-only.
     */
    bottomNav: z.array(z.string()).min(2).max(7).nullable(),
    /** ID of a single create-action to render as a Floating Action Button. `null` = no FAB. */
    fab: z.string().nullable()
});

/**
 * Inferred TypeScript type for {@link MobileConfigSchema}.
 *
 * @example
 * ```ts
 * const m: MobileConfig = { bottomNav: null, fab: null };
 * ```
 */
export type MobileConfig = z.infer<typeof MobileConfigSchema>;

// ============================================================================
// ROLES / CREATE ACTIONS / TOP-LEVEL CONFIG (T-006)
// ============================================================================

/**
 * Configuration for a single admin role.
 *
 * When `enabled` is `false` the role is deferred and the navigation fields
 * (`mainMenu`, `dashboard`, `topbar`, `mobile`) are optional.
 * When `enabled` is `true` all four navigation fields are required — a
 * `.superRefine` check enforces this at boot time so missing fields crash
 * immediately with a precise error path.
 *
 * The role-to-permission bundle is defined in `ROLE_PERMISSIONS` (seed data),
 * NOT in this config. `RoleConfigSchema` exclusively covers navigation and
 * presentation concerns. This separation was established in T-040 (SPEC-154 §11.4
 * decision D): permissions are a data concern, not a config concern.
 *
 * @example
 * ```ts
 * // Enabled role
 * const host: RoleConfig = {
 *   enabled: true,
 *   label: { es: 'Anfitrión', en: 'Host', pt: 'Anfitrião' },
 *   mainMenu: ['inicio', 'misAlojamientos', 'consultas', 'miCuenta'],
 *   dashboard: 'hostDashboard',
 *   topbar: { showSearch: false, showQuickCreate: ['newAccommodation'], accountInMenu: true },
 *   mobile: { bottomNav: ['inicio', 'misAlojamientos', 'consultas', 'miCuenta'], fab: 'newAccommodation' },
 *   labelOverrides: {},
 * };
 *
 * // Deferred role
 * const sponsor: RoleConfig = {
 *   enabled: false,
 *   label: { es: 'Sponsor', en: 'Sponsor', pt: 'Patrocinador' },
 * };
 * ```
 */
export const RoleConfigSchema = z
    .object({
        enabled: z.boolean(),
        label: I18nLabelSchema,
        /**
         * Ordered list of section IDs for the main menu.
         * Required when `enabled` is `true` (at least 1 entry).
         */
        mainMenu: z.array(z.string()).optional(),
        /**
         * Dashboard ID reference (must resolve in the `dashboards` map).
         * Required when `enabled` is `true`.
         */
        dashboard: z.string().optional(),
        /**
         * Topbar configuration for this role.
         * Required when `enabled` is `true`.
         */
        topbar: TopbarConfigSchema.optional(),
        /**
         * Mobile navigation configuration for this role.
         * Required when `enabled` is `true`.
         */
        mobile: MobileConfigSchema.optional(),
        /**
         * Per-role label overrides. Key format: `'sidebarId.itemId'` (item label)
         * or `'sectionId'` (section label). Defaults to an empty object.
         */
        labelOverrides: z.record(z.string(), I18nLabelSchema).default({})
    })
    .superRefine((role, ctx) => {
        if (!role.enabled) return;

        if (!role.mainMenu || role.mainMenu.length < 1) {
            ctx.addIssue({
                code: 'custom',
                path: ['mainMenu'],
                message: 'mainMenu must have ≥1 section when role is enabled'
            });
        }
        if (!role.dashboard) {
            ctx.addIssue({
                code: 'custom',
                path: ['dashboard'],
                message: 'dashboard ref required when role is enabled'
            });
        }
        if (!role.topbar) {
            ctx.addIssue({
                code: 'custom',
                path: ['topbar'],
                message: 'topbar config required when role is enabled'
            });
        }
        if (!role.mobile) {
            ctx.addIssue({
                code: 'custom',
                path: ['mobile'],
                message: 'mobile config required when role is enabled'
            });
        }
    });

/**
 * Inferred TypeScript type for {@link RoleConfigSchema}.
 *
 * @example
 * ```ts
 * const rc: RoleConfig = { enabled: false, label: { es: 'Sponsor', en: 'Sponsor', pt: 'Patrocinador' } };
 * ```
 */
export type RoleConfig = z.infer<typeof RoleConfigSchema>;

/**
 * A create action entry in the global registry.
 * Referenced by topbar `showQuickCreate` arrays and mobile `fab`.
 *
 * @example
 * ```ts
 * const action: CreateAction = {
 *   id: 'newAccommodation',
 *   label: { es: 'Nuevo alojamiento', en: 'New accommodation', pt: 'Novo alojamento' },
 *   route: '/catalogo/alojamientos/new',
 *   icon: 'plus',
 *   permissions: ['ACCOMMODATION_CREATE'],
 * };
 * ```
 */
export const CreateActionSchema = z.object({
    /** Unique identifier — referenced by topbar and mobile configs. */
    id: z.string().min(1),
    label: I18nLabelSchema,
    /** Target route — must begin with "/". */
    route: z.string().startsWith('/'),
    /** Optional icon ID from @repo/icons. */
    icon: z.string().optional(),
    /** Optional permission gate — omit to show to all authenticated users. */
    permissions: PermissionGateSchema.optional()
});

/**
 * Inferred TypeScript type for {@link CreateActionSchema}.
 *
 * @example
 * ```ts
 * const ca: CreateAction = { id: 'newPost', label: {...}, route: '/editorial/blog/new' };
 * ```
 */
export type CreateAction = z.infer<typeof CreateActionSchema>;

/**
 * Top-level Admin IA configuration object — the single value that gets
 * validated at boot. All maps use string keys for sections, sidebars,
 * dashboards, tabs and createActions; roles are keyed by `RoleEnum` values.
 *
 * Cross-reference validations (sidebar refs, mainMenu refs, dashboard refs,
 * create-action refs, bottomNav refs, labelOverride paths, permission expansion
 * sanity, unique sidebar IDs, SUPER_ADMIN wildcard restriction) will be added
 * here as a `.superRefine()` in T-018. Leave this comment as a marker.
 *
 * // TODO T-018: add .superRefine() cross-reference validations per doc 02 §13
 *
 * @example
 * ```ts
 * const config: AdminIAConfig = {
 *   sections: { inicio: { ... } },
 *   sidebars: { inicioSidebar: { ... } },
 *   dashboards: { hostDashboard: { ... } },
 *   tabs: { accommodation: { ... } },
 *   createActions: { newAccommodation: { ... } },
 *   roles: { [RoleEnum.HOST]: { ... } },
 * };
 * ```
 */
// ============================================================================
// T-018 helpers — used inside AdminIAConfigSchema.superRefine()
// ============================================================================

/**
 * Recursively collects all item IDs from a sidebar item tree.
 * Traverses into `group` children to collect nested IDs.
 *
 * @param items - Array of sidebar items (top-level or group children).
 * @param out   - Accumulator set that receives collected IDs.
 */
function collectSidebarIds(items: z.input<typeof SidebarItemSchema>[], out: Set<string>): void {
    for (const item of items) {
        out.add(item.id);
        if (item.type === 'group') {
            collectSidebarIds(item.items as z.input<typeof SidebarItemSchema>[], out);
        }
    }
}

/**
 * Resolves a `labelOverrides` path key against the live config.
 *
 * Two valid formats:
 * - `'sidebarId.itemId'` — the sidebar exists AND has an item (any depth) with
 *   that id.
 * - `'sectionId'`        — the section exists in `config.sections`.
 *
 * @param config - The top-level IA config (input shape).
 * @param path   - The override key to resolve.
 * @returns `true` if the path resolves, `false` otherwise.
 */
function resolveLabelPath(config: z.input<typeof AdminIAConfigSchema>, path: string): boolean {
    const dotIdx = path.indexOf('.');
    if (dotIdx === -1) {
        // Format: 'sectionId'
        return Boolean(config.sections[path]);
    }
    // Format: 'sidebarId.itemId'
    const sidebarId = path.slice(0, dotIdx);
    const itemId = path.slice(dotIdx + 1);
    const sidebar = config.sidebars[sidebarId];
    if (!sidebar) return false;
    const ids = new Set<string>();
    collectSidebarIds(sidebar.items as z.input<typeof SidebarItemSchema>[], ids);
    return ids.has(itemId);
}

/**
 * Top-level Admin IA configuration object — the single value that gets
 * validated at boot. All maps use string keys for sections, sidebars,
 * dashboards, tabs and createActions; roles are keyed by `RoleEnum` values.
 *
 * Cross-reference validations run in `.superRefine()` (T-018). Any failure
 * causes the app to refuse to start with a precise error path and message.
 * Implemented validations (per doc 02 §13, §13.7 and §13.9 are DROPPED):
 *   §13.1 — sidebar refs
 *   §13.2 — role mainMenu section refs
 *   §13.3 — role dashboard refs
 *   §13.4 — create-action refs (topbar + mobile FAB)
 *   §13.5 — mobile.bottomNav refs (must be in mainMenu)
 *   §13.6 — labelOverrides path resolution
 *   §13.8 — unique item IDs within each sidebar
 *
 * @example
 * ```ts
 * const config: AdminIAConfig = {
 *   sections: { inicio: { ... } },
 *   sidebars: { inicioSidebar: { ... } },
 *   dashboards: { hostDashboard: { ... } },
 *   tabs: { accommodation: { ... } },
 *   createActions: { newAccommodation: { ... } },
 *   roles: { [RoleEnum.HOST]: { ... } },
 * };
 * ```
 */
export const AdminIAConfigSchema = z
    .object({
        sections: z.record(z.string(), SectionSchema),
        sidebars: z.record(z.string(), SidebarSchema),
        dashboards: z.record(z.string(), DashboardSchema),
        /** Keyed by entity name (e.g. `'accommodation'`, `'post'`, `'event'`). */
        tabs: z.record(z.string(), TabsConfigSchema),
        createActions: z.record(z.string(), CreateActionSchema),
        /**
         * Role configs keyed by RoleEnum value string.
         *
         * Uses `z.string()` (not `z.nativeEnum(RoleEnum)` nor `z.partialRecord`)
         * deliberately:
         * - `z.record(z.nativeEnum(RoleEnum), …)` in Zod v4 requires ALL enum keys
         *   present, but USER/GUEST/SYSTEM are platform roles with no admin IA config.
         * - `z.partialRecord(z.nativeEnum(RoleEnum), …)` keeps key typing but makes
         *   every value `RoleConfig | undefined`, which forces undefined-guards through
         *   the entire superRefine and tests for no real safety gain.
         * Key typos are already caught at compile time because the composer
         * (`index.ts`) builds this object with `RoleEnum.X` keys. The cross-reference
         * validations below validate the provided keys' contents.
         */
        roles: z.record(z.string(), RoleConfigSchema)
    })
    .superRefine((config, ctx) => {
        // ── §13.1 Sidebar refs ────────────────────────────────────────────
        // Every section.sidebar (when not null) must exist in config.sidebars.
        for (const [sectionId, section] of Object.entries(config.sections)) {
            if (section.sidebar !== null && !config.sidebars[section.sidebar]) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['sections', sectionId, 'sidebar'],
                    message: `Sidebar '${section.sidebar}' not found in sidebars`
                });
            }
        }

        // ── §13.2 Role mainMenu section refs ──────────────────────────────
        // Every entry in an enabled role's mainMenu must be a known section ID.
        for (const [roleId, role] of Object.entries(config.roles)) {
            if (!role.enabled || !role.mainMenu) continue;
            for (const [idx, sectionId] of role.mainMenu.entries()) {
                if (!config.sections[sectionId]) {
                    ctx.addIssue({
                        code: 'custom',
                        path: ['roles', roleId, 'mainMenu', idx],
                        message: `Section '${sectionId}' not found in sections`
                    });
                }
            }
        }

        // ── §13.3 Role dashboard refs ──────────────────────────────────────
        // Every enabled role's dashboard must reference a known dashboard.
        for (const [roleId, role] of Object.entries(config.roles)) {
            if (!role.enabled || !role.dashboard) continue;
            if (!config.dashboards[role.dashboard]) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['roles', roleId, 'dashboard'],
                    message: `Dashboard '${role.dashboard}' not found in dashboards`
                });
            }
        }

        // ── §13.4 Create-action refs ───────────────────────────────────────
        // topbar.showQuickCreate (array) entries and mobile.fab must exist in
        // config.createActions.
        for (const [roleId, role] of Object.entries(config.roles)) {
            if (!role.enabled) continue;

            const qc = role.topbar?.showQuickCreate;
            if (Array.isArray(qc)) {
                for (const [idx, actionId] of qc.entries()) {
                    if (!config.createActions[actionId]) {
                        ctx.addIssue({
                            code: 'custom',
                            path: ['roles', roleId, 'topbar', 'showQuickCreate', idx],
                            message: `Create action '${actionId}' not found in createActions`
                        });
                    }
                }
            }

            const fab = role.mobile?.fab;
            if (fab && !config.createActions[fab]) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['roles', roleId, 'mobile', 'fab'],
                    message: `Create action '${fab}' not found in createActions`
                });
            }
        }

        // ── §13.5 mobile.bottomNav refs ────────────────────────────────────
        // Every entry in mobile.bottomNav must be a section ID present in the
        // role's own mainMenu.
        for (const [roleId, role] of Object.entries(config.roles)) {
            if (!role.enabled || !role.mobile?.bottomNav) continue;
            for (const [idx, sectionId] of role.mobile.bottomNav.entries()) {
                if (!role.mainMenu?.includes(sectionId)) {
                    ctx.addIssue({
                        code: 'custom',
                        path: ['roles', roleId, 'mobile', 'bottomNav', idx],
                        message: `bottomNav section '${sectionId}' must be in the role's mainMenu`
                    });
                }
            }
        }

        // ── §13.6 labelOverrides path resolution ───────────────────────────
        // Every labelOverrides key must resolve to a known item or section.
        // Format: 'sidebarId.itemId' or 'sectionId'.
        for (const [roleId, role] of Object.entries(config.roles)) {
            if (!role.enabled) continue;
            const overrides = role.labelOverrides ?? {};
            for (const key of Object.keys(overrides)) {
                if (!resolveLabelPath(config, key)) {
                    ctx.addIssue({
                        code: 'custom',
                        path: ['roles', roleId, 'labelOverrides', key],
                        message: `Label override path '${key}' does not resolve to any known sidebar item or section`
                    });
                }
            }
        }

        // ── §13.8 Unique IDs within each sidebar ───────────────────────────
        // Within a sidebar, all item IDs (recursively flattened) must be unique.
        for (const [sidebarId, sidebar] of Object.entries(config.sidebars)) {
            const ids = new Set<string>();
            const duplicates: string[] = [];
            const visit = (items: z.input<typeof SidebarItemSchema>[]): void => {
                for (const item of items) {
                    if (ids.has(item.id)) {
                        duplicates.push(item.id);
                    } else {
                        ids.add(item.id);
                    }
                    if (item.type === 'group') {
                        visit(item.items as z.input<typeof SidebarItemSchema>[]);
                    }
                }
            };
            visit(sidebar.items as z.input<typeof SidebarItemSchema>[]);
            if (duplicates.length > 0) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['sidebars', sidebarId],
                    message: `Duplicate item IDs in sidebar: ${duplicates.join(', ')}`
                });
            }
        }
    });

/**
 * Inferred TypeScript type for {@link AdminIAConfigSchema}.
 *
 * @example
 * ```ts
 * const config: AdminIAConfig = AdminIAConfigSchema.parse(rawConfig);
 * ```
 */
export type AdminIAConfig = z.infer<typeof AdminIAConfigSchema>;
