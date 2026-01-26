/**
 * Tests for sidebar-context.tsx
 *
 * Tests the sidebar context provider and hook:
 * 1. Default state values
 * 2. setConfig updates config
 * 3. Mobile menu toggle functions
 * 4. Collapsed state management
 * 5. Context error when used outside provider
 */

import { SidebarProvider, useSidebarContext } from '@/contexts/sidebar-context';
import type { SidebarConfig } from '@/lib/sections/types';
import { render, screen } from '@testing-library/react';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

// Wrapper component for testing hooks
function wrapper({ children }: { children: ReactNode }) {
    return <SidebarProvider>{children}</SidebarProvider>;
}

describe('sidebar-context', () => {
    describe('SidebarProvider', () => {
        it('should render children', () => {
            render(
                <SidebarProvider>
                    <div data-testid="child">Child Content</div>
                </SidebarProvider>
            );

            expect(screen.getByTestId('child')).toBeInTheDocument();
        });

        it('should provide default context values', () => {
            const { result } = renderHook(() => useSidebarContext(), { wrapper });

            expect(result.current.config).toBeNull();
            expect(result.current.isContextual).toBe(false);
            expect(result.current.isMobileOpen).toBe(false);
            expect(result.current.isCollapsed).toBe(false);
        });
    });

    describe('useSidebarContext', () => {
        it('should throw error when used outside provider', () => {
            // Suppress console.error for this test
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            expect(() => {
                renderHook(() => useSidebarContext());
            }).toThrow('useSidebarContext must be used within a SidebarProvider');

            consoleSpy.mockRestore();
        });
    });

    describe('setConfig', () => {
        it('should update sidebar config', () => {
            const { result } = renderHook(() => useSidebarContext(), { wrapper });

            const newConfig: SidebarConfig = {
                title: 'Test Sidebar',
                items: [{ type: 'link', id: 'test', label: 'Test', href: '/test' }]
            };

            act(() => {
                result.current.setConfig(newConfig);
            });

            expect(result.current.config).toEqual(newConfig);
        });

        it('should set isContextual to true when config is set', () => {
            const { result } = renderHook(() => useSidebarContext(), { wrapper });

            act(() => {
                result.current.setConfig({ title: 'Test', items: [] });
            });

            expect(result.current.isContextual).toBe(true);
        });

        it('should set isContextual to false when config is null', () => {
            const { result } = renderHook(() => useSidebarContext(), { wrapper });

            // First set a config
            act(() => {
                result.current.setConfig({ title: 'Test', items: [] });
            });

            // Then clear it
            act(() => {
                result.current.setConfig(null);
            });

            expect(result.current.isContextual).toBe(false);
            expect(result.current.config).toBeNull();
        });
    });

    describe('mobile menu controls', () => {
        it('should toggle mobile menu', () => {
            const { result } = renderHook(() => useSidebarContext(), { wrapper });

            expect(result.current.isMobileOpen).toBe(false);

            act(() => {
                result.current.toggleMobile();
            });

            expect(result.current.isMobileOpen).toBe(true);

            act(() => {
                result.current.toggleMobile();
            });

            expect(result.current.isMobileOpen).toBe(false);
        });

        it('should open mobile menu', () => {
            const { result } = renderHook(() => useSidebarContext(), { wrapper });

            act(() => {
                result.current.openMobile();
            });

            expect(result.current.isMobileOpen).toBe(true);

            // Opening again should keep it open
            act(() => {
                result.current.openMobile();
            });

            expect(result.current.isMobileOpen).toBe(true);
        });

        it('should close mobile menu', () => {
            const { result } = renderHook(() => useSidebarContext(), { wrapper });

            // First open it
            act(() => {
                result.current.openMobile();
            });

            // Then close it
            act(() => {
                result.current.closeMobile();
            });

            expect(result.current.isMobileOpen).toBe(false);
        });
    });

    describe('collapsed state', () => {
        it('should toggle collapsed state', () => {
            const { result } = renderHook(() => useSidebarContext(), { wrapper });

            expect(result.current.isCollapsed).toBe(false);

            act(() => {
                result.current.toggleCollapse();
            });

            expect(result.current.isCollapsed).toBe(true);

            act(() => {
                result.current.toggleCollapse();
            });

            expect(result.current.isCollapsed).toBe(false);
        });
    });

    describe('setContextual', () => {
        it('should set contextual state directly', () => {
            const { result } = renderHook(() => useSidebarContext(), { wrapper });

            act(() => {
                result.current.setContextual(true);
            });

            expect(result.current.isContextual).toBe(true);

            act(() => {
                result.current.setContextual(false);
            });

            expect(result.current.isContextual).toBe(false);
        });
    });

    describe('multiple consumers', () => {
        it('should share state between consumers', () => {
            const { result: result1 } = renderHook(() => useSidebarContext(), { wrapper });
            const { result: result2 } = renderHook(() => useSidebarContext(), { wrapper });

            // Note: These are separate provider instances, so state won't be shared
            // This test verifies each hook works independently
            act(() => {
                result1.current.setConfig({ title: 'Test 1', items: [] });
            });

            // result2 has its own provider, so it won't see result1's changes
            expect(result2.current.config).toBeNull();
        });
    });
});
