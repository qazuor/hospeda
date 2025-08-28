import { ClerkProvider } from '@clerk/tanstack-react-start';
import { TanstackDevtools } from '@tanstack/react-devtools';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HeadContent, Link, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import type * as React from 'react';

import { ToastProvider } from '@/components/ui/ToastProvider';
import { useTranslations } from '@/hooks/use-translations';

import appCss from '../styles.css?url';

/**
 * NotFoundComponent
 * Renders a 404 page when no route matches
 */
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
                    <Link
                        to="/"
                        className="inline-flex items-center rounded-md bg-cyan-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
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
    component: () => {
        return (
            <RootDocument>
                <Outlet />
            </RootDocument>
        );
    },
    notFoundComponent: NotFoundComponent
});

function RootDocument({ children }: { children: React.ReactNode }) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 5 * 60 * 1000, // 5 minutes
                gcTime: 30 * 60 * 1000 // 30 minutes
            }
        }
    });

    return (
        <ClerkProvider>
            <html lang="en">
                <head>
                    <HeadContent />
                    <link
                        rel="stylesheet"
                        href={appCss}
                    />
                </head>
                <body>
                    <QueryClientProvider client={queryClient}>
                        <ToastProvider>{children}</ToastProvider>
                    </QueryClientProvider>
                    {process.env.NODE_ENV === 'development' && (
                        <>
                            <TanstackDevtools />
                            <TanStackRouterDevtoolsPanel />
                        </>
                    )}
                    <Scripts />
                </body>
            </html>
        </ClerkProvider>
    );
}
