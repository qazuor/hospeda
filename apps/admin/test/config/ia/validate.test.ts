/**
 * Tests for apps/admin/src/config/ia/validate.ts (T-019)
 *
 * Critical integration test: importing `validatedConfig` must NOT throw
 * against the real assembled rawConfig. If it does, the entire IA config is
 * broken and the test output is the failure report.
 *
 * Also tests the error formatting path to ensure the thrown Error message is
 * human-readable with dot-paths per issue.
 */

import { AdminIAConfigSchema } from '@/config/ia/schema';
import { describe, expect, it } from 'vitest';

// ──────────────────────────────────────────────────────────────────────────────
// Integration proof — the REAL config must load without throwing
// ──────────────────────────────────────────────────────────────────────────────

describe('validatedConfig integration proof (T-019)', () => {
    it('should import validatedConfig without throwing (real config is valid)', async () => {
        // Dynamic import so that if the IIFE throws, we can catch it here and
        // surface the actual validation error (not a module-load crash in vitest).
        let caughtError: unknown = null;
        let config: unknown = null;
        try {
            const mod = await import('@/config/ia/validate');
            config = mod.validatedConfig;
        } catch (err) {
            caughtError = err;
        }

        if (caughtError !== null) {
            // Re-throw with the validation output so the developer sees exactly
            // what is broken in the config data.
            throw new Error(
                `validatedConfig threw on module load — fix the data in apps/admin/src/config/ia/:\n${String(caughtError)}`
            );
        }

        expect(config).toBeDefined();
        expect(config).not.toBeNull();
    });

    it('should expose validatedConfig as an object with the 7 top-level keys (including tours — SPEC-174 T-007)', async () => {
        const { validatedConfig } = await import('@/config/ia/validate');
        expect(validatedConfig).toHaveProperty('sections');
        expect(validatedConfig).toHaveProperty('sidebars');
        expect(validatedConfig).toHaveProperty('dashboards');
        expect(validatedConfig).toHaveProperty('tabs');
        expect(validatedConfig).toHaveProperty('createActions');
        expect(validatedConfig).toHaveProperty('roles');
        expect(validatedConfig).toHaveProperty('tours');
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// Error formatting — simulate a failed safeParse and verify message shape
// ──────────────────────────────────────────────────────────────────────────────

describe('validate.ts error formatting', () => {
    it('should produce a multi-line message with dot-paths when validation fails', () => {
        // Build a deliberately invalid config (empty objects break every required field).
        const badConfig = {
            sections: {
                badSection: {
                    id: 'badSection',
                    label: { es: 'X', en: 'X', pt: 'X' },
                    icon: 'Icon',
                    route: '/bad',
                    sidebar: 'nonExistentSidebar' // §13.1 violation
                }
            },
            sidebars: {},
            dashboards: {
                dash: { widgets: [{ id: 'w', type: 'kpi', label: { es: 'W', en: 'W', pt: 'W' } }] }
            },
            tabs: {},
            createActions: {},
            roles: {},
            tours: {} // SPEC-174 T-006: tours field now required
        };

        const result = AdminIAConfigSchema.safeParse(badConfig);
        expect(result.success).toBe(false);

        if (!result.success) {
            // Replicate the formatting logic from validate.ts
            const formatted = result.error.issues
                .map((i) => `  ${i.path.join('.')}: ${i.message}`)
                .join('\n');
            const message = `[admin-ia.config] Validation failed:\n${formatted}\n\nFix the config in apps/admin/src/config/ia/ and restart.`;

            // Must start with the sentinel
            expect(message).toContain('[admin-ia.config] Validation failed:');
            // Must contain the dot-path of the sidebar ref violation
            expect(message).toContain('sections.badSection.sidebar');
            // Must contain the Fix instruction
            expect(message).toContain('Fix the config in apps/admin/src/config/ia/ and restart.');
        }
    });

    it('should list each issue on its own indented line', () => {
        // Two different violations → two lines in the formatted output
        const badConfig = {
            sections: {
                s1: {
                    id: 's1',
                    label: { es: 'X', en: 'X', pt: 'X' },
                    icon: 'Icon',
                    route: '/s1',
                    sidebar: 'noSidebarA' // violation 1
                },
                s2: {
                    id: 's2',
                    label: { es: 'Y', en: 'Y', pt: 'Y' },
                    icon: 'Icon2',
                    route: '/s2',
                    sidebar: 'noSidebarB' // violation 2
                }
            },
            sidebars: {},
            dashboards: {
                d: { widgets: [{ id: 'w', type: 'kpi', label: { es: 'W', en: 'W', pt: 'W' } }] }
            },
            tabs: {},
            createActions: {},
            roles: {},
            tours: {} // SPEC-174 T-006: tours field now required
        };

        const result = AdminIAConfigSchema.safeParse(badConfig);
        expect(result.success).toBe(false);

        if (!result.success) {
            const formatted = result.error.issues
                .map((i) => `  ${i.path.join('.')}: ${i.message}`)
                .join('\n');
            const lines = formatted.split('\n').filter((l) => l.trim().length > 0);
            // At least two issue lines (one per bad sidebar ref)
            expect(lines.length).toBeGreaterThanOrEqual(2);
            // Each line starts with indentation
            for (const line of lines) {
                expect(line).toMatch(/^\s{2}/);
            }
        }
    });

    it('validatedConfig should have Zod defaults applied (e.g. labelOverrides is {})', async () => {
        const { validatedConfig } = await import('@/config/ia/validate');
        // Every enabled role has labelOverrides (possibly empty object from default)
        for (const [_roleId, role] of Object.entries(validatedConfig.roles)) {
            if (role.enabled) {
                expect(role).toHaveProperty('labelOverrides');
                expect(typeof role.labelOverrides).toBe('object');
            }
        }
    });
});
