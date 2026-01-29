/**
 * Tests for use-section hooks
 *
 * Tests the section navigation hooks:
 * 1. useCurrentSection - returns current section based on route
 * 2. useCurrentSectionId - returns current section ID
 * 3. useIsInSection - checks if current route is in a section
 * 4. useSectionSidebarSync - syncs sidebar config with route
 * 5. useCurrentSidebarConfig - returns sidebar config for current route
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Track mock state
let mockPathname = '/dashboard';
let mockParams: Record<string, string> = {};
const mockSetConfig = vi.fn();

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
    useLocation: () => ({ pathname: mockPathname }),
    useParams: () => mockParams
}));

// Mock sidebar context
vi.mock('@/contexts/sidebar-context', () => ({
    useSidebarContext: () => ({
        setConfig: mockSetConfig
    })
}));

// Mock section registry
const mockSections = new Map([
    [
        'dashboard',
        {
            id: 'dashboard',
            label: 'Dashboard',
            routes: ['/dashboard', '/dashboard/**'],
            defaultRoute: '/dashboard',
            sidebar: { title: 'Dashboard', items: [] }
        }
    ],
    [
        'content',
        {
            id: 'content',
            label: 'Content',
            routes: ['/accommodations', '/accommodations/**', '/destinations', '/destinations/**'],
            defaultRoute: '/accommodations',
            sidebar: { title: 'Content', items: [] }
        }
    ]
]);

vi.mock('@/lib/sections/section-registry', () => ({
    getSectionForPath: (path: string) => {
        if (path.startsWith('/dashboard')) return mockSections.get('dashboard');
        if (path.startsWith('/accommodations') || path.startsWith('/destinations'))
            return mockSections.get('content');
        return undefined;
    },
    getSidebarConfigForPath: (path: string, params: Record<string, string>) => {
        if (path.startsWith('/dashboard')) return { title: 'Dashboard', items: [] };
        if (path.startsWith('/accommodations'))
            return { title: `Accommodation ${params.id || 'List'}`, items: [] };
        return undefined;
    }
}));

// Import after mocks
import {
    useCurrentSection,
    useCurrentSectionId,
    useCurrentSidebarConfig,
    useIsInSection,
    useSectionSidebarSync
} from '@/lib/sections/use-section';

describe('use-section hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPathname = '/dashboard';
        mockParams = {};
    });

    describe('useCurrentSection', () => {
        it('should return section for matching path', () => {
            mockPathname = '/dashboard';

            const { result } = renderHook(() => useCurrentSection());

            expect(result.current).toBeDefined();
            expect(result.current?.id).toBe('dashboard');
        });

        it('should return section for nested path', () => {
            mockPathname = '/accommodations/123/edit';

            const { result } = renderHook(() => useCurrentSection());

            expect(result.current?.id).toBe('content');
        });

        it('should return undefined for non-matching path', () => {
            mockPathname = '/unknown';

            const { result } = renderHook(() => useCurrentSection());

            expect(result.current).toBeUndefined();
        });

        it('should update when pathname changes', () => {
            mockPathname = '/dashboard';

            const { result, rerender } = renderHook(() => useCurrentSection());
            expect(result.current?.id).toBe('dashboard');

            mockPathname = '/accommodations';
            rerender();
            expect(result.current?.id).toBe('content');
        });
    });

    describe('useCurrentSectionId', () => {
        it('should return section ID', () => {
            mockPathname = '/dashboard';

            const { result } = renderHook(() => useCurrentSectionId());

            expect(result.current).toBe('dashboard');
        });

        it('should return undefined for non-matching path', () => {
            mockPathname = '/unknown';

            const { result } = renderHook(() => useCurrentSectionId());

            expect(result.current).toBeUndefined();
        });
    });

    describe('useIsInSection', () => {
        it('should return true when in specified section', () => {
            mockPathname = '/dashboard';

            const { result } = renderHook(() => useIsInSection('dashboard'));

            expect(result.current).toBe(true);
        });

        it('should return false when not in specified section', () => {
            mockPathname = '/dashboard';

            const { result } = renderHook(() => useIsInSection('content'));

            expect(result.current).toBe(false);
        });

        it('should return false for non-existent section', () => {
            mockPathname = '/dashboard';

            const { result } = renderHook(() => useIsInSection('nonexistent'));

            expect(result.current).toBe(false);
        });
    });

    describe('useSectionSidebarSync', () => {
        it('should call setConfig on mount', () => {
            mockPathname = '/dashboard';

            renderHook(() => useSectionSidebarSync());

            expect(mockSetConfig).toHaveBeenCalledWith({
                title: 'Dashboard',
                items: []
            });
        });

        it('should call setConfig with params', () => {
            mockPathname = '/accommodations/123';
            mockParams = { id: '123' };

            renderHook(() => useSectionSidebarSync());

            expect(mockSetConfig).toHaveBeenCalledWith({
                title: 'Accommodation 123',
                items: []
            });
        });

        it('should not call setConfig for non-matching path', () => {
            mockPathname = '/unknown';

            renderHook(() => useSectionSidebarSync());

            expect(mockSetConfig).not.toHaveBeenCalled();
        });

        it('should update when pathname changes', () => {
            mockPathname = '/dashboard';

            const { rerender } = renderHook(() => useSectionSidebarSync());
            expect(mockSetConfig).toHaveBeenCalledTimes(1);

            mockPathname = '/accommodations';
            rerender();
            expect(mockSetConfig).toHaveBeenCalledTimes(2);
        });
    });

    describe('useCurrentSidebarConfig', () => {
        it('should return sidebar config for current path', () => {
            mockPathname = '/dashboard';

            const { result } = renderHook(() => useCurrentSidebarConfig());

            expect(result.current).toEqual({
                title: 'Dashboard',
                items: []
            });
        });

        it('should include params in config', () => {
            mockPathname = '/accommodations/456';
            mockParams = { id: '456' };

            const { result } = renderHook(() => useCurrentSidebarConfig());

            expect(result.current).toEqual({
                title: 'Accommodation 456',
                items: []
            });
        });

        it('should return undefined for non-matching path', () => {
            mockPathname = '/unknown';

            const { result } = renderHook(() => useCurrentSidebarConfig());

            expect(result.current).toBeUndefined();
        });

        it('should memoize result', () => {
            mockPathname = '/dashboard';

            const { result, rerender } = renderHook(() => useCurrentSidebarConfig());
            const firstResult = result.current;

            rerender();
            expect(result.current).toBe(firstResult);
        });
    });
});
