import { useTranslations } from '@/hooks/use-translations';
import { fetchAuthSession } from '@/lib/auth-session';
import { Link, Outlet, createFileRoute, redirect } from '@tanstack/react-router';

/**
 * NotFoundComponent for auth routes
 * Shows a minimal 404 for routes under /auth that don't exist
 */
function AuthNotFoundComponent() {
    const { t } = useTranslations();

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100 dark:from-cyan-950 dark:via-emerald-950 dark:to-blue-950">
            <div className="text-center">
                <div className="mb-4">
                    <h1 className="font-bold text-6xl text-muted">404</h1>
                </div>
                <h2 className="mb-2 font-semibold text-foreground text-xl">
                    {t('ui.errors.pageNotFound')}
                </h2>
                <p className="mb-6 text-muted-foreground">
                    {t('ui.errors.pageNotFoundDescription')}
                </p>
                <div className="space-x-4">
                    <Link
                        to="/auth/signin"
                        className="inline-flex items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                        Sign In
                    </Link>
                    <button
                        type="button"
                        onClick={() => {
                            if (typeof window !== 'undefined') {
                                window.history.back();
                            }
                        }}
                        className="inline-flex items-center rounded-md border border-border bg-background px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                        {t('ui.actions.goBack')}
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Auth Layout Route
 * Provides a minimal layout for authentication pages (signin, signup)
 * Redirects to dashboard if user is already authenticated
 */
export const Route = createFileRoute('/auth')({
    beforeLoad: async ({ location }) => {
        const authState = await fetchAuthSession();

        // If already authenticated, redirect to dashboard
        // Exceptions:
        // - /auth/forbidden: users without panel access
        // - /auth/change-password: users with forced password change
        const authExceptions = ['/auth/forbidden', '/auth/change-password'];
        if (authState.isAuthenticated && !authExceptions.includes(location.pathname)) {
            throw redirect({
                to: '/'
            });
        }

        return authState;
    },
    component: AuthLayout,
    notFoundComponent: AuthNotFoundComponent
});

/**
 * AuthLayout Component
 * Minimal layout without sidebar for auth pages
 * Just renders the child route content
 */
function AuthLayout() {
    return <Outlet />;
}
