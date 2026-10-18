/**
 * HOS-1689 — each row of `ADMINISTRATIVE_ACTION_PERMISSIONS` must agree with the
 * gate of the route that implements it.
 *
 * The table (`@repo/verticals`) declares the current permission of every one of
 * the 25 administrative actions; the routes enforce it. Nothing ties the two
 * together, so a row cannot rot without anyone noticing — which is exactly what
 * happened to ACC_11: HOS-1445 landed `TRIAL_EXTEND` on the route while the row
 * still said `permissions: []`.
 *
 * The comparison is STATIC (source text), not runtime, for two reasons. The
 * permission never reaches the route object: `createAdminRoute` closes over
 * `requiredPermissions` inside its auth middleware, so a route module exposes no
 * field to read. And importing the routes to inspect them would drag in
 * service-core and the DB for a test that only needs the source. So this guard
 * reads the files, strips comments, and compares the literals.
 *
 * A row is checked through `ROUTE_BINDINGS`. Because the binding is manual, a
 * NEW route for an administrative action is invisible to this guard until it is
 * added there — the switch from unbound to bound is a deliberate edit.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PermissionEnum } from '@repo/schemas';
import {
    ADMINISTRATIVE_ACTION_PERMISSIONS,
    ADMINISTRATIVE_ACTIONS,
    type AdministrativeAction
} from '@repo/verticals';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

/**
 * Strips block and line comments before matching, so a route's own docblock
 * cannot satisfy (or defeat) a match. Same shape as the partner-stats guard.
 */
const readCode = (file: string): string =>
    readFileSync(file, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

/** The text of one route export, up to the next top-level `export`. */
const routeBlock = (code: string, exportName: string, file: string): string => {
    const start = code.indexOf(`export const ${exportName} =`);
    if (start === -1) throw new Error(`No \`export const ${exportName} =\` in ${file}`);
    const next = code.indexOf('\nexport ', start + 1);
    return next === -1 ? code.slice(start) : code.slice(start, next);
};

/** enum member name -> value. No casts: the enum object is the map's source. */
const PERMISSION_BY_KEY = new Map(Object.entries(PermissionEnum));

/** Every `PermissionEnum.<KEY>` in a fragment, translated through the map. */
const extractPermissions = (fragment: string): PermissionEnum[] => {
    const tokens = fragment.match(/PermissionEnum\.[A-Z0-9_]+/g) ?? [];
    return tokens.map((token) => {
        const key = token.slice('PermissionEnum.'.length);
        const permission = PERMISSION_BY_KEY.get(key);
        if (permission === undefined) {
            throw new Error(`Unknown PermissionEnum member in the routes: ${key}`);
        }
        return permission;
    });
};

const readRouteBlock = (file: string, route: string): string => {
    const code = readCode(path.join(REPO_ROOT, file));
    return routeBlock(code, route, file);
};

const list = (permissions: readonly PermissionEnum[]): string => permissions.join(', ');

type ActionRow = {
    readonly permissions: readonly PermissionEnum[];
    readonly pendingOwnPermission: string | null;
};

type Binding =
    | { readonly kind: 'required'; readonly file: string; readonly route: string }
    | { readonly kind: 'anyOf'; readonly file: string; readonly route: string }
    | { readonly kind: 'ownershipBypass'; readonly file: string; readonly route: string }
    | { readonly kind: 'tableGate'; readonly file: string; readonly markers: readonly string[] };

type BoundEntry = { readonly bindings: readonly Binding[] };
type UnboundEntry = { readonly unbound: string };

/**
 * Compares one binding against one row and returns `null` when they agree, or a
 * string naming the difference. A missing file, export, or field is an error,
 * never "no mismatch": the guard fails closed on a route it cannot read.
 */
const compareBinding = (args: {
    readonly action: AdministrativeAction;
    readonly row: ActionRow;
    readonly binding: Binding;
}): string | null => {
    const { action, row, binding } = args;

    if (binding.kind === 'tableGate') {
        const code = readCode(path.join(REPO_ROOT, binding.file));
        const missing = binding.markers.filter((marker) => !code.includes(marker));
        if (missing.length === 0 && row.permissions.length > 0) return null;
        return `Row ${action} says [${list(row.permissions)}] but ${binding.file} is a table gate: missing ${missing.length > 0 ? `[${missing.join(', ')}]` : 'no'} marker(s) and the row must hold at least one permission`;
    }

    const block = readRouteBlock(binding.file, binding.route);

    if (binding.kind === 'required') {
        const match = /requiredPermissions:\s*\[([\s\S]*?)\]/.exec(block);
        const required = match?.[1];
        if (required === undefined) {
            throw new Error(`No requiredPermissions in ${binding.file} ${binding.route}`);
        }
        const routePermissions = extractPermissions(required);
        const routeSet = new Set(routePermissions);
        const rowSet = new Set(row.permissions);
        const aligned =
            routeSet.size === routePermissions.length &&
            rowSet.size === row.permissions.length &&
            routeSet.size === rowSet.size &&
            [...routeSet].every((permission) => rowSet.has(permission));
        if (aligned) return null;
        return `Row ${action} says [${list(row.permissions)}] but ${binding.file} ${binding.route} requires [${list(routePermissions)}]`;
    }

    if (binding.kind === 'anyOf') {
        const match = /anyOfPermissions:\s*\[\s*\[([\s\S]*?)\]/.exec(block);
        const anyOfGroup = match?.[1];
        if (anyOfGroup === undefined) {
            throw new Error(`No anyOfPermissions in ${binding.file} ${binding.route}`);
        }
        const anyOf = new Set(extractPermissions(anyOfGroup));
        const aligned =
            row.permissions.length > 0 &&
            row.permissions.every((permission) => anyOf.has(permission));
        if (aligned) return null;
        return `Row ${action} says [${list(row.permissions)}] but ${binding.file} ${binding.route} admits any of [${list([...anyOf])}]`;
    }

    const match = /bypassPermission:\s*PermissionEnum\.([A-Z0-9_]+)/.exec(block);
    const bypassKey = match?.[1];
    if (bypassKey === undefined) {
        throw new Error(`No bypassPermission in ${binding.file} ${binding.route}`);
    }
    const bypass = PERMISSION_BY_KEY.get(bypassKey);
    if (bypass === undefined) {
        throw new Error(`Unknown bypass PermissionEnum member in ${binding.file}: ${bypassKey}`);
    }
    const aligned = row.permissions.length === 1 && row.permissions[0] === bypass;
    if (aligned) return null;
    return `Row ${action} says [${list(row.permissions)}] but ${binding.file} ${binding.route} bypasses exactly [${bypass}]`;
};

/** The table under test, keyed by action, in the catalog's own order. */
const ROUTE_BINDINGS: Readonly<Record<AdministrativeAction, BoundEntry | UnboundEntry>> = {
    ACC_1: { unbound: 'B9b builds it' },
    ACC_2: {
        bindings: [
            {
                kind: 'required',
                file: 'apps/api/src/routes/billing-permanent-grant/admin/grant.ts',
                route: 'adminGrantPermanentGrantRoute'
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/billing-permanent-grant/admin/anchor.ts',
                route: 'adminAnchorPermanentGrantRoute'
            }
        ]
    },
    ACC_3: {
        bindings: [
            {
                kind: 'required',
                file: 'apps/api/src/routes/partners/admin/manual-payment.ts',
                route: 'adminManualPaymentRoute'
            }
        ]
    },
    ACC_4: { unbound: 'B7 builds it' },
    ACC_5: { unbound: 'legacy HOS-278 alliance approval; V7 (HOS-1484) builds it' },
    ACC_6: { unbound: 'legacy HOS-278 partner routes; V7 (HOS-1489) builds it' },
    ACC_7: { unbound: 'B11 builds it' },
    ACC_8: {
        bindings: [
            {
                kind: 'required',
                file: 'apps/api/src/routes/billing-subscription/admin/revocation.ts',
                route: 'adminSubscriptionRevocationPreviewRoute'
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/billing-subscription/admin/revocation.ts',
                route: 'adminRevokeSubscriptionRoute'
            }
        ]
    },
    ACC_9: { unbound: 'B8b builds it' },
    ACC_10: { unbound: 'B8b builds it' },
    ACC_11: {
        bindings: [
            {
                kind: 'required',
                file: 'apps/api/src/routes/trial/admin/extend.ts',
                route: 'adminExtendTrialRoute'
            }
        ]
    },
    ACC_12: {
        bindings: [
            {
                kind: 'required',
                file: 'apps/api/src/routes/accommodation/admin/moderate.ts',
                route: 'adminModerateAccommodationRoute'
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/gastronomy/admin/moderate.ts',
                route: 'adminModerateGastronomyRoute'
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/experience/admin/moderate.ts',
                route: 'adminModerateExperienceRoute'
            }
        ]
    },
    ACC_13: { unbound: 'B6 builds it' },
    ACC_14: {
        bindings: [
            {
                kind: 'required',
                file: 'apps/api/src/routes/billing-refund/admin/settle-external.ts',
                route: 'adminSettleExternalRefundRoute'
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/billing-refund/admin/settle-external-charge.ts',
                route: 'adminSettleExternalChargeRoute'
            }
        ]
    },
    ACC_15: {
        bindings: [
            {
                kind: 'anyOf',
                file: 'apps/api/src/routes/accommodation/admin/create.ts',
                route: 'adminCreateAccommodationRoute'
            },
            {
                kind: 'anyOf',
                file: 'apps/api/src/routes/gastronomy/admin/create.ts',
                route: 'adminCreateGastronomyRoute'
            },
            {
                kind: 'anyOf',
                file: 'apps/api/src/routes/experience/admin/create.ts',
                route: 'adminCreateExperienceRoute'
            },
            {
                kind: 'ownershipBypass',
                file: 'apps/api/src/routes/accommodation/protected/update.ts',
                route: 'protectedUpdateAccommodationRoute'
            },
            {
                kind: 'ownershipBypass',
                file: 'apps/api/src/routes/accommodation/protected/patch.ts',
                route: 'protectedPatchAccommodationRoute'
            }
        ]
    },
    ACC_17: { unbound: 'B12 (HOS-1612) builds it' },
    ACC_18: {
        bindings: [
            {
                kind: 'required',
                file: 'apps/api/src/routes/plan-catalog/admin/index.ts',
                route: 'adminCreatePlanRoute'
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/plan-catalog/admin/index.ts',
                route: 'adminPreviewPlanVersionRoute'
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/plan-catalog/admin/index.ts',
                route: 'adminPublishPlanVersionRoute'
            }
        ]
    },
    ACC_19: { unbound: 'B2 (HOS-1515) builds it' },
    ACC_20: { unbound: 'B10 (HOS-1595) builds it' },
    ACC_21: { unbound: 'B9b (HOS-1591) builds it' },
    ACC_22: {
        bindings: [
            {
                kind: 'required',
                file: 'apps/api/src/routes/vertical-deadlines/admin/index.ts',
                route: 'adminChangeVerticalDeadlineRoute'
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/billing-deadlines/admin/index.ts',
                route: 'adminChangeBillingDeadlineRoute'
            }
        ]
    },
    ACC_23: {
        bindings: [
            {
                kind: 'tableGate',
                file: 'apps/api/src/routes/accommodation/admin/purge.ts',
                markers: ["administrativeAction: 'ACC_23'"]
            },
            {
                kind: 'tableGate',
                file: 'apps/api/src/routes/gastronomy/admin/purge.ts',
                markers: ["administrativeAction: 'ACC_23'"]
            },
            {
                kind: 'tableGate',
                file: 'apps/api/src/routes/experience/admin/purge.ts',
                markers: ["administrativeAction: 'ACC_23'"]
            }
        ]
    },
    ACC_24: {
        bindings: [
            {
                kind: 'required',
                file: 'apps/api/src/routes/user/admin/close-on-request.ts',
                route: 'adminAccountClosurePreviewRoute'
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/user/admin/close-on-request.ts',
                route: 'adminCloseAccountOnRequestRoute'
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/partner-application/admin/replace-email.ts',
                route: 'adminPartnerApplicationEmailReplacementPreviewRoute'
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/partner-application/admin/replace-email.ts',
                route: 'adminReplacePartnerApplicationEmailRoute'
            }
        ]
    },
    ACC_25: { unbound: 'legacy HOS-278 partner routes; V8b (HOS-1498) builds it' },
    ACC_26: {
        bindings: [
            {
                kind: 'tableGate',
                file: 'packages/service-core/src/services/user-role/super-admin-role.service.ts',
                markers: [
                    'resolveRoleAssignmentAction({ role: RoleEnum.SUPER_ADMIN })',
                    'isAdministrativeActionPermitted('
                ]
            }
        ]
    }
};

/**
 * The only row known to be out of step today, and why it is not fixed here.
 * The row says `[]` with `pendingOwnPermission` V6.9 (HOS-1479) while the two
 * deadline-change routes ask for `MAINTENANCE_MODE_WRITE` provisionally
 * (Coord-20); the real permission is B13a's debt. Tracked in HOS-1689.
 */
const KNOWN_MISALIGNED: Readonly<Partial<Record<AdministrativeAction, string>>> = {
    ACC_22: 'Row says [] with pending V6.9 (HOS-1479); both deadline-change routes ask for MAINTENANCE_MODE_WRITE provisionally (Coord-20); the real permission is B13a debt.'
};

const bindingsOf = (action: AdministrativeAction): readonly Binding[] => {
    const entry = ROUTE_BINDINGS[action];
    return 'bindings' in entry ? entry.bindings : [];
};

const collectDifferences = (action: AdministrativeAction): string[] => {
    const row = ADMINISTRATIVE_ACTION_PERMISSIONS[action];
    return bindingsOf(action)
        .map((binding) => compareBinding({ action, row, binding }))
        .filter((difference): difference is string => difference !== null);
};

const BOUND_ACTIONS: readonly AdministrativeAction[] = ADMINISTRATIVE_ACTIONS.filter(
    (action) => 'bindings' in ROUTE_BINDINGS[action]
);

const UNBOUND_ROWS: readonly { readonly action: AdministrativeAction; readonly reason: string }[] =
    ADMINISTRATIVE_ACTIONS.flatMap((action) => {
        const entry = ROUTE_BINDINGS[action];
        return 'unbound' in entry ? [{ action, reason: entry.unbound }] : [];
    });

describe('HOS-1689 — each administrative action row agrees with its route gate', () => {
    it('a. covers exactly the 25 catalog actions, in order', () => {
        expect(Object.keys(ROUTE_BINDINGS)).toEqual(ADMINISTRATIVE_ACTIONS);
        expect(Object.keys(ROUTE_BINDINGS)).toHaveLength(25);
    });

    it('b. checks exactly 29 bindings across 12 bound rows', () => {
        expect(BOUND_ACTIONS).toHaveLength(12);
        const total = BOUND_ACTIONS.reduce((count, action) => count + bindingsOf(action).length, 0);
        expect(total).toBe(29);
    });

    it.each(
        BOUND_ACTIONS.filter((action) => !(action in KNOWN_MISALIGNED))
    )('c. %s matches its route gate', (action) => {
        expect(collectDifferences(action)).toEqual([]);
    });

    it.each(
        ADMINISTRATIVE_ACTIONS.filter((action) => action in KNOWN_MISALIGNED)
    )('d. %s is still misaligned — remove its KNOWN_MISALIGNED entry only once it agrees', (action) => {
        expect(collectDifferences(action).length).toBeGreaterThan(0);
    });

    it('e. every unbound row names a reason and is not silently known-misaligned', () => {
        expect(UNBOUND_ROWS.length).toBeGreaterThan(0);
        for (const { action, reason } of UNBOUND_ROWS) {
            expect(reason.trim().length).toBeGreaterThan(0);
            expect(action in KNOWN_MISALIGNED).toBe(false);
        }
    });

    it('f. sees the ACC_11 bug it was written for, with a false row, never touching the table', () => {
        const staleRow: ActionRow = { permissions: [], pendingOwnPermission: 'x' };
        const differences = bindingsOf('ACC_11')
            .map((binding) => compareBinding({ action: 'ACC_11', row: staleRow, binding }))
            .filter((difference): difference is string => difference !== null);
        expect(differences.length).toBeGreaterThan(0);
    });
});
