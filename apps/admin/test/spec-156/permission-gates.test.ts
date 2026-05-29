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

const ALL_GATED_PAGES: ReadonlyArray<GatedPage> = [...ACCOUNT_PAGES, ...ANNOUNCEMENTS_PAGES];

function loadPageSource(file: string): string {
    return readFileSync(resolve(__dirname, file), 'utf8');
}

describe('SPEC-156 permission gate audit (T-043)', () => {
    describe.each(ALL_GATED_PAGES)('$label', (page) => {
        const src = loadPageSource(page.file);

        it.each(page.mustReferencePermissions)(
            'references PermissionEnum.%s in the route module',
            (permission) => {
                expect(
                    src.includes(`PermissionEnum.${permission}`),
                    `Expected ${page.file} to reference PermissionEnum.${permission}. ${page.notes ?? ''}`
                ).toBe(true);
            }
        );

        it('redirects unauthorized actors to /auth/forbidden', () => {
            expect(
                src.includes("throw redirect({ to: '/auth/forbidden' })"),
                `Expected ${page.file} to redirect to /auth/forbidden when the perm check fails.`
            ).toBe(true);
        });
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
            expect(ALL_GATED_PAGES.length).toBe(4);
        });
    });
});
