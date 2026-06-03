import { AppLayout } from '@/components/layout/AppLayout';
import { AuthProvider } from '@/contexts/auth-context';
import { env } from '@/env';
import { useTranslations } from '@/hooks/use-translations';
import type { AuthState } from '@/lib/auth-session';
import { fetchAuthSession } from '@/lib/auth-session';
import { decideAuthedGuard } from '@/lib/authed-guard';
import { fetchPreferredLocale } from '@/lib/locale';
import { adminLogger } from '@/utils/logger';
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
    beforeLoad: async ({ location }) => {
        // Resolve the session and the preferred locale in parallel: the locale
        // is a pure Accept-Language read with no dependency on the auth state,
        // so the two server functions need not run sequentially. Keeps
        // `decideAuthedGuard` a pure function with no I/O. (BETA-71.)
        const [authState, { locale: preferredLocale }] = await Promise.all([
            fetchAuthSession(),
            fetchPreferredLocale()
        ]);

        const decision = decideAuthedGuard({
            authState,
            pathname: location.pathname,
            preferredLocale,
            siteUrl: env.VITE_SITE_URL,
            adminUrl: env.VITE_ADMIN_URL
        });

        switch (decision.kind) {
            case 'redirect-signin':
                // SPEC-182: admin no longer hosts its own signin. Send
                // unauthenticated users to the unified web auth surface; the
                // guard already built the absolute web URL with an allowlisted
                // callbackUrl back into admin.
                throw redirect({ href: decision.href });
            case 'redirect-tourist-funnel':
                // Telemetry: log the original path the tourist was trying to
                // reach. We deliberately do NOT pass it to the funnel — the
                // funnel doesn't need it, but we want to see it in logs.
                adminLogger.info('tourist redirected to host funnel', {
                    userId: authState.userId,
                    originalPath: location.pathname,
                    locale: preferredLocale
                });
                throw redirect({ href: decision.href });
            case 'redirect-forbidden':
                throw redirect({ to: '/auth/forbidden', search: decision.search });
            case 'redirect-change-password':
                throw redirect({ to: '/auth/change-password' });
            case 'allow':
                return decision.authState;
        }
    },
    component: AuthedLayout,
    notFoundComponent: AuthedNotFoundComponent
});

/**
 * AuthedLayout Component
 * Wraps all authenticated routes with AppLayout
 */
function AuthedLayout() {
    const routeContext = Route.useRouteContext();
    // TYPE-WORKAROUND: TanStack Router context type can't infer dynamically-loaded auth fields populated in beforeLoad; cast restores the AuthState shape set there.
    const authState = routeContext as unknown as AuthState;

    return (
        <AuthProvider initialAuthState={authState}>
            <AppLayout>
                <Outlet />
            </AppLayout>
        </AuthProvider>
    );
}
