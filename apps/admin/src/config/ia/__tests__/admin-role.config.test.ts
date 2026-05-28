/**
 * IA config tests for the ADMIN role (SPEC-164 T-004 / AC-4 / AC-18)
 *
 * Asserts:
 *   1. 'comercial' is absent from adminRole.mainMenu — ADMIN does not see the
 *      Comercial section in the top-level nav (AC-4).
 *   2. 'comercial' is absent from adminRole.mobile.bottomNav — ADMIN does not
 *      see the Comercial shortcut on mobile (AC-4).
 *   3. All remaining mainMenu entries are still present (regression guard).
 *   4. The boot-time AdminIAConfigSchema validation still passes after removing
 *      'comercial' from both arrays (boot-validation contract).
 *
 * Strategy:
 *   - Import adminRole directly (pure config, no side effects).
 *   - Import rawConfig + AdminIAConfigSchema to exercise the full boot validation.
 *   - Keep assertions data-driven so adding/removing future sections
 *     produces a clear, actionable failure message.
 *
 * @see apps/admin/src/config/ia/roles/admin.ts   — subject under test
 * @see apps/admin/src/config/ia/schema.ts         — AdminIAConfigSchema
 * @see SPEC-164 T-004 / AC-4 / AC-18
 */

import { describe, expect, it } from 'vitest';
import { rawConfig } from '../index';
import { adminRole } from '../roles/admin';
import { AdminIAConfigSchema } from '../schema';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Sections expected to remain in the ADMIN mainMenu after SPEC-164 T-004. */
const EXPECTED_ADMIN_MAIN_MENU = [
    'inicio',
    'catalogo',
    'editorial',
    'comunidad',
    'plataforma',
    'analisis'
] as const;

// ============================================================================
// TESTS
// ============================================================================

describe('ADMIN role IA config (SPEC-164 T-004)', () => {
    // ── 1. comercial absent from mainMenu ────────────────────────────────────

    it('mainMenu does NOT include "comercial" (AC-4)', () => {
        expect(adminRole.mainMenu).not.toContain('comercial');
    });

    // ── 2. comercial absent from mobile.bottomNav ────────────────────────────

    it('mobile.bottomNav does NOT include "comercial" (AC-4)', () => {
        expect(adminRole.mobile?.bottomNav).not.toContain('comercial');
    });

    // ── 3. Expected sections are still present ───────────────────────────────

    it('mainMenu still contains all expected non-billing sections', () => {
        for (const section of EXPECTED_ADMIN_MAIN_MENU) {
            expect(
                adminRole.mainMenu,
                `Expected section '${section}' to be in ADMIN mainMenu`
            ).toContain(section);
        }
    });

    it('mobile.bottomNav still contains all expected non-billing sections', () => {
        for (const section of EXPECTED_ADMIN_MAIN_MENU) {
            expect(
                adminRole.mobile?.bottomNav,
                `Expected section '${section}' to be in ADMIN mobile.bottomNav`
            ).toContain(section);
        }
    });

    // ── 4. mainMenu and bottomNav are in sync (boot-validation invariant) ────

    it('every bottomNav entry is present in mainMenu (schema superRefine contract)', () => {
        const mainMenuSet = new Set(adminRole.mainMenu);
        for (const entry of adminRole.mobile?.bottomNav ?? []) {
            expect(
                mainMenuSet.has(entry),
                `bottomNav entry '${entry}' is not in mainMenu — violates schema superRefine`
            ).toBe(true);
        }
    });

    // ── 5. Boot-time AdminIAConfigSchema validation passes ───────────────────

    it('full rawConfig passes AdminIAConfigSchema validation after T-004 change', () => {
        const result = AdminIAConfigSchema.safeParse(rawConfig);
        expect(
            result.success,
            result.success ? '' : JSON.stringify(result.error?.issues, null, 2)
        ).toBe(true);
    });
});
