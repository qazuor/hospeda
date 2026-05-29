/**
 * @file account-billing.test.ts
 * @description Source-based tests for the Mi facturación landing page added
 * in SPEC-156 PR-4 (T-033). Covers route registration, permission gate
 * (AC-23 — BILLING_VIEW_OWN + SUBSCRIPTION_VIEW_OWN), section placeholders
 * waiting for T-034/T-036/T-037, and the matching sidebar item.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const billingSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/account/billing.tsx'),
    'utf8'
);

const sidebarsSrc = readFileSync(resolve(__dirname, '../../src/config/ia/sidebars.ts'), 'utf8');

describe('account/billing.tsx (T-033)', () => {
    it('registers the new route path', () => {
        expect(billingSrc).toContain("createFileRoute('/_authed/account/billing')");
    });

    describe('permission gate (AC-23)', () => {
        it('requires BILLING_VIEW_OWN', () => {
            expect(billingSrc).toContain('PermissionEnum.BILLING_VIEW_OWN');
        });

        it('also requires SUBSCRIPTION_VIEW_OWN', () => {
            expect(billingSrc).toContain('PermissionEnum.SUBSCRIPTION_VIEW_OWN');
        });

        it('redirects to /auth/forbidden when either permission is missing', () => {
            expect(billingSrc).toContain("throw redirect({ to: '/auth/forbidden' })");
        });

        it('uses && (AND) so missing either perm still hides the page', () => {
            // The gate must be conjunctive — the spec requires BOTH perms.
            // Mirrors the sidebar permission AND-evaluation.
            expect(billingSrc).toMatch(/BILLING_VIEW_OWN[\s\S]+?&&[\s\S]+?SUBSCRIPTION_VIEW_OWN/);
        });
    });

    describe('wired sections (T-034 / T-036 / T-037)', () => {
        it('mounts the SubscriptionSummarySection (T-034)', () => {
            expect(billingSrc).toContain('SubscriptionSummarySection');
        });

        it('mounts the PlanUsageSection (T-036)', () => {
            expect(billingSrc).toContain('PlanUsageSection');
        });

        it('mounts the BillingActionsSection (T-037)', () => {
            expect(billingSrc).toContain('BillingActionsSection');
        });
    });
});

describe('miCuentaSidebar — mi-facturacion entry (T-033)', () => {
    it('includes a /account/billing link gated by BILLING_VIEW_OWN + SUBSCRIPTION_VIEW_OWN', () => {
        // Source-based assertion to keep this test independent from the
        // sidebar runtime registry. The block contains both permission
        // strings and the new route path.
        expect(sidebarsSrc).toMatch(
            /id:\s*['"]mi-facturacion['"][\s\S]+?route:\s*['"]\/account\/billing['"]/
        );
        expect(sidebarsSrc).toMatch(
            /id:\s*['"]mi-facturacion['"][\s\S]+?'BILLING_VIEW_OWN',\s*'SUBSCRIPTION_VIEW_OWN'/
        );
    });

    it('uses onMissing: hide so non-paying roles do not see the item at all', () => {
        expect(sidebarsSrc).toMatch(
            /id:\s*['"]mi-facturacion['"][\s\S]+?onMissing:\s*['"]hide['"]/
        );
    });
});
