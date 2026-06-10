/**
 * IA config tests for comercialSidebar (SPEC-164 T-005 / AC-6 / AC-7 / AC-18)
 *
 * Asserts:
 *   1. Every group item in comercialSidebar carries `onMissing: 'hide'` — so an
 *      ADMIN who navigates directly to a /billing/* URL sees an empty sidebar,
 *      not a greyed-out one (AC-6).
 *   2. Every link item in comercialSidebar (both top-level and nested) carries
 *      `onMissing: 'hide'` (AC-6).
 *   3. `billing-cron` gates on `BILLING_READ_ALL`, NOT `ACCESS_PANEL_ADMIN` (AC-7).
 *   4. `billing-settings` gates on `BILLING_READ_ALL`, NOT `ACCESS_PANEL_ADMIN` (AC-7).
 *   5. Separator items are untouched — they carry no permissions or onMissing.
 *   6. The full rawConfig still passes AdminIAConfigSchema validation after T-005
 *      changes (boot-validation contract / AC-18).
 *
 * Strategy:
 *   - Import `sidebars` (registry export from sidebars.ts) to access comercialSidebar
 *     as-input (before Zod defaults are applied), then also validate via rawConfig.
 *   - Use helper functions to flatten items so new groups/links are caught automatically.
 *
 * @see apps/admin/src/config/ia/sidebars.ts — subject under test
 * @see apps/admin/src/config/ia/schema.ts   — SidebarSchema, AdminIAConfigSchema
 * @see SPEC-164 T-005 / AC-6 / AC-7 / AC-18
 */

import { describe, expect, it } from 'vitest';
import { rawConfig } from '../index';
import { AdminIAConfigSchema } from '../schema';
import { sidebars } from '../sidebars';

// ============================================================================
// HELPERS
// ============================================================================

type RawItem = {
    type: string;
    id: string;
    onMissing?: string;
    permissions?: string[];
    items?: RawItem[];
};

/**
 * Returns all `link` and `group` items from a sidebar's item tree (flat list).
 * Descends into group children. Skips `separator` items (they have no permissions
 * or onMissing by design).
 */
function collectPermissionedItems(items: RawItem[]): RawItem[] {
    const result: RawItem[] = [];
    for (const item of items) {
        if (item.type === 'separator') continue;
        result.push(item);
        if (item.type === 'group' && item.items) {
            result.push(...collectPermissionedItems(item.items));
        }
    }
    return result;
}

// ============================================================================
// SETUP
// ============================================================================

const comercialItems = sidebars.comercialSidebar?.items as RawItem[] | undefined;

// ============================================================================
// TESTS
// ============================================================================

describe('comercialSidebar IA config (SPEC-164 T-005)', () => {
    it('comercialSidebar is registered in the sidebars registry', () => {
        expect(sidebars).toHaveProperty('comercialSidebar');
        expect(comercialItems).toBeDefined();
    });

    // ── 1 & 2. All permissioned items carry onMissing: 'hide' ────────────────

    it('every group and link item carries onMissing: "hide" (AC-6)', () => {
        if (!comercialItems) throw new Error('comercialSidebar items not found');
        const permissionedItems = collectPermissionedItems(comercialItems);
        const violations: string[] = [];
        for (const item of permissionedItems) {
            if (item.onMissing !== 'hide') {
                violations.push(
                    `item '${item.id}' (type: '${item.type}') has onMissing: '${item.onMissing ?? 'undefined (defaults to disable)'}'`
                );
            }
        }
        expect(
            violations,
            `Items missing onMissing: 'hide':\n${violations.join('\n')}`
        ).toHaveLength(0);
    });

    // ── 3. cron moved out of comercial into the platform sidebar (SPEC-161 UX) ──

    it('cron is no longer in comercial and lives in platform gated on SYSTEM_MAINTENANCE_MODE', () => {
        if (!comercialItems) throw new Error('comercialSidebar items not found');
        // The scheduled-tasks page is global ops, not billing — it must not be in comercial.
        const inComercial = collectPermissionedItems(comercialItems).find(
            (item) => item.id === 'billing-cron' || item.id === 'platform-cron'
        );
        expect(inComercial, 'cron link should no longer be in comercialSidebar').toBeUndefined();

        // It now lives in the platform sidebar, gated on SYSTEM_MAINTENANCE_MODE.
        const platformItems = sidebars.plataformaSidebar?.items as RawItem[] | undefined;
        if (!platformItems) throw new Error('plataformaSidebar items not found');
        const platformCron = collectPermissionedItems(platformItems).find(
            (item) => item.id === 'platform-cron'
        );
        expect(platformCron, 'platform-cron not found in plataformaSidebar').toBeDefined();
        expect(platformCron?.permissions).toContain('SYSTEM_MAINTENANCE_MODE');
    });

    // ── 4. billing-settings re-gated to BILLING_READ_ALL ─────────────────────

    it('billing-settings gates on BILLING_READ_ALL (not ACCESS_PANEL_ADMIN) (AC-7)', () => {
        if (!comercialItems) throw new Error('comercialSidebar items not found');
        const allItems = collectPermissionedItems(comercialItems);
        const billingSettings = allItems.find((item) => item.id === 'billing-settings');
        expect(
            billingSettings,
            'billing-settings item not found in comercialSidebar'
        ).toBeDefined();
        expect(billingSettings?.permissions).toContain('BILLING_READ_ALL');
        expect(billingSettings?.permissions).not.toContain('ACCESS_PANEL_ADMIN');
    });

    // ── 5. Separator items are untouched ──────────────────────────────────────

    it('separator items carry no onMissing or permissions (untouched)', () => {
        if (!comercialItems) throw new Error('comercialSidebar items not found');
        const separators = comercialItems.filter((item) => item.type === 'separator');
        expect(
            separators.length,
            'Expected at least one separator in comercialSidebar'
        ).toBeGreaterThan(0);
        for (const sep of separators) {
            expect('onMissing' in sep, `separator '${sep.id}' should not have onMissing`).toBe(
                false
            );
            expect('permissions' in sep, `separator '${sep.id}' should not have permissions`).toBe(
                false
            );
        }
    });

    // ── 6. Boot-time AdminIAConfigSchema validation passes ───────────────────

    it('full rawConfig passes AdminIAConfigSchema validation after T-005 change', () => {
        const result = AdminIAConfigSchema.safeParse(rawConfig);
        expect(
            result.success,
            result.success ? '' : JSON.stringify(result.error?.issues, null, 2)
        ).toBe(true);
    });
});
