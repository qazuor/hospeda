/**
 * @file permission-gates.test.ts
 * @description Cross-cutting automated audit (SPEC-156 PR-4 T-043 / AC-22 / AC-23).
 *
 * Every new or relocated page introduced by SPEC-156 must enforce the
 * permission gate documented in the spec. This test introspects each page
 * source (no mocking, no rendering) and asserts:
 *
 *   1. The matching `PermissionEnum.<NAME>` is referenced in beforeLoad.
 *   2. The unauthorized branch redirects to `/auth/forbidden`.
 *
 * Source-based assertions keep this fast (no React tree, no router setup)
 * and resilient — a future refactor that drops a gate will trip the test
 * before reaching review.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface GatedPage {
    readonly label: string;
    readonly file: string;
    readonly mustReferencePermissions: ReadonlyArray<string>;
    readonly notes?: string;
    /**
     * When the route delegates to a shared guard helper (instead of inlining
     * the `beforeLoad` check), set `viaHelper` to the helper module path so
     * the test reads the helper source for the permission + redirect
     * assertions, and additionally asserts the route file imports + uses the
     * helper.
     */
    readonly viaHelper?: {
        readonly importPath: string;
        readonly functionName: string;
        readonly file: string;
    };
}

const ADMIN_SRC_ROOT = '../../src/routes/_authed';

const ACCOUNT_PAGES: ReadonlyArray<GatedPage> = [
    {
        label: '/account/billing — Mi facturación landing (AC-23)',
        file: `${ADMIN_SRC_ROOT}/account/billing.tsx`,
        mustReferencePermissions: ['BILLING_VIEW_OWN', 'SUBSCRIPTION_VIEW_OWN']
    }
];

const ANNOUNCEMENTS_PAGES: ReadonlyArray<GatedPage> = [
    {
        label: '/platform/critical/announcements — list (T-038)',
        file: `${ADMIN_SRC_ROOT}/platform/critical/announcements/index.tsx`,
        mustReferencePermissions: ['MAINTENANCE_MODE_WRITE']
    },
    {
        label: '/platform/critical/announcements/new — create (T-039)',
        file: `${ADMIN_SRC_ROOT}/platform/critical/announcements/new.tsx`,
        mustReferencePermissions: ['MAINTENANCE_MODE_WRITE']
    },
    {
        label: '/platform/critical/announcements/$id/edit — edit (T-040)',
        file: `${ADMIN_SRC_ROOT}/platform/critical/announcements/$id_.edit.tsx`,
        mustReferencePermissions: ['MAINTENANCE_MODE_WRITE']
    }
];

const CRITICAL_PAGES: ReadonlyArray<GatedPage> = [
    {
        label: '/platform/critical — landing (post-PR-4 follow-up)',
        file: `${ADMIN_SRC_ROOT}/platform/critical/index.tsx`,
        mustReferencePermissions: ['SYSTEM_MAINTENANCE_MODE'],
        notes: 'Sidebar onMissing:hide only hides the link; the route itself must beforeLoad-gate so direct URL access is blocked too.'
    }
];

/**
 * Pages that gate on the generic admin-API helper (`requireAdminApiAccess`),
 * which checks `ACCESS_API_ADMIN`. These are ops / email infrastructure
 * pages — non-billing routes that previously reused `requireBillingAccess`
 * by mistake and over-restricted to SUPER_ADMIN. See post-PR-4 smoke
 * sign-off (PR #1305) for the discovery context.
 *
 * The roster MUST reference `ACCESS_API_ADMIN` so any future swap to a
 * different (or more restrictive) helper trips this audit before review.
 */
const ADMIN_API_HELPER = {
    importPath: '@/lib/admin-api-access',
    functionName: 'requireAdminApiAccess',
    file: '../../src/lib/admin-api-access.ts'
} as const;

const ADMIN_API_PAGES: ReadonlyArray<GatedPage> = [
    {
        label: '/platform/ops/cron — cron jobs list',
        file: `${ADMIN_SRC_ROOT}/platform/ops/cron.tsx`,
        mustReferencePermissions: ['ACCESS_API_ADMIN'],
        notes: 'Used to gate on BILLING_READ_ALL by mistake; swapped to the admin-api helper so ADMIN can reach it per checklist.',
        viaHelper: ADMIN_API_HELPER
    },
    {
        label: '/platform/ops/webhooks — webhook deliveries',
        file: `${ADMIN_SRC_ROOT}/platform/ops/webhooks.tsx`,
        mustReferencePermissions: ['ACCESS_API_ADMIN'],
        viaHelper: ADMIN_API_HELPER
    },
    {
        label: '/platform/email/logs — email/notification history',
        file: `${ADMIN_SRC_ROOT}/platform/email/logs.tsx`,
        mustReferencePermissions: ['ACCESS_API_ADMIN'],
        viaHelper: ADMIN_API_HELPER
    },
    {
        label: '/platform/configuration/seo — SEO defaults editor',
        file: `${ADMIN_SRC_ROOT}/platform/configuration/seo.tsx`,
        mustReferencePermissions: ['ACCESS_API_ADMIN'],
        notes: 'Page had no beforeLoad guard at all; HOST could open it via direct URL. Added requireAdminApiAccess so the gate is consistent with the other platform routes.',
        viaHelper: ADMIN_API_HELPER
    },
    {
        label: '/platform/cache/revalidation — ISR revalidation panel',
        file: `${ADMIN_SRC_ROOT}/platform/cache/revalidation/index.tsx`,
        mustReferencePermissions: ['ACCESS_API_ADMIN'],
        notes: 'Page only had a client-side RoutePermissionGuard (which redirected HOST to /dashboard, not /auth/forbidden). Added server-side beforeLoad as defense-in-depth and to normalize the forbidden UX.',
        viaHelper: ADMIN_API_HELPER
    },
    {
        label: '/platform/tags/internal — internal tag list',
        file: `${ADMIN_SRC_ROOT}/platform/tags/internal/index.tsx`,
        mustReferencePermissions: ['ACCESS_API_ADMIN'],
        notes: 'Same as cache/revalidation: only the client-side guard existed; added server-side beforeLoad for parity.',
        viaHelper: ADMIN_API_HELPER
    },
    {
        label: '/platform/tags/system — system tag list',
        file: `${ADMIN_SRC_ROOT}/platform/tags/system/index.tsx`,
        mustReferencePermissions: ['ACCESS_API_ADMIN'],
        notes: 'Client-side guard checked TAG_SYSTEM_VIEW which is granted to HOST in the seed (likely intentional for tag pickers elsewhere), so HOST was reaching the admin CRUD page anyway. Added server-side beforeLoad on ACCESS_API_ADMIN to block HOST regardless of the granular grant.',
        viaHelper: ADMIN_API_HELPER
    }
];

const ALL_GATED_PAGES: ReadonlyArray<GatedPage> = [
    ...ACCOUNT_PAGES,
    ...ANNOUNCEMENTS_PAGES,
    ...CRITICAL_PAGES,
    ...ADMIN_API_PAGES
];

function loadPageSource(file: string): string {
    return readFileSync(resolve(__dirname, file), 'utf8');
}

describe('SPEC-156 permission gate audit (T-043)', () => {
    describe.each(ALL_GATED_PAGES)('$label', (page) => {
        const routeSrc = loadPageSource(page.file);
        // When a helper gates the route, the permission + redirect assertions
        // run against the helper source. The route file is still asserted to
        // import and invoke the helper so the indirection cannot silently
        // detach.
        const guardSrc = page.viaHelper ? loadPageSource(page.viaHelper.file) : routeSrc;

        it.each(page.mustReferencePermissions)(
            'references PermissionEnum.%s in the gating module',
            (permission) => {
                expect(
                    guardSrc.includes(`PermissionEnum.${permission}`),
                    `Expected ${page.viaHelper ? page.viaHelper.file : page.file} to reference PermissionEnum.${permission}. ${page.notes ?? ''}`
                ).toBe(true);
            }
        );

        it('redirects unauthorized actors to /auth/forbidden', () => {
            expect(
                guardSrc.includes("throw redirect({ to: '/auth/forbidden' })"),
                `Expected ${page.viaHelper ? page.viaHelper.file : page.file} to redirect to /auth/forbidden when the perm check fails.`
            ).toBe(true);
        });

        if (page.viaHelper) {
            const { importPath, functionName } = page.viaHelper;
            it(`imports and invokes ${functionName} from ${importPath}`, () => {
                expect(
                    routeSrc.includes(`from '${importPath}'`),
                    `Expected ${page.file} to import from ${importPath}.`
                ).toBe(true);
                expect(
                    routeSrc.includes(`${functionName}(context)`),
                    `Expected ${page.file} to call ${functionName}(context) inside beforeLoad.`
                ).toBe(true);
            });
        }
    });

    describe('AC-23 — Mi facturación requires BOTH new perms together', () => {
        const src = loadPageSource(`${ADMIN_SRC_ROOT}/account/billing.tsx`);

        it('gates on BILLING_VIEW_OWN && SUBSCRIPTION_VIEW_OWN (not OR)', () => {
            // Conjunctive check so EDITOR (with neither) and any future role
            // with only one of the two perms is excluded.
            expect(
                src.match(/BILLING_VIEW_OWN[\s\S]+?&&[\s\S]+?SUBSCRIPTION_VIEW_OWN/)
            ).not.toBeNull();
        });
    });

    describe('Coverage roster', () => {
        it('audits all SPEC-156 PR-4 routes that introduce new beforeLoad gates', () => {
            // Defensive checksum so any future task adds itself to the
            // ALL_GATED_PAGES roster instead of silently being skipped.
            expect(ALL_GATED_PAGES.length).toBe(12);
        });
    });
});
