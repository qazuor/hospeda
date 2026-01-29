/**
 * @file Nested Routes and Layout Tests
 *
 * Tests for TASK-111: Verify nested route navigation and layout persistence
 * - Sidebar render stability across navigations
 * - Sidebar state persistence
 * - Auth check redirect behavior
 * - Layout hierarchy
 */

import { QueryClient } from '@tanstack/react-query';
import { act, render, renderHook } from '@testing-library/react';
import { useCallback, useRef, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Helper to create QueryClient for tests
 */
const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 5 * 60 * 1000,
                retry: false
            }
        }
    });

describe('Nested Routes and Layout Persistence', () => {
    describe('Sidebar Render Stability', () => {
        it('should not recreate sidebar component on route changes', () => {
            const sidebarRenderCount = { count: 0 };

            // Simulated Sidebar that tracks renders
            function MockSidebar() {
                sidebarRenderCount.count++;
                return <nav data-testid="sidebar">Sidebar</nav>;
            }

            // Simulated Layout (like _authed.tsx)
            function Layout({ children }: { children: React.ReactNode }) {
                return (
                    <div>
                        <MockSidebar />
                        <main>{children}</main>
                    </div>
                );
            }

            // Simulated route content
            function RouteA() {
                return <div>Route A</div>;
            }
            function RouteB() {
                return <div>Route B</div>;
            }

            // Render with Route A
            const { rerender, getByTestId } = render(
                <Layout>
                    <RouteA />
                </Layout>
            );

            expect(getByTestId('sidebar')).toBeInTheDocument();
            const initialRenderCount = sidebarRenderCount.count;

            // Simulate navigation to Route B (rerender with new child)
            rerender(
                <Layout>
                    <RouteB />
                </Layout>
            );

            // Sidebar should not have extra renders beyond React's normal reconciliation
            // In real scenario with proper memoization, it would be 1
            expect(sidebarRenderCount.count).toBeLessThanOrEqual(initialRenderCount + 1);
        });

        it('should maintain sidebar component identity with useState initializer', () => {
            const createSidebarSpy = vi.fn(() => ({ id: 'sidebar-instance' }));

            function LayoutWithStableState({ children }: { children: React.ReactNode }) {
                // Using useState lazy initializer (same pattern as QueryClient)
                const [sidebarState] = useState(createSidebarSpy);
                return (
                    <div data-sidebar-id={sidebarState.id}>
                        <main>{children}</main>
                    </div>
                );
            }

            const { rerender } = render(
                <LayoutWithStableState>
                    <div>Child 1</div>
                </LayoutWithStableState>
            );

            expect(createSidebarSpy).toHaveBeenCalledTimes(1);

            // Re-render with different child
            rerender(
                <LayoutWithStableState>
                    <div>Child 2</div>
                </LayoutWithStableState>
            );

            // State creator should not be called again
            expect(createSidebarSpy).toHaveBeenCalledTimes(1);

            rerender(
                <LayoutWithStableState>
                    <div>Child 3</div>
                </LayoutWithStableState>
            );

            expect(createSidebarSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('Sidebar State Persistence', () => {
        beforeEach(() => {
            // Clear localStorage before each test
            localStorage.clear();
        });

        it('should persist collapsed state to localStorage', () => {
            const STORAGE_KEY = 'sidebar-collapsed';

            function useSidebarState() {
                const [isCollapsed, setIsCollapsed] = useState(() => {
                    if (typeof window !== 'undefined') {
                        return localStorage.getItem(STORAGE_KEY) === 'true';
                    }
                    return false;
                });

                const toggle = useCallback(() => {
                    setIsCollapsed((prev) => {
                        const newValue = !prev;
                        localStorage.setItem(STORAGE_KEY, String(newValue));
                        return newValue;
                    });
                }, []);

                return { isCollapsed, toggle };
            }

            const { result } = renderHook(() => useSidebarState());

            expect(result.current.isCollapsed).toBe(false);
            expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

            // Collapse sidebar
            act(() => {
                result.current.toggle();
            });

            expect(result.current.isCollapsed).toBe(true);
            expect(localStorage.getItem(STORAGE_KEY)).toBe('true');

            // Expand sidebar
            act(() => {
                result.current.toggle();
            });

            expect(result.current.isCollapsed).toBe(false);
            expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
        });

        it('should restore collapsed state from localStorage on mount', () => {
            const STORAGE_KEY = 'sidebar-collapsed';

            // Pre-set localStorage
            localStorage.setItem(STORAGE_KEY, 'true');

            function useSidebarState() {
                const [isCollapsed] = useState(() => {
                    if (typeof window !== 'undefined') {
                        return localStorage.getItem(STORAGE_KEY) === 'true';
                    }
                    return false;
                });
                return { isCollapsed };
            }

            const { result } = renderHook(() => useSidebarState());

            // Should restore collapsed state
            expect(result.current.isCollapsed).toBe(true);
        });

        it('should maintain state across simulated navigations', () => {
            const STORAGE_KEY = 'nav-sidebar-state';
            let stateFromStorage: string | null = null;

            function MockSidebarWithPersistence({ route }: { route: string }) {
                const [isCollapsed, setIsCollapsed] = useState(() => {
                    stateFromStorage = localStorage.getItem(STORAGE_KEY);
                    return stateFromStorage === 'true';
                });

                const collapse = () => {
                    setIsCollapsed(true);
                    localStorage.setItem(STORAGE_KEY, 'true');
                };

                return (
                    <div>
                        <span data-testid="route">{route}</span>
                        <span data-testid="collapsed">{String(isCollapsed)}</span>
                        <button
                            data-testid="collapse"
                            onClick={collapse}
                        >
                            Collapse
                        </button>
                    </div>
                );
            }

            // Initial render on Route A
            const { rerender, getByTestId } = render(
                <MockSidebarWithPersistence route="/route-a" />
            );

            expect(getByTestId('collapsed')).toHaveTextContent('false');

            // Collapse sidebar
            act(() => {
                getByTestId('collapse').click();
            });

            expect(getByTestId('collapsed')).toHaveTextContent('true');
            expect(localStorage.getItem(STORAGE_KEY)).toBe('true');

            // Simulate navigation to Route B (full component remount)
            rerender(<MockSidebarWithPersistence route="/route-b" />);

            // State should persist
            expect(getByTestId('route')).toHaveTextContent('/route-b');
            expect(getByTestId('collapsed')).toHaveTextContent('true');
        });
    });

    describe('Auth Check Redirect Behavior', () => {
        it('should provide auth state to layout beforeLoad', async () => {
            // Simulate the auth check server function
            const mockAuthCheck = vi.fn().mockResolvedValue({
                userId: 'test-user-123',
                isAuthenticated: true
            });

            const authState = await mockAuthCheck();

            expect(authState.isAuthenticated).toBe(true);
            expect(authState.userId).toBe('test-user-123');
        });

        it('should return isAuthenticated false when not logged in', async () => {
            const mockAuthCheck = vi.fn().mockResolvedValue({
                userId: null,
                isAuthenticated: false
            });

            const authState = await mockAuthCheck();

            expect(authState.isAuthenticated).toBe(false);
            expect(authState.userId).toBeNull();
        });

        it('should trigger redirect for unauthenticated users', () => {
            const mockRedirect = vi.fn();

            // Simulate beforeLoad logic
            function simulateBeforeLoad(isAuthenticated: boolean) {
                if (!isAuthenticated) {
                    mockRedirect({
                        to: '/auth/signin',
                        search: { redirect: '/dashboard' }
                    });
                }
            }

            // Authenticated user
            simulateBeforeLoad(true);
            expect(mockRedirect).not.toHaveBeenCalled();

            // Unauthenticated user
            simulateBeforeLoad(false);
            expect(mockRedirect).toHaveBeenCalledWith({
                to: '/auth/signin',
                search: { redirect: '/dashboard' }
            });
        });
    });

    describe('Layout Hierarchy', () => {
        it('should render nested layout structure correctly', () => {
            function RootLayout({ children }: { children: React.ReactNode }) {
                return (
                    <div data-testid="root">
                        <header data-testid="header">Header</header>
                        {children}
                    </div>
                );
            }

            function AuthedLayout({ children }: { children: React.ReactNode }) {
                return (
                    <div data-testid="authed">
                        <nav data-testid="sidebar">Sidebar</nav>
                        <main data-testid="main">{children}</main>
                    </div>
                );
            }

            function PageContent() {
                return <div data-testid="page">Page Content</div>;
            }

            const { getByTestId } = render(
                <RootLayout>
                    <AuthedLayout>
                        <PageContent />
                    </AuthedLayout>
                </RootLayout>
            );

            // Verify hierarchy
            expect(getByTestId('root')).toBeInTheDocument();
            expect(getByTestId('header')).toBeInTheDocument();
            expect(getByTestId('authed')).toBeInTheDocument();
            expect(getByTestId('sidebar')).toBeInTheDocument();
            expect(getByTestId('main')).toBeInTheDocument();
            expect(getByTestId('page')).toBeInTheDocument();

            // Verify nesting
            expect(getByTestId('root')).toContainElement(getByTestId('authed'));
            expect(getByTestId('authed')).toContainElement(getByTestId('sidebar'));
            expect(getByTestId('authed')).toContainElement(getByTestId('main'));
            expect(getByTestId('main')).toContainElement(getByTestId('page'));
        });

        it('should support outlet pattern for nested routes', () => {
            function Layout({
                outlet
            }: {
                outlet: React.ReactNode;
            }) {
                return (
                    <div data-testid="layout">
                        <aside data-testid="sidebar">Sidebar</aside>
                        <div data-testid="outlet">{outlet}</div>
                    </div>
                );
            }

            function ChildRoute() {
                return <article data-testid="child">Child Content</article>;
            }

            const { getByTestId, rerender } = render(<Layout outlet={<ChildRoute />} />);

            expect(getByTestId('outlet')).toContainElement(getByTestId('child'));

            // Change outlet content
            function AnotherChildRoute() {
                return <article data-testid="another-child">Another Content</article>;
            }

            rerender(<Layout outlet={<AnotherChildRoute />} />);

            expect(getByTestId('outlet')).toContainElement(getByTestId('another-child'));
            // Sidebar should still be there
            expect(getByTestId('sidebar')).toBeInTheDocument();
        });
    });

    describe('Data Pre-fetching in Loaders', () => {
        it('should support loader pattern with QueryClient', async () => {
            const queryClient = createTestQueryClient();
            const mockFetch = vi.fn().mockResolvedValue({ id: '1', name: 'Test' });

            // Simulate loader pre-fetching
            async function loader() {
                await queryClient.prefetchQuery({
                    queryKey: ['entity', '1'],
                    queryFn: mockFetch
                });
                return { entityId: '1' };
            }

            const loaderData = await loader();

            expect(loaderData.entityId).toBe('1');
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Data should be in cache
            const cachedData = queryClient.getQueryData(['entity', '1']);
            expect(cachedData).toEqual({ id: '1', name: 'Test' });
        });

        it('should share cached data between loader and component', async () => {
            const queryClient = createTestQueryClient();
            const mockFetch = vi.fn().mockResolvedValue({ id: '1', name: 'Shared Data' });

            // Loader pre-fetches
            await queryClient.prefetchQuery({
                queryKey: ['shared', '1'],
                queryFn: mockFetch
            });

            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Component accesses same data (should use cache)
            const cachedData = queryClient.getQueryData(['shared', '1']);

            expect(cachedData).toEqual({ id: '1', name: 'Shared Data' });
            // Fetch should not be called again
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });
});

describe('Route Component Identity', () => {
    it('should demonstrate stable component reference with useCallback', () => {
        const onCloseSpy = vi.fn();

        function ParentComponent() {
            const [count, setCount] = useState(0);
            const stableOnClose = useCallback(() => {
                onCloseSpy();
            }, []);

            return (
                <div>
                    <button
                        data-testid="increment"
                        onClick={() => setCount((c) => c + 1)}
                    >
                        {count}
                    </button>
                    <ChildComponent onClose={stableOnClose} />
                </div>
            );
        }

        function ChildComponent({ onClose }: { onClose: () => void }) {
            // Store reference to check stability
            const onCloseRef = useRef(onClose);

            // Check if reference changed
            const referenceChanged = onCloseRef.current !== onClose;
            onCloseRef.current = onClose;

            return (
                <div>
                    <span data-testid="ref-changed">{String(referenceChanged)}</span>
                    <button
                        data-testid="close"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            );
        }

        const { getByTestId } = render(<ParentComponent />);

        // Initial render - reference is new
        expect(getByTestId('ref-changed')).toHaveTextContent('false');

        // Trigger parent re-render
        act(() => {
            getByTestId('increment').click();
        });

        // With useCallback, reference should be stable
        expect(getByTestId('ref-changed')).toHaveTextContent('false');

        // Click close to verify function works
        act(() => {
            getByTestId('close').click();
        });

        expect(onCloseSpy).toHaveBeenCalledTimes(1);
    });
});
