/**
 * Sidebar Context
 *
 * Manages the state of the contextual sidebar (Level 2 navigation).
 * The sidebar content changes based on the active section.
 */

import type { SidebarConfig, SidebarContextState } from '@/lib/sections/types';
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Context value with state and actions
 */
interface SidebarContextValue extends SidebarContextState {
    /** Set the sidebar configuration */
    setConfig: (config: SidebarConfig | null) => void;
    /** Toggle mobile drawer */
    toggleMobile: () => void;
    /** Open mobile drawer */
    openMobile: () => void;
    /** Close mobile drawer */
    closeMobile: () => void;
    /** Toggle sidebar collapse (desktop) */
    toggleCollapse: () => void;
    /** Set contextual mode */
    setContextual: (isContextual: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

/**
 * Local storage key for sidebar preferences
 */
const STORAGE_KEY = 'admin-sidebar-v2';

/**
 * Get stored preferences
 */
function getStoredPreferences(): { isCollapsed: boolean } {
    if (typeof window === 'undefined') {
        return { isCollapsed: false };
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch {
        // Ignore parse errors
    }

    return { isCollapsed: false };
}

/**
 * Store preferences
 */
function storePreferences(prefs: { isCollapsed: boolean }): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
        // Ignore storage errors
    }
}

interface SidebarProviderProps {
    children: ReactNode;
}

/**
 * Sidebar Context Provider
 *
 * Wraps the application and provides sidebar state management.
 * Should be placed inside the router context but outside the main layout.
 */
export function SidebarProvider({ children }: SidebarProviderProps) {
    const [state, setState] = useState<SidebarContextState>(() => {
        const stored = getStoredPreferences();
        return {
            config: null,
            isContextual: false,
            isCollapsed: stored.isCollapsed,
            isMobileOpen: false
        };
    });

    const setConfig = useCallback((config: SidebarConfig | null) => {
        setState((prev) => ({
            ...prev,
            config,
            isContextual: config !== null
        }));
    }, []);

    const toggleMobile = useCallback(() => {
        setState((prev) => ({
            ...prev,
            isMobileOpen: !prev.isMobileOpen
        }));
    }, []);

    const openMobile = useCallback(() => {
        setState((prev) => ({
            ...prev,
            isMobileOpen: true
        }));
    }, []);

    const closeMobile = useCallback(() => {
        setState((prev) => ({
            ...prev,
            isMobileOpen: false
        }));
    }, []);

    const toggleCollapse = useCallback(() => {
        setState((prev) => {
            const newCollapsed = !prev.isCollapsed;
            storePreferences({ isCollapsed: newCollapsed });
            return {
                ...prev,
                isCollapsed: newCollapsed
            };
        });
    }, []);

    const setContextual = useCallback((isContextual: boolean) => {
        setState((prev) => ({
            ...prev,
            isContextual
        }));
    }, []);

    const value = useMemo<SidebarContextValue>(
        () => ({
            ...state,
            setConfig,
            toggleMobile,
            openMobile,
            closeMobile,
            toggleCollapse,
            setContextual
        }),
        [state, setConfig, toggleMobile, openMobile, closeMobile, toggleCollapse, setContextual]
    );

    return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

/**
 * Hook to access sidebar context
 *
 * @throws Error if used outside SidebarProvider
 */
export function useSidebarContext(): SidebarContextValue {
    const context = useContext(SidebarContext);

    if (!context) {
        throw new Error('useSidebarContext must be used within a SidebarProvider');
    }

    return context;
}

/**
 * Hook to get sidebar configuration
 * Convenient shorthand for accessing just the config
 */
export function useSidebarConfig(): SidebarConfig | null {
    const { config } = useSidebarContext();
    return config;
}

/**
 * Hook to set sidebar configuration
 * Convenient shorthand for setting the config
 */
export function useSetSidebarConfig(): (config: SidebarConfig | null) => void {
    const { setConfig } = useSidebarContext();
    return setConfig;
}

/**
 * Hook to check if sidebar is showing contextual content
 */
export function useIsSidebarContextual(): boolean {
    const { isContextual } = useSidebarContext();
    return isContextual;
}

export { SidebarContext };
