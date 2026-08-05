/**
 * @file nav-gating.ts
 * @description Gating engine for the account navigation (HOS-131 D-4).
 *
 * Every `NavGroup`/`NavItem` in `src/config/navigation.ts` declares its gating
 * semantics once, via `requiredPermission` (`PermissionEnum`) — that
 * declaration is the single source of truth. Evaluation is asymmetric by
 * surface because of a real architecture constraint (see spec §6.6 D-4):
 *
 * - **Client surfaces** (avatar dropdown, any React island) have the user's
 *   real effective permission strings from `GET /api/v1/public/auth/me`
 *   (`(role ∪ grants) \ denies`, SPEC-170) — evaluate exactly with
 *   `isVisibleByPermissions`.
 * - **Server SSR** (the `/mi-cuenta/*` sidebar, `AccountLayout.astro`) only
 *   has `Astro.locals.user.roles` — no effective-permissions round-trip is
 *   available without an uncached `/auth/me` call per render (rejected by
 *   D-4 on cost grounds). It approximates via `isVisibleByRoles`, which
 *   consults the centralized `PERMISSION_ROLE_MAP` below.
 *
 * `PERMISSION_ROLE_MAP` is the ONLY place that maps a permission to the
 * roles that grant it for account-nav gating purposes. HOS-296 completed the
 * migration HOS-131 deferred: the scattered `isHostRole` /
 * `isCommerceOwnerRole` predicates are gone and every `/mi-cuenta` page gate
 * now evaluates through {@link hasAccommodationsNavAccess} /
 * {@link hasCommerceNavAccess}, so `apps/web` has ONE gating mechanism.
 *
 * HOS-296: the SSR evaluator takes the actor's whole role SET, not a scalar.
 * A node is visible when ANY held role grants the permission — that is what
 * makes a user who is both HOST and COMMERCE_OWNER see both nav groups
 * (AC-1).
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';

/**
 * Structural shape shared by `NavGroup` and `NavItem` — the only property the
 * gating helpers need. Kept local (not imported from `src/config/navigation`)
 * to avoid a circular dependency between the config and the gating engine.
 */
export interface GatedNavNode {
    readonly requiredPermission?: PermissionEnum;
}

/**
 * Centralized `permission -> roles` approximation map, used ONLY by the
 * server-side SSR evaluator (`isVisibleByRoles`). Client surfaces never
 * consult this map — they evaluate exact permission strings instead.
 *
 * Derived from `apps/web/src/lib/account-roles.ts`:
 * - `ACCOMMODATION_CREATE` ← `ROLES_WITH_ACCOMMODATIONS_NAV`
 *   (HOST, ADMIN, SUPER_ADMIN, CLIENT_MANAGER, EDITOR).
 * - `COMMERCE_EDIT_OWN` ← `ROLES_WITH_COMMERCE_NAV`
 *   (COMMERCE_OWNER, ADMIN, SUPER_ADMIN).
 *
 * Add an entry here whenever a new gated nav group/item is introduced with a
 * `requiredPermission` that the sidebar needs to approximate.
 *
 * Typed as `Partial<Record<PermissionEnum, ...>>` (not `Record<string, ...>`)
 * so a typo'd or wrong-enum key is a compile error, not a silent no-op — see
 * the "exhaustive coverage" regression test in `navigation.test.ts`, which
 * walks every `requiredPermission` actually declared in `ACCOUNT_NAV_GROUPS`
 * and fails if this map is missing an entry for one of them. A missing entry
 * here makes `isVisibleByRoles` silently return `false` for EVERY role
 * (including admin) on that node — `Partial` only guards against typos in
 * the *keys we do write*; it cannot by itself guarantee every permission the
 * config declares has a matching entry, which is exactly what that test is for.
 */
export const PERMISSION_ROLE_MAP: Partial<Record<PermissionEnum, ReadonlySet<RoleEnum>>> = {
    [PermissionEnum.ACCOMMODATION_CREATE]: new Set<RoleEnum>([
        RoleEnum.HOST,
        RoleEnum.ADMIN,
        RoleEnum.SUPER_ADMIN,
        RoleEnum.CLIENT_MANAGER,
        RoleEnum.EDITOR
    ]),
    [PermissionEnum.COMMERCE_EDIT_OWN]: new Set<RoleEnum>([
        RoleEnum.COMMERCE_OWNER,
        RoleEnum.ADMIN,
        RoleEnum.SUPER_ADMIN
    ]),
    // Editors + admins hold POST_CREATE; hosts/tourists/commerce-owners do
    // not. This is the editor discovery-door "acquired" signal (HOS-134
    // §5.3/§5.4) — it drives both the "Ya lo tenés" state on the aliados hub
    // and the stateful partner-door label.
    [PermissionEnum.POST_CREATE]: new Set<RoleEnum>([
        RoleEnum.EDITOR,
        RoleEnum.ADMIN,
        RoleEnum.SUPER_ADMIN
    ]),
    // Same role set as POST_CREATE (EDITOR, ADMIN, SUPER_ADMIN — verified
    // against `packages/seed/src/required/rolePermissions.seed.ts`), kept as
    // its own map entry rather than reused from POST_CREATE: events and posts
    // are separate content domains with separate permissions server-side, and
    // a future divergence between the two role sets must not silently change
    // `hasPostsNavAccess` too. Backs the `/mi-cuenta/eventos` own-content
    // listing gate (HOS-374 Phase 2 2C-1).
    [PermissionEnum.EVENT_CREATE]: new Set<RoleEnum>([
        RoleEnum.EDITOR,
        RoleEnum.ADMIN,
        RoleEnum.SUPER_ADMIN
    ])
};

/**
 * Exact client-side gating evaluator. Use on the avatar dropdown and any
 * other React island that has the user's real effective permission strings.
 *
 * Loading-state contract: while the effective-permissions fetch is still in
 * flight, callers MUST pass `[]` (never `null`/`undefined`) as `permissions`.
 * A gated node then evaluates to `false` — hidden, fail-closed — until the
 * real list resolves, instead of flashing visible-then-hidden once the
 * fetch settles.
 *
 * @param node - A `NavGroup` or `NavItem` (or any object shaped like one).
 * @param permissions - The user's effective permission strings
 *   (`(role ∪ grants) \ denies`, from `GET /api/v1/public/auth/me`). Pass
 *   `[]` while loading (see loading-state contract above).
 * @returns `true` if `node` has no `requiredPermission`, or if `permissions`
 *   contains it; `false` otherwise.
 */
export function isVisibleByPermissions(
    node: GatedNavNode,
    permissions: readonly string[]
): boolean {
    if (!node.requiredPermission) {
        return true;
    }
    return permissions.includes(node.requiredPermission);
}

/**
 * Approximate server-side (SSR) gating evaluator. Use on the `/mi-cuenta/*`
 * sidebar, which only has `Astro.locals.user.roles` — no effective-permissions
 * round-trip (HOS-131 D-4). Consults `PERMISSION_ROLE_MAP` to approximate
 * "does any held role plausibly carry this permission".
 *
 * HOS-296: the second argument is the actor's whole role SET. Visibility is a
 * union — a node is visible as soon as ONE held role grants the permission, so
 * accumulating hats can only ever ADD nav, never remove it. A user holding
 * both `HOST` and `COMMERCE_OWNER` therefore sees both groups (AC-1).
 *
 * @param node - A `NavGroup` or `NavItem` (or any object shaped like one).
 * @param roles - Every role the user holds, from `Astro.locals.user.roles`.
 *   Pass `null` (or an empty array) for unauthenticated visitors. Accepts any
 *   strings (not just `RoleEnum` members) so an unrecognized/legacy role value
 *   fails closed instead of erroring — see the "unknown role" test.
 * @returns `true` if `node` has no `requiredPermission`; `false` for a
 *   `null`/empty role set, an unmapped `requiredPermission`, or a role set
 *   that shares no member with the mapped role set.
 */
export function isVisibleByRoles(node: GatedNavNode, roles: readonly string[] | null): boolean {
    if (!node.requiredPermission) {
        return true;
    }
    if (roles === null || roles.length === 0) {
        return false;
    }
    const rolesForPermission = PERMISSION_ROLE_MAP[node.requiredPermission];
    if (!rolesForPermission) {
        return false;
    }
    return roles.some((role) => rolesForPermission.has(role as RoleEnum));
}

/**
 * Does the user hold a role that grants the accommodation/host navigation
 * (sidebar "Mis propiedades", host dashboard, owner inbox, property pages)?
 *
 * Thin, named wrapper over {@link isVisibleByRoles} keyed on
 * `ACCOMMODATION_CREATE` — the permission `PERMISSION_ROLE_MAP` already uses
 * to approximate host-tier access for the sidebar. HOS-296 §6.5 routed the
 * page-level guards through it so the sidebar and the pages it links to can
 * never disagree about who is a host.
 *
 * @param params - `{ roles }` (RO-RO): every role the user holds, or `null`
 *   for unauthenticated visitors.
 * @returns `true` when at least one held role carries host-tier access.
 */
export function hasAccommodationsNavAccess({
    roles
}: {
    readonly roles: readonly string[] | null;
}): boolean {
    return isVisibleByRoles({ requiredPermission: PermissionEnum.ACCOMMODATION_CREATE }, roles);
}

/**
 * Does the user hold a role that grants the commerce-owner self-service area
 * (`/mi-cuenta/comercio/*`)?
 *
 * Companion to {@link hasAccommodationsNavAccess}, keyed on
 * `COMMERCE_EDIT_OWN`. The two sets are deliberately distinct: a plain
 * accommodation HOST does not get the commerce area, and a plain
 * COMMERCE_OWNER does not get the host nav. A user holding BOTH hats gets
 * both — which is the whole point of HOS-296.
 *
 * @param params - `{ roles }` (RO-RO): every role the user holds, or `null`
 *   for unauthenticated visitors.
 * @returns `true` when at least one held role carries commerce-owner access.
 */
export function hasCommerceNavAccess({
    roles
}: {
    readonly roles: readonly string[] | null;
}): boolean {
    return isVisibleByRoles({ requiredPermission: PermissionEnum.COMMERCE_EDIT_OWN }, roles);
}

/**
 * Does the user hold a role that grants the own-posts editorial listing
 * (`/mi-cuenta/publicaciones`, HOS-374 Phase 2 2C-1)?
 *
 * Keyed on `POST_CREATE` — the same permission the HOS-134 editor
 * discovery-door signal already uses, so the two never disagree about who
 * counts as an editor.
 *
 * @param params - `{ roles }` (RO-RO): every role the user holds, or `null`
 *   for unauthenticated visitors.
 * @returns `true` when at least one held role carries editor-tier access.
 */
export function hasPostsNavAccess({
    roles
}: {
    readonly roles: readonly string[] | null;
}): boolean {
    return isVisibleByRoles({ requiredPermission: PermissionEnum.POST_CREATE }, roles);
}

/**
 * Does the user hold a role that grants the own-events editorial listing
 * (`/mi-cuenta/eventos`, HOS-374 Phase 2 2C-1)?
 *
 * Keyed on `EVENT_CREATE`, a distinct map entry from `POST_CREATE` — see the
 * comment on that entry in `PERMISSION_ROLE_MAP` for why the two are not
 * collapsed into one shared permission even though they resolve to the same
 * role set today.
 *
 * @param params - `{ roles }` (RO-RO): every role the user holds, or `null`
 *   for unauthenticated visitors.
 * @returns `true` when at least one held role carries editor-tier access.
 */
export function hasEventsNavAccess({
    roles
}: {
    readonly roles: readonly string[] | null;
}): boolean {
    return isVisibleByRoles({ requiredPermission: PermissionEnum.EVENT_CREATE }, roles);
}

// -----------------------------------------------------------------------------
// Discovery-door helpers (HOS-131 §6.2/§6.3, OQ-3: acquired signal = permissions)
// -----------------------------------------------------------------------------

/**
 * Structural shape for a discovery-door option, as needed by the door
 * helpers below. Kept local (not imported from `src/config/navigation`) for
 * the same circular-dependency reason as `GatedNavNode` above.
 */
export interface DoorGatingOption {
    /** The permission that signals "already acquired". Omitted = never acquired. */
    readonly acquiredPermission?: PermissionEnum;
    /** `true` = a not-yet-implemented placeholder (sponsor, service provider). */
    readonly comingSoon?: boolean;
}

/** The three states a discovery-door option can resolve to (spec §6.3). */
export type DoorOptionState = 'acquired' | 'unacquired' | 'comingSoon';

/**
 * Resolves a single discovery-door option's state (HOS-131 §6.3), using the
 * SAME visibility predicate as the two nav evaluators above — pass
 * `(node) => isVisibleByPermissions(node, permissions)` on client surfaces or
 * `(node) => isVisibleByRoles(node, roles)` on the server-rendered sidebar/hub
 * pages.
 *
 * An option with no `acquiredPermission` (the sponsor/service-provider
 * placeholders — HOS-131 NG-2) is NEVER `'acquired'`: it resolves to
 * `'comingSoon'` when `comingSoon` is set, or `'unacquired'` otherwise. This
 * is what makes the "Sumate como aliado" door "always shown" fall out of the
 * SAME `isDoorVisible` logic used for the listing door — no `kind`-based
 * branching required.
 *
 * @param params - `{ option, visibility }` (RO-RO).
 * @returns The option's resolved state.
 */
export function resolveDoorOptionState({
    option,
    visibility
}: {
    readonly option: DoorGatingOption;
    readonly visibility: (node: GatedNavNode) => boolean;
}): DoorOptionState {
    if (!option.acquiredPermission) {
        return option.comingSoon ? 'comingSoon' : 'unacquired';
    }
    return visibility({ requiredPermission: option.acquiredPermission })
        ? 'acquired'
        : 'unacquired';
}

/**
 * Decides whether a discovery door should be shown (HOS-131 §6.3): a door
 * stays visible while at least one of its options is NOT `'acquired'`, and
 * disappears once every option is. Both the sidebar CTA entries and the hub
 * pages call this with the surface-appropriate `visibility` predicate.
 *
 * @param params - `{ door, visibility }` (RO-RO).
 * @returns `true` if the door has at least one unacquired/coming-soon option.
 */
export function isDoorVisible({
    door,
    visibility
}: {
    readonly door: { readonly options: readonly DoorGatingOption[] };
    readonly visibility: (node: GatedNavNode) => boolean;
}): boolean {
    return door.options.some(
        (option) => resolveDoorOptionState({ option, visibility }) !== 'acquired'
    );
}

/**
 * Structural shape for a discovery door, as needed by
 * {@link resolveDoorLabelKey}. Kept local for the same circular-dependency
 * reason as {@link DoorGatingOption} above.
 */
export interface DoorLabelNode {
    /** i18n key for the door's default (non-stateful) label. */
    readonly i18nKey: string;
    /** i18n key for the stateful label, shown once ≥1 option is acquired. */
    readonly statefulI18nKey?: string;
    readonly options: readonly DoorGatingOption[];
}

/**
 * Resolves which i18n key to render for a discovery door's CTA/title label
 * (HOS-134 §5.4): the stateful variant ("Sumá otra alianza") once the door
 * declares `statefulI18nKey` AND at least one of its options resolves to
 * `'acquired'`; the base `i18nKey` otherwise. A door with no
 * `statefulI18nKey` (e.g. the listing door) always resolves to `i18nKey` —
 * this is a no-op for it.
 *
 * @param params - `{ door, visibility }` (RO-RO). `visibility` is the same
 *   surface-appropriate predicate passed to `resolveDoorOptionState`.
 * @returns The i18n key to resolve via `t()` for the door's label.
 */
export function resolveDoorLabelKey({
    door,
    visibility
}: {
    readonly door: DoorLabelNode;
    readonly visibility: (node: GatedNavNode) => boolean;
}): string {
    if (!door.statefulI18nKey) {
        return door.i18nKey;
    }
    const hasAcquiredOption = door.options.some(
        (option) => resolveDoorOptionState({ option, visibility }) === 'acquired'
    );
    return hasAcquiredOption ? door.statefulI18nKey : door.i18nKey;
}
