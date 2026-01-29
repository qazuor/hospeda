/**
 * Tests for section-registry.ts
 *
 * Tests the section registration and routing logic:
 * 1. Section registration
 * 2. Route pattern matching
 * 3. Section lookup by path
 */

import {
    clearSections,
    createSection,
    getAllSections,
    getSection,
    getSectionForPath,
    getSidebarConfigForPath,
    isPathInSection,
    registerSection,
    registerSections
} from '@/lib/sections/section-registry';
import type { SectionConfig } from '@/lib/sections/types';
import { beforeEach, describe, expect, it } from 'vitest';

describe('section-registry', () => {
    // Clear sections before each test
    beforeEach(() => {
        clearSections();
    });

    describe('createSection', () => {
        it('should create a section config object', () => {
            const section = createSection({
                id: 'test',
                label: 'Test',
                routes: ['/test'],
                defaultRoute: '/test',
                sidebar: { title: 'Test', items: [] }
            });

            expect(section.id).toBe('test');
            expect(section.label).toBe('Test');
            expect(section.routes).toEqual(['/test']);
            expect(section.defaultRoute).toBe('/test');
        });
    });

    describe('registerSection', () => {
        it('should register a section', () => {
            const section = createSection({
                id: 'dashboard',
                label: 'Dashboard',
                routes: ['/dashboard'],
                defaultRoute: '/dashboard',
                sidebar: { title: 'Dashboard', items: [] }
            });

            registerSection(section);

            expect(getSection('dashboard')).toEqual(section);
        });

        it('should overwrite existing section with same id', () => {
            const section1 = createSection({
                id: 'test',
                label: 'Test 1',
                routes: ['/test'],
                defaultRoute: '/test',
                sidebar: { title: 'Test 1', items: [] }
            });

            const section2 = createSection({
                id: 'test',
                label: 'Test 2',
                routes: ['/test'],
                defaultRoute: '/test',
                sidebar: { title: 'Test 2', items: [] }
            });

            registerSection(section1);
            registerSection(section2);

            expect(getSection('test')?.label).toBe('Test 2');
        });
    });

    describe('registerSections', () => {
        it('should register multiple sections at once', () => {
            const sections: SectionConfig[] = [
                createSection({
                    id: 'dashboard',
                    label: 'Dashboard',
                    routes: ['/dashboard'],
                    defaultRoute: '/dashboard',
                    sidebar: { title: 'Dashboard', items: [] }
                }),
                createSection({
                    id: 'content',
                    label: 'Content',
                    routes: ['/content'],
                    defaultRoute: '/content',
                    sidebar: { title: 'Content', items: [] }
                })
            ];

            registerSections(sections);

            expect(getSection('dashboard')).toBeDefined();
            expect(getSection('content')).toBeDefined();
            expect(getAllSections()).toHaveLength(2);
        });
    });

    describe('getSectionForPath', () => {
        beforeEach(() => {
            registerSections([
                createSection({
                    id: 'dashboard',
                    label: 'Dashboard',
                    routes: ['/dashboard', '/dashboard/**'],
                    defaultRoute: '/dashboard',
                    sidebar: { title: 'Dashboard', items: [] }
                }),
                createSection({
                    id: 'content',
                    label: 'Content',
                    routes: [
                        '/accommodations',
                        '/accommodations/**',
                        '/destinations',
                        '/destinations/**'
                    ],
                    defaultRoute: '/accommodations',
                    sidebar: { title: 'Content', items: [] }
                })
            ]);
        });

        it('should return section for exact path match', () => {
            const section = getSectionForPath('/dashboard');
            expect(section?.id).toBe('dashboard');
        });

        it('should return section for glob pattern match with **', () => {
            const section = getSectionForPath('/dashboard/overview');
            expect(section?.id).toBe('dashboard');
        });

        it('should return section for nested path', () => {
            const section = getSectionForPath('/accommodations/123/edit');
            expect(section?.id).toBe('content');
        });

        it('should return undefined for non-matching path', () => {
            const section = getSectionForPath('/unknown');
            expect(section).toBeUndefined();
        });

        it('should match multiple route patterns in same section', () => {
            expect(getSectionForPath('/accommodations')?.id).toBe('content');
            expect(getSectionForPath('/destinations')?.id).toBe('content');
        });
    });

    describe('isPathInSection', () => {
        beforeEach(() => {
            registerSection(
                createSection({
                    id: 'dashboard',
                    label: 'Dashboard',
                    routes: ['/dashboard', '/dashboard/**'],
                    defaultRoute: '/dashboard',
                    sidebar: { title: 'Dashboard', items: [] }
                })
            );
        });

        it('should return true for path in section', () => {
            expect(isPathInSection('/dashboard', 'dashboard')).toBe(true);
            expect(isPathInSection('/dashboard/settings', 'dashboard')).toBe(true);
        });

        it('should return false for path not in section', () => {
            expect(isPathInSection('/other', 'dashboard')).toBe(false);
        });

        it('should return false for non-existent section', () => {
            expect(isPathInSection('/dashboard', 'nonexistent')).toBe(false);
        });
    });

    describe('getSidebarConfigForPath', () => {
        it('should return static sidebar config', () => {
            registerSection(
                createSection({
                    id: 'dashboard',
                    label: 'Dashboard',
                    routes: ['/dashboard'],
                    defaultRoute: '/dashboard',
                    sidebar: {
                        title: 'Dashboard Title',
                        items: [{ type: 'link', id: 'home', label: 'Home', href: '/dashboard' }]
                    }
                })
            );

            const config = getSidebarConfigForPath('/dashboard');
            expect(config?.title).toBe('Dashboard Title');
            expect(config?.items).toHaveLength(1);
        });

        it('should return dynamic sidebar config with params', () => {
            registerSection(
                createSection({
                    id: 'entity',
                    label: 'Entity',
                    routes: ['/entity/**'],
                    defaultRoute: '/entity',
                    sidebar: (params) => ({
                        title: `Entity: ${params.id || 'List'}`,
                        items: []
                    })
                })
            );

            const config = getSidebarConfigForPath('/entity/123', { id: '123' });
            expect(config?.title).toBe('Entity: 123');
        });

        it('should return undefined for non-matching path', () => {
            const config = getSidebarConfigForPath('/unknown');
            expect(config).toBeUndefined();
        });
    });

    describe('clearSections', () => {
        it('should remove all registered sections', () => {
            registerSection(
                createSection({
                    id: 'test',
                    label: 'Test',
                    routes: ['/test'],
                    defaultRoute: '/test',
                    sidebar: { title: 'Test', items: [] }
                })
            );

            expect(getAllSections()).toHaveLength(1);

            clearSections();

            expect(getAllSections()).toHaveLength(0);
        });
    });

    describe('getAllSections', () => {
        it('should return all registered sections', () => {
            registerSections([
                createSection({
                    id: 'a',
                    label: 'A',
                    routes: ['/a'],
                    defaultRoute: '/a',
                    sidebar: { title: 'A', items: [] }
                }),
                createSection({
                    id: 'b',
                    label: 'B',
                    routes: ['/b'],
                    defaultRoute: '/b',
                    sidebar: { title: 'B', items: [] }
                }),
                createSection({
                    id: 'c',
                    label: 'C',
                    routes: ['/c'],
                    defaultRoute: '/c',
                    sidebar: { title: 'C', items: [] }
                })
            ]);

            const sections = getAllSections();
            expect(sections).toHaveLength(3);
            expect(sections.map((s) => s.id)).toEqual(['a', 'b', 'c']);
        });
    });
});
