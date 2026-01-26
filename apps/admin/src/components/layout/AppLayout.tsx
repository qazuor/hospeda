/**
 * AppLayout Component
 *
 * Main application layout with 3-level navigation:
 * - Level 1: Header with horizontal section navigation
 * - Level 2: Contextual sidebar that changes based on active section
 * - Level 3: Page tabs (rendered by individual pages)
 *
 * The layout uses URL-based navigation for state persistence across page reloads.
 */

import { SidebarProvider } from '@/contexts/sidebar-context';
import { useSectionSidebarSync } from '@/lib/sections';
import type { ReactNode } from 'react';
import { Header } from './header';
import { Sidebar } from './sidebar';

export type AppLayoutProps = {
    /**
     * React children to render inside the main content area.
     */
    readonly children: ReactNode;
};

/**
 * Internal layout component that uses sidebar context
 */
function AppLayoutInner({ children }: AppLayoutProps) {
    // Sync sidebar configuration with current route
    useSectionSidebarSync();

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Level 1: Header with section navigation */}
            <Header />

            <div className="flex min-h-[calc(100vh-3.5rem)]">
                {/* Level 2: Contextual sidebar */}
                <Sidebar />

                {/* Main content area */}
                <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">{children}</main>
            </div>
        </div>
    );
}

/**
 * AppLayout composes the application chrome for the admin panel.
 *
 * Features:
 * - Responsive design with mobile drawer support
 * - URL-based navigation state (persists on page reload)
 * - Contextual sidebar that changes based on current section
 * - Header with section navigation
 */
export const AppLayout = ({ children }: AppLayoutProps) => {
    return (
        <SidebarProvider>
            <AppLayoutInner>{children}</AppLayoutInner>
        </SidebarProvider>
    );
};
