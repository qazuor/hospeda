import { useTranslations } from '@/hooks/use-translations';
import { type ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export type AppLayoutProps = {
    /**
     * React children to render inside the main content area of the admin layout.
     */
    readonly children: ReactNode;
};

/**
 * AppLayout composes the application chrome for the admin panel, including
 * a responsive sidebar for navigation and a topbar for global actions.
 *
 * - The sidebar collapses into a drawer on small screens and is always visible on desktop.
 * - The topbar contains the menu button, branding, global search placeholder, and user actions.
 */
export const AppLayout = ({ children }: AppLayoutProps) => {
    const { t } = useTranslations();
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

    const handleToggleSidebar = () => setIsSidebarOpen((prev) => !prev);
    const handleCloseSidebar = () => setIsSidebarOpen(false);

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Topbar */}
            <Topbar onToggleSidebar={handleToggleSidebar} />

            <div className="flex min-h-[calc(100vh-3.5rem)]">
                {/* Mobile overlay when the sidebar is open */}
                {isSidebarOpen ? (
                    <button
                        aria-label={t('ui.accessibility.closeSidebarOverlay')}
                        className="fixed inset-0 z-30 bg-black/40 md:hidden"
                        type="button"
                        onClick={handleCloseSidebar}
                    />
                ) : null}

                {/* Sidebar */}
                <Sidebar
                    open={isSidebarOpen}
                    onClose={handleCloseSidebar}
                />

                {/* Main content */}
                <main className="min-w-0 flex-1 p-6 md:px-6 lg:px-8">{children}</main>
            </div>
        </div>
    );
};
