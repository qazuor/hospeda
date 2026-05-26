/**
 * AppLayout Component
 *
 * Main application layout with config-driven IA navigation (SPEC-154):
 * - Level 1: Header with `MainMenu` (horizontal section nav, config-driven)
 * - Level 2: Sidebar (contextual per active section, config-driven)
 * - Level 3: Page tabs (rendered by individual pages, L3 migration is out of scope)
 * - Mobile: `BottomNav` (fixed bottom bar, hidden on md+)
 *
 * The layout uses URL-based navigation for state persistence across page reloads.
 */

import { ImpersonationBanner } from '@/components/auth/ImpersonationBanner';
import { BottomNav } from '@/components/layout/mobile-nav/BottomNav';
import { SidebarProvider } from '@/contexts/sidebar-context';
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
 * Internal layout component that consumes sidebar context.
 */
function AppLayoutInner({ children }: AppLayoutProps) {
    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Impersonation warning banner */}
            <ImpersonationBanner />

            {/* Level 1: Header with config-driven section navigation */}
            <Header />

            <div className="flex min-h-[calc(100vh-3.5rem)]">
                {/* Level 2: Contextual sidebar */}
                <Sidebar />

                {/* Main content area. Bottom padding on mobile reserves room for the
                    fixed BottomNav (md:hidden) so it never overlaps page content. */}
                <main className="min-w-0 flex-1 pb-16 md:pb-0">{children}</main>
            </div>

            {/* Mobile bottom navigation (hidden on md+) */}
            <BottomNav />
        </div>
    );
}

/**
 * AppLayout composes the application chrome for the admin panel.
 *
 * Features:
 * - Responsive design with mobile drawer support
 * - URL-based navigation state (persists on page reload)
 * - Config-driven sidebar that changes based on the active section (SPEC-154)
 * - Config-driven main menu (SPEC-154)
 * - Mobile bottom navigation via BottomNav (SPEC-154)
 */
export const AppLayout = ({ children }: AppLayoutProps) => {
    return (
        <SidebarProvider>
            <AppLayoutInner>{children}</AppLayoutInner>
        </SidebarProvider>
    );
};
