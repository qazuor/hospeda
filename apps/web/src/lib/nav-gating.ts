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
 *   has `Astro.locals.user.role` — no effective-permissions round-trip is
 *   available without an uncached `/auth/me` call per render (rejected by
 *   D-4 on cost grounds). It approximates via `isVisibleByRole`, which
 *   consults the centralized `PERMISSION_ROLE_MAP` below.
 *
 * `PERMISSION_ROLE_MAP` is the ONLY place that maps a permission to the
 * roles that grant it for account-nav gating purposes — it replaces the
 * scattered `isHostRole` / `isCommerceOwnerRole` predicates in
 * `account-roles.ts` (kept for now; existing consumers migrate in a later
 * HOS-131 task).
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
 * server-side SSR evaluator (`isVisibleByRole`). Client surfaces never
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
 * here makes `isVisibleByRole` silently return `false` for EVERY role
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
 * sidebar, which only has `Astro.locals.user.role` — no effective-permissions
 * round-trip (HOS-131 D-4). Consults `PERMISSION_ROLE_MAP` to approximate
 * "does this role plausibly carry this permission".
 *
 * @param node - A `NavGroup` or `NavItem` (or any object shaped like one).
 * @param role - The user's role string from `Astro.locals.user.role`, or
 *   `null` for unauthenticated visitors. Accepts any string (not just
 *   `RoleEnum` members) so an unrecognized/legacy role value fails closed
 *   (returns `false`) instead of erroring — see the "unknown role" test.
 * @returns `true` if `node` has no `requiredPermission`; `false` for `null`
 *   role, an unmapped `requiredPermission`, or a `role` absent from the
 *   mapped role set.
 */
export function isVisibleByRole(node: GatedNavNode, role: string | null): boolean {
    if (!node.requiredPermission) {
        return true;
    }
    if (role === null) {
        return false;
    }
    const rolesForPermission = PERMISSION_ROLE_MAP[node.requiredPermission];
    return rolesForPermission?.has(role as RoleEnum) ?? false;
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
 * `(node) => isVisibleByRole(node, role)` on the server-rendered sidebar/hub
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
