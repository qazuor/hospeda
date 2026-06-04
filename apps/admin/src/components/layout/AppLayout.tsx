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
import { WhatsNewAutoTrigger } from '@/components/whats-new/WhatsNewAutoTrigger';
import { WhatsNewDashboardController } from '@/components/whats-new/WhatsNewDashboardController';
import { SidebarProvider } from '@/contexts/sidebar-context';
import { TourProvider } from '@/contexts/tour-context';
import { WidgetActionHandlersProvider } from '@/contexts/widget-action-handlers-context';
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
            {/* Sticky chrome: the impersonation banner (when active) stacks
                above the header inside a single sticky container, so the two
                never overlap at top-0 on scroll (BETA-79). The banner and
                header are no longer individually sticky. */}
            <div className="sticky top-0 z-50">
                {/* Impersonation warning banner */}
                <ImpersonationBanner />

                {/* Level 1: Header with config-driven section navigation */}
                <Header />
            </div>

            <div className="flex min-h-[calc(100vh-3.5rem)]">
                {/* Level 2: Contextual sidebar */}
                <Sidebar />

                {/* Main content area. Bottom padding on mobile reserves room for the
                    fixed BottomNav (md:hidden) so it never overlaps page content. */}
                <main className="min-w-0 flex-1 pb-16 md:pb-0">{children}</main>
            </div>

            {/* Mobile bottom navigation (hidden on md+) */}
            <BottomNav />

            {/*
             * What's New auto-trigger (SPEC-175 §7.6 / T-014).
             * Headless — renders null until unseen highlight entries are found,
             * then opens WhatsNewModal once. Mounted here (inside the authed area)
             * so `useWhatsNew()` always has an authenticated user.
             *
             * D17 seam: pass `suppressed={tourStillPending}` from SPEC-174's
             * welcome-tour component when it lands. Do NOT wire tour awareness here
             * now — leave `suppressed` at its default (false) until SPEC-174 ships.
             */}
            <WhatsNewAutoTrigger />
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
            {/*
             * WidgetActionHandlersProvider enables dashboard widgets to fire named
             * actions (e.g. 'whats-new-panel') without holding function references
             * in their serializable config. WhatsNewDashboardController registers
             * its handlers on mount (SPEC-175 T-017).
             *
             * TourProvider (SPEC-174 T-010) is mounted here, inside the auth/query/i18n
             * providers (guaranteed by being inside the _authed route tree) but above the
             * page content so useTour() is available everywhere in the admin shell.
             * Auto-trigger (TourAutoTrigger) will be wired in T-013.
             */}
            <WidgetActionHandlersProvider>
                <TourProvider>
                    <AppLayoutInner>{children}</AppLayoutInner>
                    {/* Registers 'whats-new-panel' + 'whats-new-entry' action handlers. */}
                    <WhatsNewDashboardController />
                </TourProvider>
            </WidgetActionHandlersProvider>
        </SidebarProvider>
    );
};
