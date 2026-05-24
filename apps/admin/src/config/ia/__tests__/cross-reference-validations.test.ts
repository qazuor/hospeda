/**
 * Tests for the 7 cross-reference validations in AdminIAConfigSchema.superRefine() (T-018)
 *
 * For each of the 7 validations we:
 *   1. Assert that a fully-valid minimal config passes.
 *   2. Break exactly ONE thing and assert that safeParse fails with an issue at
 *      the expected path.
 *
 * Tests use a minimal config factory to keep each case self-contained.
 */

import { RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { AdminIAConfigSchema as Schema } from '../schema';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type ConfigInput = z.input<typeof Schema>;

// ──────────────────────────────────────────────────────────────────────────────
// Minimal valid config factory
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Returns a minimal but fully valid config typed explicitly as ConfigInput.
 *
 * Every field that the cross-reference validations check is present and
 * internally consistent so that each test can break exactly ONE thing.
 */
function makeValidConfig(): ConfigInput {
    return {
        sections: {
            sectionA: {
                id: 'sectionA',
                label: { es: 'Sección A', en: 'Section A', pt: 'Seção A' },
                icon: 'HomeIcon',
                route: '/section-a',
                sidebar: 'sidebarA'
            },
            sectionB: {
                id: 'sectionB',
                label: { es: 'Sección B', en: 'Section B', pt: 'Seção B' },
                icon: 'BookIcon',
                route: '/section-b',
                sidebar: null // no sidebar — valid
            }
        },
        sidebars: {
            sidebarA: {
                items: [
                    {
                        type: 'link' as const,
                        id: 'itemLink',
                        label: { es: 'Enlace', en: 'Link', pt: 'Link' },
                        route: '/section-a/page'
                    },
                    {
                        type: 'group' as const,
                        id: 'itemGroup',
                        label: { es: 'Grupo', en: 'Group', pt: 'Grupo' },
                        items: [
                            {
                                type: 'link' as const,
                                id: 'nestedLink',
                                label: { es: 'Anidado', en: 'Nested', pt: 'Aninhado' },
                                route: '/section-a/nested'
                            }
                        ]
                    }
                ]
            }
        },
        dashboards: {
            mainDashboard: {
                widgets: [
                    {
                        id: 'widget1',
                        type: 'kpi' as const,
                        label: { es: 'KPI', en: 'KPI', pt: 'KPI' }
                    }
                ]
            }
        },
        tabs: {
            entity1: {
                entity: 'entity1',
                tabs: [{ id: 'tab1', label: { es: 'Tab 1', en: 'Tab 1', pt: 'Tab 1' } }]
            }
        },
        createActions: {
            createFoo: {
                id: 'createFoo',
                label: { es: 'Crear Foo', en: 'Create Foo', pt: 'Criar Foo' },
                route: '/foo/new'
            }
        },
        roles: {
            [RoleEnum.HOST]: {
                enabled: true,
                label: { es: 'Anfitrión', en: 'Host', pt: 'Anfitrião' },
                mainMenu: ['sectionA', 'sectionB'],
                dashboard: 'mainDashboard',
                topbar: {
                    showSearch: false,
                    showQuickCreate: ['createFoo'] as string[],
                    accountInMenu: true
                },
                mobile: {
                    bottomNav: ['sectionA', 'sectionB'] as string[],
                    fab: 'createFoo'
                },
                labelOverrides: {
                    'sidebarA.itemLink': { es: 'Override', en: 'Override', pt: 'Override' }
                } as Record<string, { es: string; en: string; pt: string }>
            },
            [RoleEnum.SPONSOR]: {
                enabled: false,
                label: { es: 'Sponsor', en: 'Sponsor', pt: 'Patrocinador' }
            }
        }
    };
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper to get the HOST role from a mutable config
// ──────────────────────────────────────────────────────────────────────────────

function getHost(config: ConfigInput) {
    return config.roles[RoleEnum.HOST] as {
        enabled: boolean;
        label: { es: string; en: string; pt: string };
        mainMenu?: string[];
        dashboard?: string;
        topbar?: {
            showSearch: boolean;
            showQuickCreate: string[] | 'all' | null;
            accountInMenu: boolean;
        };
        mobile?: {
            bottomNav: string[] | null;
            fab: string | null;
        };
        labelOverrides?: Record<string, { es: string; en: string; pt: string }>;
    };
}

// ──────────────────────────────────────────────────────────────────────────────
// Baseline — valid config must pass
// ──────────────────────────────────────────────────────────────────────────────

describe('AdminIAConfigSchema cross-reference validations (T-018)', () => {
    it('should accept a fully valid minimal config', () => {
        const result = Schema.safeParse(makeValidConfig());
        if (!result.success) {
            // Surface the actual issues to help debug test authoring
            throw new Error(
                `Expected valid config to pass, but got:\n${result.error.issues
                    .map((i) => `  ${i.path.join('.')}: ${i.message}`)
                    .join('\n')}`
            );
        }
        expect(result.success).toBe(true);
    });

    // ── §13.1 Sidebar refs ────────────────────────────────────────────────────

    describe('§13.1 sidebar refs', () => {
        it('should fail when a section.sidebar refers to a non-existent sidebar', () => {
            const config = makeValidConfig();
            // Break: sectionA.sidebar → 'nonExistentSidebar'
            (config.sections.sectionA as { sidebar: string | null }).sidebar = 'nonExistentSidebar';

            const result = Schema.safeParse(config);
            expect(result.success).toBe(false);
            const paths = result.error?.issues.map((i) => i.path.join('.')) ?? [];
            expect(paths).toContain('sections.sectionA.sidebar');
        });

        it('should accept sections with sidebar: null (no sidebar required)', () => {
            const config = makeValidConfig();
            (config.sections.sectionA as { sidebar: string | null }).sidebar = null;
            const result = Schema.safeParse(config);
            expect(result.success).toBe(true);
        });
    });

    // ── §13.2 Role mainMenu section refs ─────────────────────────────────────

    describe('§13.2 role mainMenu section refs', () => {
        it('should fail when mainMenu references a non-existent section', () => {
            const config = makeValidConfig();
            const host = getHost(config);
            // Break: add a non-existent section to mainMenu at index 2
            host.mainMenu = ['sectionA', 'sectionB', 'doesNotExist'];

            const result = Schema.safeParse(config);
            expect(result.success).toBe(false);
            const paths = result.error?.issues.map((i) => i.path.join('.')) ?? [];
            expect(paths).toContain(`roles.${RoleEnum.HOST}.mainMenu.2`);
        });

        it('should not validate mainMenu for disabled roles', () => {
            const config = makeValidConfig();
            // SPONSOR is disabled — adding a bad mainMenu should not produce issues
            (config.roles[RoleEnum.SPONSOR] as { mainMenu?: string[] }).mainMenu = ['doesNotExist'];
            const result = Schema.safeParse(config);
            // The only issues (if any) should not be about sponsor's mainMenu
            const sponsorMainMenuIssues =
                result.error?.issues.filter((i) =>
                    i.path.join('.').includes(`${RoleEnum.SPONSOR}.mainMenu`)
                ) ?? [];
            expect(sponsorMainMenuIssues).toHaveLength(0);
        });
    });

    // ── §13.3 Role dashboard refs ─────────────────────────────────────────────

    describe('§13.3 role dashboard refs', () => {
        it('should fail when dashboard references a non-existent dashboard', () => {
            const config = makeValidConfig();
            const host = getHost(config);
            host.dashboard = 'ghostDashboard';

            const result = Schema.safeParse(config);
            expect(result.success).toBe(false);
            const paths = result.error?.issues.map((i) => i.path.join('.')) ?? [];
            expect(paths).toContain(`roles.${RoleEnum.HOST}.dashboard`);
        });
    });

    // ── §13.4 Create-action refs ──────────────────────────────────────────────

    describe('§13.4 create-action refs', () => {
        it('should fail when topbar.showQuickCreate lists a missing action', () => {
            const config = makeValidConfig();
            const host = getHost(config);
            host.topbar!.showQuickCreate = ['createFoo', 'noSuchAction'];

            const result = Schema.safeParse(config);
            expect(result.success).toBe(false);
            const paths = result.error?.issues.map((i) => i.path.join('.')) ?? [];
            expect(paths).toContain(`roles.${RoleEnum.HOST}.topbar.showQuickCreate.1`);
        });

        it('should fail when mobile.fab references a missing action', () => {
            const config = makeValidConfig();
            const host = getHost(config);
            host.mobile!.fab = 'noSuchFab';

            const result = Schema.safeParse(config);
            expect(result.success).toBe(false);
            const paths = result.error?.issues.map((i) => i.path.join('.')) ?? [];
            expect(paths).toContain(`roles.${RoleEnum.HOST}.mobile.fab`);
        });

        it('should accept showQuickCreate: "all" without checking create action IDs', () => {
            const config = makeValidConfig();
            const host = getHost(config);
            host.topbar!.showQuickCreate = 'all';
            const result = Schema.safeParse(config);
            expect(result.success).toBe(true);
        });

        it('should accept mobile.fab: null (no FAB)', () => {
            const config = makeValidConfig();
            const host = getHost(config);
            host.mobile!.fab = null;
            const result = Schema.safeParse(config);
            expect(result.success).toBe(true);
        });
    });

    // ── §13.5 mobile.bottomNav refs ──────────────────────────────────────────

    describe('§13.5 mobile.bottomNav refs', () => {
        it('should fail when bottomNav contains a section not in mainMenu', () => {
            const config = makeValidConfig();
            const host = getHost(config);
            // sectionA and sectionB are in mainMenu; 'sectionC' is not
            host.mainMenu = ['sectionA', 'sectionB'];
            host.mobile!.bottomNav = ['sectionA', 'sectionC'];

            const result = Schema.safeParse(config);
            expect(result.success).toBe(false);
            const paths = result.error?.issues.map((i) => i.path.join('.')) ?? [];
            expect(paths).toContain(`roles.${RoleEnum.HOST}.mobile.bottomNav.1`);
        });

        it('should accept bottomNav: null (hamburger-only mobile nav)', () => {
            const config = makeValidConfig();
            const host = getHost(config);
            host.mobile!.bottomNav = null;
            const result = Schema.safeParse(config);
            expect(result.success).toBe(true);
        });
    });

    // ── §13.6 labelOverrides path resolution ─────────────────────────────────

    describe('§13.6 labelOverrides paths', () => {
        it('should fail when a labelOverride key uses a non-existent sidebar', () => {
            const config = makeValidConfig();
            const host = getHost(config);
            host.labelOverrides = {
                'ghostSidebar.someItem': { es: 'X', en: 'X', pt: 'X' }
            };

            const result = Schema.safeParse(config);
            expect(result.success).toBe(false);
            const paths = result.error?.issues.map((i) => i.path.join('.')) ?? [];
            expect(paths).toContain(`roles.${RoleEnum.HOST}.labelOverrides.ghostSidebar.someItem`);
        });

        it('should fail when a labelOverride key uses an existing sidebar but missing item', () => {
            const config = makeValidConfig();
            const host = getHost(config);
            host.labelOverrides = {
                'sidebarA.nonExistentItem': { es: 'X', en: 'X', pt: 'X' }
            };

            const result = Schema.safeParse(config);
            expect(result.success).toBe(false);
            const paths = result.error?.issues.map((i) => i.path.join('.')) ?? [];
            expect(paths).toContain(
                `roles.${RoleEnum.HOST}.labelOverrides.sidebarA.nonExistentItem`
            );
        });

        it('should fail when a labelOverride uses a section-format key that does not exist', () => {
            const config = makeValidConfig();
            const host = getHost(config);
            host.labelOverrides = {
                ghostSection: { es: 'X', en: 'X', pt: 'X' }
            };

            const result = Schema.safeParse(config);
            expect(result.success).toBe(false);
            const paths = result.error?.issues.map((i) => i.path.join('.')) ?? [];
            expect(paths).toContain(`roles.${RoleEnum.HOST}.labelOverrides.ghostSection`);
        });

        it('should accept a valid sidebarId.itemId override', () => {
            const config = makeValidConfig();
            const host = getHost(config);
            host.labelOverrides = {
                'sidebarA.itemLink': { es: 'Renombrado', en: 'Renamed', pt: 'Renomeado' }
            };
            const result = Schema.safeParse(config);
            expect(result.success).toBe(true);
        });

        it('should accept a valid sidebarId.nestedItemId (group child) override', () => {
            const config = makeValidConfig();
            const host = getHost(config);
            // 'nestedLink' is inside itemGroup inside sidebarA
            host.labelOverrides = {
                'sidebarA.nestedLink': {
                    es: 'Anidado renombrado',
                    en: 'Renamed nested',
                    pt: 'Aninhado renomeado'
                }
            };
            const result = Schema.safeParse(config);
            expect(result.success).toBe(true);
        });

        it('should accept a valid sectionId override', () => {
            const config = makeValidConfig();
            const host = getHost(config);
            host.labelOverrides = {
                sectionA: { es: 'Mi sección', en: 'My section', pt: 'Minha seção' }
            };
            const result = Schema.safeParse(config);
            expect(result.success).toBe(true);
        });

        it('should not validate labelOverrides for disabled roles', () => {
            const config = makeValidConfig();
            (
                config.roles[RoleEnum.SPONSOR] as {
                    labelOverrides?: Record<string, { es: string; en: string; pt: string }>;
                }
            ).labelOverrides = { ghostPath: { es: 'X', en: 'X', pt: 'X' } };
            const result = Schema.safeParse(config);
            const sponsorOverrideIssues =
                result.error?.issues.filter((i) =>
                    i.path.join('.').includes(`${RoleEnum.SPONSOR}.labelOverrides`)
                ) ?? [];
            expect(sponsorOverrideIssues).toHaveLength(0);
        });
    });

    // ── §13.8 Unique sidebar IDs ──────────────────────────────────────────────

    describe('§13.8 unique IDs within each sidebar', () => {
        it('should fail when two top-level items share the same id', () => {
            const config = makeValidConfig();
            config.sidebars.sidebarA!.items = [
                {
                    type: 'link' as const,
                    id: 'dupId',
                    label: { es: 'A', en: 'A', pt: 'A' },
                    route: '/a'
                },
                {
                    type: 'link' as const,
                    id: 'dupId', // duplicate
                    label: { es: 'B', en: 'B', pt: 'B' },
                    route: '/b'
                }
            ];

            const result = Schema.safeParse(config);
            expect(result.success).toBe(false);
            const paths = result.error?.issues.map((i) => i.path.join('.')) ?? [];
            expect(paths).toContain('sidebars.sidebarA');
        });

        it('should fail when a nested group item duplicates a top-level id', () => {
            const config = makeValidConfig();
            config.sidebars.sidebarA!.items = [
                {
                    type: 'link' as const,
                    id: 'uniqueTop',
                    label: { es: 'Top', en: 'Top', pt: 'Top' },
                    route: '/top'
                },
                {
                    type: 'group' as const,
                    id: 'grp',
                    label: { es: 'Grupo', en: 'Group', pt: 'Grupo' },
                    items: [
                        {
                            type: 'link' as const,
                            id: 'uniqueTop', // duplicate across levels
                            label: { es: 'Nested', en: 'Nested', pt: 'Nested' },
                            route: '/nested'
                        }
                    ]
                }
            ];

            const result = Schema.safeParse(config);
            expect(result.success).toBe(false);
            const paths = result.error?.issues.map((i) => i.path.join('.')) ?? [];
            expect(paths).toContain('sidebars.sidebarA');
        });

        it('should accept sidebars where all item IDs are unique', () => {
            const config = makeValidConfig();
            // Default config already has unique IDs; just confirm
            const result = Schema.safeParse(config);
            expect(result.success).toBe(true);
        });
    });
});
