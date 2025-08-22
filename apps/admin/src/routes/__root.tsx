import { TanstackDevtools } from '@tanstack/react-devtools';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HeadContent, Scripts, createRootRoute, useRouter } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import * as React from 'react';

import { AppLayout } from '@/components/layout/AppLayout';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { AuthProvider } from '@/contexts/auth-context';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useTranslations } from '@/hooks/use-translations';
import { adminLogger } from '@/utils/logger';

import ClerkProvider from '../integrations/clerk/provider';

import appCss from '../styles.css?url';

function NotFoundComponent() {
    const { t } = useTranslations();

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="mb-4">
                    <h1 className="font-bold text-9xl text-gray-200">404</h1>
                </div>
                <h2 className="mb-2 font-semibold text-2xl text-gray-900">
                    {t('ui.errors.pageNotFound')}
                </h2>
                <p className="mb-8 text-gray-600">{t('ui.errors.pageNotFoundDescription')}</p>
                <div className="space-x-4">
                    <a
                        href="/"
                        className="inline-flex items-center rounded-md bg-cyan-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
                    >
                        {t('ui.actions.goBackHome')}
                    </a>
                    <button
                        type="button"
                        onClick={() => window.history.back()}
                        className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
                    >
                        {t('ui.actions.goBack')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export const Route = createRootRoute({
    head: () => ({
        meta: [
            {
                charSet: 'utf-8'
            },
            {
                name: 'viewport',
                content: 'width=device-width, initial-scale=1'
            },
            {
                title: 'Hosped.ar Admin Panel'
            }
        ],
        links: [
            {
                rel: 'stylesheet',
                href: appCss
            }
        ]
    }),

    notFoundComponent: NotFoundComponent,
    shellComponent: RootDocument
});

function RootDocument({ children }: { children: React.ReactNode }) {
    const queryClient = new QueryClient();
    return (
        <html lang="en">
            <head>
                <HeadContent />
            </head>
            <body>
                <ClerkProvider>
                    <QueryClientProvider client={queryClient}>
                        <AuthProvider>
                            <ToastProvider>
                                <AuthGate>{children}</AuthGate>
                            </ToastProvider>
                        </AuthProvider>
                    </QueryClientProvider>
                    <TanstackDevtools
                        config={{
                            position: 'bottom-left'
                        }}
                        plugins={[
                            {
                                name: 'Tanstack Router',
                                render: <TanStackRouterDevtoolsPanel />
                            }
                        ]}
                    />
                </ClerkProvider>
                <Scripts />
            </body>
        </html>
    );
}

function AuthGate({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const path = router.state.location.pathname;
    const isAuthRoute = path.startsWith('/auth');
    const { t } = useTranslations();

    // Use our optimized auth context instead of direct API calls
    const { isLoading, isAuthenticated, error, refreshSession } = useAuthContext();

    const [hasTriedRefresh, setHasTriedRefresh] = React.useState(false);

    React.useEffect(() => {
        // If we're on an auth route, no need to check authentication
        if (isAuthRoute) return;

        // If we're not authenticated and not loading, try to refresh once
        if (!isAuthenticated && !isLoading && !hasTriedRefresh) {
            adminLogger.info('AuthGate: Attempting to refresh session...');
            setHasTriedRefresh(true);
            refreshSession().catch(() => {
                // If refresh fails, we'll redirect below
            });
            return;
        }

        // If we're not authenticated after trying refresh, redirect to signin
        if (!isAuthenticated && !isLoading && hasTriedRefresh) {
            adminLogger.info('AuthGate: User not authenticated, redirecting to signin');
            router.navigate({ to: '/auth/signin', search: { redirect: path } });
        }
    }, [isAuthRoute, isAuthenticated, isLoading, hasTriedRefresh, path, router, refreshSession]);

    // Auth routes are always allowed
    if (isAuthRoute) {
        return <>{children}</>;
    }

    // Show loading only briefly and only if we don't have a cached session
    if (isLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6 text-center">
                <div className="text-muted-foreground text-sm">{t('ui.loading.text')}</div>
            </div>
        );
    }

    // Show error if there's an authentication error
    if (error) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6 text-center">
                <div className="text-red-600 text-sm">
                    {t('ui.errors.authenticationError')}: {error}
                    <button
                        type="button"
                        onClick={() => {
                            setHasTriedRefresh(false);
                            refreshSession();
                        }}
                        className="ml-2 text-blue-600 underline"
                    >
                        {t('ui.actions.retry')}
                    </button>
                </div>
            </div>
        );
    }

    // If not authenticated, don't render anything (redirect will happen in useEffect)
    if (!isAuthenticated) {
        return null;
    }

    // User is authenticated, render the app
    return <AppLayout>{children}</AppLayout>;
}
