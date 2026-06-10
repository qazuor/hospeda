/**
 * Tests for AdminIAConfigSchema tour cross-checks §T1, §T2, §T3 (SPEC-174 T-006)
 * and the v1 welcome tour catalog (SPEC-174 T-007).
 *
 * Coverage:
 *
 * T-006 — cross-checks:
 *   §T1: Unknown data-tour target fails.
 *   §T1: Section-prefix target with non-existent section id fails.
 *   §T1: Section-prefix target with existing section id passes.
 *   §T1: Static KNOWN_DATA_TOUR_IDS targets pass.
 *   §T1: 'center' target always passes (not validated against known ids).
 *   §T2: Tour targeting a disabled role fails.
 *   §T2: Tour targeting an unknown role fails.
 *   §T2: Tour with roles 'all' always passes.
 *   §T2: Tour with valid enabled roles passes.
 *   §T3: Contextual tour route not matching any section fails.
 *   §T3: Contextual tour route matching section.route passes.
 *   §T3: Contextual tour route matching section.defaultRoute passes.
 *   §T3: Welcome tours (no route) are not affected by §T3.
 *
 * T-007 — welcome tour catalog:
 *   Full rawConfig parses successfully with the tour catalog wired in.
 *   Each enabled role (HOST, EDITOR, ADMIN, SUPER_ADMIN) has exactly one
 *     welcome tour in the catalog.
 *   No disabled role (SPONSOR, CLIENT_MANAGER) has a welcome tour.
 *   Every step target in every welcome tour passes §T1 (all center or known ids).
 *
 * @see apps/admin/src/config/ia/schema.ts — §T1/§T2/§T3 superRefine
 * @see apps/admin/src/config/ia/tours.ts  — v1 welcome tour catalog
 * @see SPEC-174 §7.1, §9
 */

import { rawConfig } from '@/config/ia/index';
import { AdminIAConfigSchema } from '@/config/ia/schema';
import { KNOWN_DATA_TOUR_IDS, type TourRole } from '@/config/ia/tour.schema';
import { tours } from '@/config/ia/tours';
import { RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

// ──────────────────────────────────────────────────────────────────────────────
// Minimal valid config factory (with tours field)
// ──────────────────────────────────────────────────────────────────────────────

type ConfigInput = z.input<typeof AdminIAConfigSchema>;

/**
 * Returns a minimal valid config with two sections, one enabled HOST role,
 * and an empty tours catalog. Each test overrides exactly the relevant piece.
 */
function makeValidConfig(): ConfigInput {
    return {
        sections: {
            // NOTE: section IDs use lowercase kebab-compatible names so that
            // data-tour:main-menu-section-<id> targets pass the regex constraint.
            // Real section IDs (misAlojamientos, sectionA, etc.) use camelCase
            // but the regex only validates the full string before the §T1 cross-check
            // strips the prefix and looks up the suffix in config.sections.
            // In this minimal config we use a purely-lowercase ID to test the prefix path.
            catalogo: {
                id: 'catalogo',
                label: { es: 'Catálogo', en: 'Catalog', pt: 'Catálogo' },
                icon: 'HomeIcon',
                route: '/section-a',
                sidebar: null
            },
            editorial: {
                id: 'editorial',
                label: { es: 'Editorial', en: 'Editorial', pt: 'Editorial' },
                icon: 'BookIcon',
                route: '/section-b',
                defaultRoute: '/section-b/dashboard',
                sidebar: null
            }
        },
        sidebars: {},
        dashboards: {
            mainDashboard: {
                widgets: [
                    {
                        id: 'w1',
                        type: 'kpi' as const,
                        label: { es: 'KPI', en: 'KPI', pt: 'KPI' }
                    }
                ]
            }
        },
        tabs: {},
        createActions: {},
        roles: {
            [RoleEnum.HOST]: {
                enabled: true,
                label: { es: 'Anfitrión', en: 'Host', pt: 'Anfitrião' },
                mainMenu: ['catalogo', 'editorial'],
                dashboard: 'mainDashboard',
                topbar: { showSearch: false, showQuickCreate: null, accountInMenu: true },
                mobile: { bottomNav: ['catalogo', 'editorial'] as string[], fab: null }
            },
            [RoleEnum.SPONSOR]: {
                enabled: false,
                label: { es: 'Sponsor', en: 'Sponsor', pt: 'Patrocinador' }
            }
        },
        tours: {}
    };
}

/**
 * Builds a minimal welcome step to avoid repeating the full structure.
 */
function makeStep(id: string, target = 'center') {
    return {
        id,
        target,
        title: { es: `${id} es`, en: `${id} en`, pt: `${id} pt` },
        body: { es: `${id} body es`, en: `${id} body en`, pt: `${id} body pt` }
    };
}

/**
 * Builds a minimal welcome tour for the given role(s).
 *
 * `roles` accepts `TourRole[]` (typed enum values) or `'all'`.
 * We pass `string[]` in some negative-path tests to deliberately trigger §T2
 * failures — those callers cast via `as unknown` to bypass the type guard.
 */
function makeWelcomeTour(
    id: string,
    roles: TourRole[] | 'all',
    steps: ReturnType<typeof makeStep>[] = [makeStep('greeting')]
) {
    return {
        id,
        roles,
        kind: 'welcome' as const,
        version: 1,
        trigger: 'auto-first-visit' as const,
        showWelcomeModal: true,
        steps
    };
}

/**
 * Builds a minimal contextual tour for the given role(s) and route.
 *
 * See `makeWelcomeTour` for notes on the `roles` parameter typing.
 */
function makeContextualTour(id: string, roles: TourRole[] | 'all', route: string) {
    return {
        id,
        roles,
        kind: 'contextual' as const,
        route,
        version: 1,
        trigger: 'auto-first-visit' as const,
        showWelcomeModal: false,
        steps: [makeStep('step1', 'data-tour:main-menu')]
    };
}

// ──────────────────────────────────────────────────────────────────────────────
// §T1 — Tour step target validation
// ──────────────────────────────────────────────────────────────────────────────

describe('AdminIAConfigSchema §T1 — tour step target validation (SPEC-174 T-006)', () => {
    it("accepts 'center' target (always valid, not checked against known ids)", () => {
        const config = makeValidConfig();
        config.tours = {
            'test.tour': makeWelcomeTour('test.tour', ['HOST'], [makeStep('step1', 'center')])
        };
        const result = AdminIAConfigSchema.safeParse(config);
        expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    });

    it('accepts a static KNOWN_DATA_TOUR_IDS target (main-menu)', () => {
        const config = makeValidConfig();
        config.tours = {
            'test.tour': makeWelcomeTour(
                'test.tour',
                ['HOST'],
                [makeStep('step1', 'data-tour:main-menu')]
            )
        };
        const result = AdminIAConfigSchema.safeParse(config);
        expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    });

    it('accepts a section-prefix target when the section exists (main-menu-section-catalogo)', () => {
        const config = makeValidConfig();
        config.tours = {
            'test.tour': makeWelcomeTour(
                'test.tour',
                ['HOST'],
                [makeStep('step1', 'data-tour:main-menu-section-catalogo')]
            )
        };
        const result = AdminIAConfigSchema.safeParse(config);
        expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    });

    it('rejects an unknown data-tour target (not in KNOWN_DATA_TOUR_IDS and no prefix match)', () => {
        const config = makeValidConfig();
        config.tours = {
            'test.tour': makeWelcomeTour(
                'test.tour',
                ['HOST'],
                [makeStep('step1', 'data-tour:unknown-target')]
            )
        };
        const result = AdminIAConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
        const paths = result.error?.issues.map((i) => i.path.join('.')) ?? [];
        expect(paths.some((p) => p.includes('tours') && p.includes('target'))).toBe(true);
    });

    it('rejects a section-prefix target when the section id does not exist', () => {
        const config = makeValidConfig();
        config.tours = {
            'test.tour': makeWelcomeTour(
                'test.tour',
                ['HOST'],
                [makeStep('step1', 'data-tour:main-menu-section-nonexistent')]
            )
        };
        const result = AdminIAConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
        const paths = result.error?.issues.map((i) => i.path.join('.')) ?? [];
        expect(paths.some((p) => p.includes('tours') && p.includes('target'))).toBe(true);
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// §T2 — Tour role existence and enabled check
// ──────────────────────────────────────────────────────────────────────────────

describe('AdminIAConfigSchema §T2 — tour role validation (SPEC-174 T-006)', () => {
    it("accepts roles: 'all' without checking individual roles", () => {
        const config = makeValidConfig();
        config.tours = {
            'test.tour': makeWelcomeTour('test.tour', 'all')
        };
        const result = AdminIAConfigSchema.safeParse(config);
        expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    });

    it('accepts a tour targeting a valid enabled role', () => {
        const config = makeValidConfig();
        config.tours = {
            'test.tour': makeWelcomeTour('test.tour', ['HOST'])
        };
        const result = AdminIAConfigSchema.safeParse(config);
        expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    });

    it('rejects a tour targeting a role not present in config.roles', () => {
        const config = makeValidConfig();
        // ADMIN is a valid TourRole but not in the minimal config.roles
        config.tours = {
            'test.tour': makeWelcomeTour('test.tour', ['ADMIN'])
        };
        const result = AdminIAConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
        const paths = result.error?.issues.map((i) => i.path.join('.')) ?? [];
        expect(paths.some((p) => p.includes('tours') && p.includes('roles'))).toBe(true);
    });

    it('rejects a tour targeting a disabled role (SPONSOR)', () => {
        const config = makeValidConfig();
        // SPONSOR is not a valid TourRole — TourRoleSchema only allows
        // HOST/EDITOR/ADMIN/SUPER_ADMIN. Cast to bypass the compile-time check
        // so Zod can reject it at runtime (testing the schema boundary).
        const sponsorAsTourRole = 'SPONSOR' as unknown as TourRole;
        config.tours = {
            'test.tour': makeWelcomeTour('test.tour', [sponsorAsTourRole])
        };
        const result = AdminIAConfigSchema.safeParse(config);
        // TourSchema rejects SPONSOR at the TourRoleSchema level (not a valid TourRole).
        // This failure may appear as a Zod schema error (invalid_enum_value) or
        // a superRefine error depending on parse order — both mean it fails.
        expect(result.success).toBe(false);
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// §T3 — Contextual tour route validation
// ──────────────────────────────────────────────────────────────────────────────

describe('AdminIAConfigSchema §T3 — contextual tour route validation (SPEC-174 T-006)', () => {
    it('accepts a contextual tour whose route matches section.route', () => {
        const config = makeValidConfig();
        config.tours = {
            'test.ctx': makeContextualTour('test.ctx', ['HOST'], '/section-a')
        };
        const result = AdminIAConfigSchema.safeParse(config);
        expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    });

    it('accepts a contextual tour whose route matches section.defaultRoute', () => {
        const config = makeValidConfig();
        // editorial has defaultRoute: '/section-b/dashboard'
        config.tours = {
            'test.ctx': makeContextualTour('test.ctx', ['HOST'], '/section-b/dashboard')
        };
        const result = AdminIAConfigSchema.safeParse(config);
        expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    });

    it('rejects a contextual tour whose route does not match any section route', () => {
        const config = makeValidConfig();
        config.tours = {
            'test.ctx': makeContextualTour('test.ctx', ['HOST'], '/totally-unknown-route')
        };
        const result = AdminIAConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
        const paths = result.error?.issues.map((i) => i.path.join('.')) ?? [];
        expect(paths.some((p) => p.includes('tours') && p.includes('route'))).toBe(true);
    });

    it('does NOT apply §T3 to welcome tours (no route field)', () => {
        const config = makeValidConfig();
        config.tours = {
            'test.welcome': makeWelcomeTour('test.welcome', ['HOST'])
        };
        const result = AdminIAConfigSchema.safeParse(config);
        expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// T-007 — Welcome tour catalog (tours.ts) integration
// ──────────────────────────────────────────────────────────────────────────────

describe('Welcome tour catalog (SPEC-174 T-007)', () => {
    it('full rawConfig with tour catalog parses successfully', () => {
        const result = AdminIAConfigSchema.safeParse(rawConfig);
        expect(
            result.success,
            result.success ? '' : JSON.stringify(result.error?.issues, null, 2)
        ).toBe(true);
    });

    it('each enabled role has exactly one welcome tour in the catalog', () => {
        const enabledRoles = [RoleEnum.HOST, RoleEnum.EDITOR, RoleEnum.ADMIN, RoleEnum.SUPER_ADMIN];

        for (const role of enabledRoles) {
            const welcomeToursForRole = Object.values(tours).filter((t) => {
                if (t.kind !== 'welcome') return false;
                // t.roles is TourRole[] (inferred from the catalog — no 'all' is used).
                // RoleEnum values overlap with TourRole string values for the 4 enabled roles,
                // so casting to readonly string[] for the includes() call is safe here.
                return (t.roles as readonly string[]).includes(role as string);
            });
            expect(
                welcomeToursForRole,
                `Expected exactly 1 welcome tour for role '${role}', found ${welcomeToursForRole.length}`
            ).toHaveLength(1);
        }
    });

    it('no disabled role (SPONSOR, CLIENT_MANAGER) has a welcome tour', () => {
        const disabledRoles = [RoleEnum.SPONSOR, RoleEnum.CLIENT_MANAGER];

        for (const role of disabledRoles) {
            const welcomeToursForRole = Object.values(tours).filter(
                (t) =>
                    t.kind === 'welcome' &&
                    Array.isArray(t.roles) &&
                    (t.roles as readonly string[]).includes(role as string)
            );
            expect(
                welcomeToursForRole,
                `Expected no welcome tour for disabled role '${role}'`
            ).toHaveLength(0);
        }
    });

    it('all welcome tour step targets are center or in KNOWN_DATA_TOUR_IDS', () => {
        const welcomeTours = Object.values(tours).filter((t) => t.kind === 'welcome');

        for (const tour of welcomeTours) {
            for (const step of tour.steps) {
                if (step.target === 'center') continue;

                // Strip 'data-tour:' prefix
                const rawId = step.target.slice('data-tour:'.length);
                expect(
                    KNOWN_DATA_TOUR_IDS.has(rawId),
                    `Tour '${tour.id}' step '${step.id}': target '${step.target}' (id '${rawId}') is not in KNOWN_DATA_TOUR_IDS`
                ).toBe(true);
            }
        }
    });

    it('all welcome tours have version 1', () => {
        const welcomeTours = Object.values(tours).filter((t) => t.kind === 'welcome');
        for (const tour of welcomeTours) {
            expect(tour.version, `Tour '${tour.id}' should have version 1`).toBe(1);
        }
    });

    it('all welcome tours have trigger auto-first-visit and showWelcomeModal true', () => {
        const welcomeTours = Object.values(tours).filter((t) => t.kind === 'welcome');
        for (const tour of welcomeTours) {
            expect(tour.trigger, `Tour '${tour.id}' should use auto-first-visit trigger`).toBe(
                'auto-first-visit'
            );
            expect(
                tour.showWelcomeModal,
                `Tour '${tour.id}' should have showWelcomeModal: true`
            ).toBe(true);
        }
    });

    it('all welcome tours have at least 4 steps (greeting + nav + dashboard + closing)', () => {
        const welcomeTours = Object.values(tours).filter((t) => t.kind === 'welcome');
        for (const tour of welcomeTours) {
            expect(
                tour.steps.length,
                `Tour '${tour.id}' should have at least 4 steps, got ${tour.steps.length}`
            ).toBeGreaterThanOrEqual(4);
        }
    });

    it('all welcome tour steps have es, en, and pt labels', () => {
        const welcomeTours = Object.values(tours).filter((t) => t.kind === 'welcome');
        for (const tour of welcomeTours) {
            for (const step of tour.steps) {
                expect(
                    step.title.es,
                    `Tour '${tour.id}' step '${step.id}' missing es title`
                ).toBeTruthy();
                expect(
                    step.title.en,
                    `Tour '${tour.id}' step '${step.id}' missing en title`
                ).toBeTruthy();
                expect(
                    step.title.pt,
                    `Tour '${tour.id}' step '${step.id}' missing pt title`
                ).toBeTruthy();
                expect(
                    step.body.es,
                    `Tour '${tour.id}' step '${step.id}' missing es body`
                ).toBeTruthy();
                expect(
                    step.body.en,
                    `Tour '${tour.id}' step '${step.id}' missing en body`
                ).toBeTruthy();
                expect(
                    step.body.pt,
                    `Tour '${tour.id}' step '${step.id}' missing pt body`
                ).toBeTruthy();
            }
        }
    });

    it('welcome tours have no route (kind welcome constraint)', () => {
        const welcomeTours = Object.values(tours).filter((t) => t.kind === 'welcome');
        for (const tour of welcomeTours) {
            expect(
                (tour as { route?: string }).route,
                `Tour '${tour.id}' is kind 'welcome' and must not have a route`
            ).toBeUndefined();
        }
    });
});
