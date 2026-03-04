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

import { ImpersonationBanner } from '@/components/auth/ImpersonationBanner';
import { SidebarProvider } from '@/contexts/sidebar-context';
import { useUserPermissions } from '@/hooks/use-user-permissions';
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
    // Get real user permissions from AuthContext
    const userPermissions = useUserPermissions();

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Impersonation warning banner */}
            <ImpersonationBanner />

            {/* Level 1: Header with section navigation */}
            <Header userPermissions={userPermissions} />

            <div className="flex min-h-[calc(100vh-3.5rem)]">
                {/* Level 2: Contextual sidebar with real permissions */}
                <Sidebar userPermissions={userPermissions} />

                {/* Main content area */}
                <main className="min-w-0 flex-1">{children}</main>
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
