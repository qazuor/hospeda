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
import { TourAutoTrigger } from '@/components/tour/TourAutoTrigger';
import { WhatsNewAutoTrigger } from '@/components/whats-new/WhatsNewAutoTrigger';
import { WhatsNewDashboardController } from '@/components/whats-new/WhatsNewDashboardController';
import { SidebarProvider } from '@/contexts/sidebar-context';
import { TourProvider } from '@/contexts/tour-context';
import { WidgetActionHandlersProvider } from '@/contexts/widget-action-handlers-context';
import { useWelcomeTourPending } from '@/hooks/use-tours';
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
 * Internal layout component that consumes sidebar context and tour pending state.
 *
 * Reads `welcomeTourPending` to pass the D12 suppression flag to
 * `WhatsNewAutoTrigger` and to decide whether `TourAutoTrigger` should suppress
 * the What's New modal. Both consumers share the same `useWelcomeTourPending()`
 * hook so the logic lives in exactly one place.
 */
function AppLayoutInner({ children }: AppLayoutProps) {
    // D12 seam: while the welcome tour is unseen, suppress What's New auto-modal.
    const { welcomeTourPending } = useWelcomeTourPending();

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
             * Tour auto-trigger (SPEC-174 T-013).
             * Headless — renders null. Evaluates decideAutoTrigger on each route
             * change and fires startTour or navigates to /dashboard (D13 redirect).
             * Mounted inside TourProvider so useTour() is available.
             */}
            <TourAutoTrigger />

            {/*
             * What's New auto-trigger (SPEC-175 §7.6 / T-014).
             * Headless — renders null until unseen highlight entries are found,
             * then opens WhatsNewModal once. Mounted here (inside the authed area)
             * so `useWhatsNew()` always has an authenticated user.
             *
             * D12 seam (SPEC-174 T-013): pass `suppressed={welcomeTourPending}` so
             * two auto-opening modals never stack on a new user's first dashboard
             * load. `welcomeTourPending` becomes false once the welcome tour is seen
             * (or when no welcome tour exists for the role), restoring normal
             * What's New behavior.
             */}
            <WhatsNewAutoTrigger suppressed={welcomeTourPending} />
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
             * TourAutoTrigger (T-013) is mounted inside AppLayoutInner.
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
