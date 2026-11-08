/** HOS-1689: shared catalog rows, route bindings and comparators for the administrative-action route-permission guards. */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PermissionEnum } from '@repo/schemas';
import {
    ADMINISTRATIVE_ACTION_PERMISSIONS,
    ADMINISTRATIVE_ACTIONS,
    type AdministrativeAction
} from '@repo/verticals';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const partnerApplicationResolutionBinding = (decision: 'approve' | 'reject') => ({
    kind: 'required' as const,
    file: `apps/api/src/routes/partner-application/admin/${decision}.ts`,
    route: `admin${decision === 'approve' ? 'Approve' : 'Reject'}PartnerApplicationRoute`
});

/** Strip comments before matching route permission literals. */
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
/** One catalog row: the permissions it declares and the own permission it still pends. */
export type ActionRow = {
    readonly permissions: readonly PermissionEnum[];
    readonly pendingOwnPermission: string | null;
};
/** How one route enforces or bypasses an administrative action's permission. */
export type Binding =
    | { readonly kind: 'required'; readonly file: string; readonly route: string }
    | { readonly kind: 'anyOf'; readonly file: string; readonly route: string }
    | { readonly kind: 'ownershipBypass'; readonly file: string; readonly route: string }
    | { readonly kind: 'tableGate'; readonly file: string; readonly markers: readonly string[] };
const action6File = 'apps/api/src/routes/partners/admin/billing-setup.ts';
const action6Binding = (route: string): Binding => ({ kind: 'required', file: action6File, route });
const action6Bindings: readonly Binding[] = [
    'adminPreviewPartnerBillingSetupRoute',
    'adminConfigurePartnerBillingRoute'
].map(action6Binding);
const manualBinding = (route: string, late = false): Binding => ({
    kind: 'required',
    file: `apps/api/src/routes/billing-subscription/admin/manual-payment${late ? '-late' : ''}.ts`,
    route
});
const pauseFile = 'apps/api/src/routes/billing-subscription/admin/pause.ts';
const pauseBinding = (route: string): Binding => ({ kind: 'required', file: pauseFile, route });
const grantBinding = (file: string, route: string): Binding => ({
    kind: 'required',
    file: `apps/api/src/routes/billing-permanent-grant/admin/${file}.ts`,
    route
});
const courtesyBinding: Binding = {
    kind: 'required',
    file: 'apps/api/src/routes/billing-subscription/admin/courtesy.ts',
    route: 'adminRevokeCourtesyRoute'
};
/** A catalog action that maps to one or more concrete route bindings. */
export type BoundEntry = { readonly bindings: readonly Binding[] };
/** A catalog action that no route binds yet, with the reason it stays unbound. */
export type UnboundEntry = { readonly unbound: string };
/** Compare a binding with its catalog row; missing exports fail closed. */
export const compareBinding = (args: {
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
export const ROUTE_BINDINGS: Readonly<Record<AdministrativeAction, BoundEntry | UnboundEntry>> = {
    // biome-ignore format: keep the closed route fixture below 500 lines.
    ACC_1: { bindings: [courtesyBinding, { kind: 'required', file: 'apps/api/src/routes/billing-subscription/admin/courtesy-grant.ts', route: 'adminCourtesyGrantPreviewRoute' }, { kind: 'required', file: 'apps/api/src/routes/billing-subscription/admin/courtesy-grant.ts', route: 'adminGrantCourtesyRoute' }, { kind: 'required', file: 'apps/api/src/routes/billing-subscription/admin/courtesy-revoke-preview.ts', route: 'adminCourtesyRevokePreviewRoute' }] },
    ACC_2: {
        bindings: [
            grantBinding('grant', 'adminGrantPermanentGrantRoute'),
            grantBinding('anchor', 'adminAnchorPermanentGrantRoute'),
            grantBinding('revocation', 'adminRevokePermanentGrantRoute'),
            grantBinding('grant-preview', 'adminPreviewPermanentGrantRoute'),
            grantBinding('anchor-preview', 'adminPreviewPermanentGrantAnchorRoute'),
            grantBinding('revocation', 'adminPermanentGrantRevocationPreviewRoute'),
            grantBinding('live', 'adminLivePermanentGrantRoute')
        ]
    },
    ACC_3: {
        bindings: [
            {
                kind: 'required',
                file: 'apps/api/src/routes/partners/admin/manual-payment.ts',
                route: 'adminManualPaymentRoute'
            },
            manualBinding('adminManualPaymentRegistrationPreviewRoute'),
            manualBinding('adminRegisterManualPaymentRoute'),
            manualBinding('adminLateManualPaymentPreviewRoute', true),
            manualBinding('adminRegisterLateManualPaymentRoute', true),
            manualBinding('adminUnallocatedManualPaymentPreviewRoute', true),
            manualBinding('adminRegisterUnallocatedManualPaymentRoute', true)
        ]
    },
    ACC_4: {
        bindings: [
            manualBinding('adminManualUnpaidPreviewRoute'),
            manualBinding('adminDeclareManualUnpaidRoute')
        ]
    },
    ACC_5: {
        bindings: [
            {
                kind: 'required',
                file: 'apps/api/src/routes/partner-application/admin/cancel-wait.ts',
                route: 'adminCancelPartnerApplicationWaitRoute'
            },
            partnerApplicationResolutionBinding('approve'),
            partnerApplicationResolutionBinding('reject')
        ]
    },
    ACC_6: { bindings: action6Bindings },
    ACC_7: {
        bindings: [
            {
                kind: 'required',
                file: 'apps/api/src/routes/billing-reconciliation/admin/lift-mark.ts',
                route: 'adminLiftReconciliationMarkRoute'
            }
        ]
    },
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
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/billing-subscription/admin/cancellation.ts',
                route: 'adminSubscriptionCancellationPreviewRoute'
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/billing-subscription/admin/cancellation.ts',
                route: 'adminCancelSubscriptionRoute'
            }
        ]
    },
    // biome-ignore format: keep the closed route fixture below 500 lines.
    ACC_9: { bindings: [pauseBinding('adminSubscriptionPausePreviewRoute'), pauseBinding('adminPauseSubscriptionRoute'), pauseBinding('adminResumeSubscriptionRoute')] },
    // biome-ignore format: keep the closed route fixture below 500 lines.
    ACC_10: { bindings: [{ kind: 'required', file: 'apps/api/src/routes/billing-subscription/admin/plan-change.ts', route: 'adminPlanChangeRoute' }] },
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
                file: 'apps/api/src/routes/venue/admin/moderate.ts',
                route: 'adminModerateVenueRoute'
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/experience/admin/moderate.ts',
                route: 'adminModerateExperienceRoute'
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/partners/admin/presence-moderation.ts',
                route: 'adminModeratePartnerPresenceRoute'
            }
        ]
    },
    ACC_13: {
        bindings: [
            {
                kind: 'required',
                file: 'apps/api/src/routes/billing-refund/admin/confirm.ts',
                route: 'adminConfirmRefundRoute'
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/billing-refund/admin/decline.ts',
                route: 'adminDeclineRefundRoute'
            }
        ]
    },
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
                file: 'apps/api/src/routes/venue/admin/create.ts',
                route: 'adminCreateVenueRoute'
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
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/plan-catalog/admin/index.ts',
                route: 'adminReadPlanCatalogRoute'
            }
        ]
    },
    ACC_19: {
        bindings: [
            {
                kind: 'required',
                file: 'apps/api/src/routes/billing-price/admin/index.ts',
                route: 'adminPreviewCyclePriceRoute'
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/billing-price/admin/index.ts',
                route: 'adminSetCyclePriceRoute'
            }
        ]
    },
    ACC_20: {
        bindings: [
            {
                kind: 'required',
                file: 'apps/api/src/routes/billing-addon-product/admin/index.ts',
                route: 'adminPreviewAddonVersionPublicationRoute'
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/billing-addon-product/admin/index.ts',
                route: 'adminPublishAddonVersionRoute'
            }
        ]
    },
    ACC_21: {
        bindings: [
            {
                kind: 'required',
                file: 'apps/api/src/routes/billing-promo/admin/list.ts',
                route: 'adminListPromoCodesRoute'
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/billing-promo/admin/create.ts',
                route: 'adminCreatePromoCodeRoute'
            },
            {
                kind: 'required',
                file: 'apps/api/src/routes/billing-promo/admin/close.ts',
                route: 'adminClosePromoCodeRoute'
            }
        ]
    },
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
                file: 'apps/api/src/routes/venue/admin/purge.ts',
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
    ACC_25: {
        bindings: [
            {
                kind: 'required',
                file: 'apps/api/src/routes/partners/admin/empty-presence.ts',
                route: 'adminEmptyPartnerPresenceRoute'
            }
        ]
    },
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

/** HOS-1479: the deadline-change routes still use a provisional permission. */
export const KNOWN_MISALIGNED: Readonly<Partial<Record<AdministrativeAction, string>>> = {
    ACC_22: 'Row says [] with pending V6.9 (HOS-1479); both deadline-change routes ask for MAINTENANCE_MODE_WRITE provisionally (Coord-20); the real permission is B13a debt.'
};

/** The shared argument shape of the action-level guard helpers. */
type ActionArgument = { readonly action: AdministrativeAction };

/** The route bindings of an action; unbound rows yield an empty list. */
export const bindingsOf = ({ action }: ActionArgument): readonly Binding[] => {
    const entry = ROUTE_BINDINGS[action];
    return 'bindings' in entry ? entry.bindings : [];
};

/** Every binding of an action that disagrees with its catalog row. */
export const collectDifferences = ({ action }: ActionArgument): string[] => {
    const row = ADMINISTRATIVE_ACTION_PERMISSIONS[action];
    return bindingsOf({ action })
        .map((binding) => compareBinding({ action, row, binding }))
        .filter((difference): difference is string => difference !== null);
};

/** Catalog actions that have at least one route binding. */
export const BOUND_ACTIONS: readonly AdministrativeAction[] = ADMINISTRATIVE_ACTIONS.filter(
    (action) => 'bindings' in ROUTE_BINDINGS[action]
);

/** Catalog actions with no route binding, paired with the reason. */
export const UNBOUND_ROWS: readonly {
    readonly action: AdministrativeAction;
    readonly reason: string;
}[] = ADMINISTRATIVE_ACTIONS.flatMap((action) => {
    const entry = ROUTE_BINDINGS[action];
    return 'unbound' in entry ? [{ action, reason: entry.unbound }] : [];
});
