/**
 * Tests for billing plans i18n keys — T-015
 *
 * Verifies that:
 * - All required plans.* keys are present in all three locales (es/en/pt).
 * - The updated keys no longer reference "source code" or "read-only" copy.
 * - The description key reflects edit-enabled copy (mentions audit log).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Resolve i18n locale files relative to the monorepo root.
// createRequire/relative imports can fail in Vite's ESM context when crossing
// package boundaries without a registered path alias.
const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../../../../../..');
const i18nBase = path.join(repoRoot, 'packages/i18n/src/locales');

// biome-ignore lint/suspicious/noExplicitAny: JSON locale loaded at runtime
const esAdminBilling: any = JSON.parse(
    readFileSync(path.join(i18nBase, 'es/admin-billing.json'), 'utf8')
);
// biome-ignore lint/suspicious/noExplicitAny: JSON locale loaded at runtime
const enAdminBilling: any = JSON.parse(
    readFileSync(path.join(i18nBase, 'en/admin-billing.json'), 'utf8')
);
// biome-ignore lint/suspicious/noExplicitAny: JSON locale loaded at runtime
const ptAdminBilling: any = JSON.parse(
    readFileSync(path.join(i18nBase, 'pt/admin-billing.json'), 'utf8')
);

/** Shared subset of keys that must exist in all locales */
const REQUIRED_PLAN_KEYS = [
    'title',
    'description',
    'apiRequired',
    'confirmActivate',
    'confirmDeactivate',
    'confirmDelete',
    'apiLoadError',
    'staticFallback',
    'noteLabel',
    'apiUnavailable',
    'allCategories',
    'categoryOwner',
    'categoryComplex',
    'categoryTourist',
    'createPlan',
    'statusActive',
    'statusInactive',
    'statusDefault',
    'actionActivate',
    'actionDeactivate',
    'actionEdit',
    'actionDelete'
] as const;

type PlanKeys = (typeof REQUIRED_PLAN_KEYS)[number];

// biome-ignore lint/suspicious/noExplicitAny: JSON locale files typed as any
const locales: [string, { plans: Record<string, any> }][] = [
    ['es', esAdminBilling],
    ['en', enAdminBilling],
    ['pt', ptAdminBilling]
];

describe('admin-billing i18n — T-015 (plans.* keys present and edit-enabled)', () => {
    describe('Key presence across all locales', () => {
        for (const [locale, file] of locales) {
            it(`should have a "plans" section in the ${locale} locale`, () => {
                expect(file).toHaveProperty('plans');
                expect(typeof file.plans).toBe('object');
            });

            for (const key of REQUIRED_PLAN_KEYS) {
                it(`[${locale}] plans.${key} should exist and be a non-empty string`, () => {
                    const plans = file.plans as Record<PlanKeys, string>;
                    expect(plans).toHaveProperty(key);
                    expect(typeof plans[key]).toBe('string');
                    expect(plans[key].trim().length).toBeGreaterThan(0);
                });
            }
        }
    });

    describe('Edit-enabled copy — no stale "read-only / source code" verbiage', () => {
        const stalePatterns = [
            /source code/i,
            /read-only/i,
            /solo lectura/i,
            /somente leitura/i,
            /codigo fonte/i,
            /plans\.config\.ts/i
        ];

        const editableKeys: PlanKeys[] = ['description', 'apiRequired', 'apiUnavailable'];

        for (const [locale, file] of locales) {
            for (const key of editableKeys) {
                for (const pattern of stalePatterns) {
                    it(`[${locale}] plans.${key} should NOT contain stale "${pattern.source}" copy`, () => {
                        const plans = file.plans as Record<PlanKeys, string>;
                        expect(plans[key]).not.toMatch(pattern);
                    });
                }
            }
        }
    });

    describe('Audit log hint present in updated keys', () => {
        const auditKeywords: Record<string, RegExp> = {
            es: /auditoría|audit/i,
            en: /audit/i,
            pt: /auditoria|audit/i
        };

        it('es: plans.description should mention audit', () => {
            expect(esAdminBilling.plans.description).toMatch(auditKeywords.es);
        });

        it('en: plans.description should mention audit', () => {
            expect(enAdminBilling.plans.description).toMatch(auditKeywords.en);
        });

        it('pt: plans.description should mention audit', () => {
            expect(ptAdminBilling.plans.description).toMatch(auditKeywords.pt);
        });
    });
});
