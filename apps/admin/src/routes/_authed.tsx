import { AppLayout } from '@/components/layout/AppLayout';
import { AuthProvider } from '@/contexts/auth-context';
import { useTranslations } from '@/hooks/use-translations';
import { fetchAuthSession } from '@/lib/auth-session';
import { Link, Outlet, createFileRoute, redirect } from '@tanstack/react-router';

/**
 * NotFoundComponent for authenticated routes
 * Renders a 404 page within the authenticated layout
 */
function AuthedNotFoundComponent() {
    const { t } = useTranslations();

    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <div className="text-center">
                <div className="mb-4">
                    <h1 className="font-bold text-6xl text-muted-foreground/30">404</h1>
                </div>
                <h2 className="mb-2 font-semibold text-foreground text-xl">
                    {t('ui.errors.pageNotFound')}
                </h2>
                <p className="mb-6 text-muted-foreground">
                    {t('ui.errors.pageNotFoundDescription')}
                </p>
                <div className="space-x-4">
                    <Link
                        to="/"
                        className="inline-flex items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                        {t('ui.actions.goBackHome')}
                    </Link>
                    <button
                        type="button"
                        onClick={() => {
                            if (typeof window !== 'undefined') {
                                window.history.back();
                            }
                        }}
                        className="inline-flex items-center rounded-md border bg-background px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                        {t('ui.actions.goBack')}
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Protected Layout Route
 * All routes under this layout require authentication
 * Automatically applies AppLayout to all child routes
 */
export const Route = createFileRoute('/_authed')({
    beforeLoad: async () => {
        const authState = await fetchAuthSession();

        // If not authenticated, redirect to signin
        if (!authState.isAuthenticated) {
            throw redirect({
                to: '/auth/signin',
                search: {
                    redirect: typeof window !== 'undefined' ? window.location.pathname : '/'
                }
            });
        }

        return authState;
    },
    component: AuthedLayout,
    notFoundComponent: AuthedNotFoundComponent
});

/**
 * AuthedLayout Component
 * Wraps all authenticated routes with AppLayout
 */
function AuthedLayout() {
    return (
        <AuthProvider>
            <AppLayout>
                <Outlet />
            </AppLayout>
        </AuthProvider>
    );
}
