import { ClerkProvider } from '@clerk/tanstack-react-start';
import { TanstackDevtools } from '@tanstack/react-devtools';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HeadContent, Link, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import { useState } from 'react';
import type * as React from 'react';

import { ToastProvider } from '@/components/ui/ToastProvider';
import { useTranslations } from '@/hooks/use-translations';
import { GlobalErrorBoundary } from '@/lib/error-boundaries';
import { initSentry } from '@/lib/sentry';

// Initialize Sentry for error tracking (only in production with valid DSN)
initSentry();

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
    // Use useState with lazy initializer to prevent QueryClient recreation on every render
    // This ensures the cache persists across component re-renders and navigations
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
                        gcTime: 30 * 60 * 1000, // 30 minutes - cache garbage collection time
                        retry: (failureCount, error) => {
                            // Don't retry on 4xx errors (client errors)
                            if (error instanceof Error && 'status' in error) {
                                const status = (error as { status: number }).status;
                                if (status >= 400 && status < 500) {
                                    return false;
                                }
                            }
                            // Retry up to 3 times for other errors
                            return failureCount < 3;
                        },
                        refetchOnWindowFocus: false // Avoid unnecessary refetches
                    },
                    mutations: {
                        retry: false // Don't retry mutations by default
                    }
                }
            })
    );

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
                        <ToastProvider>
                            <GlobalErrorBoundary>{children}</GlobalErrorBoundary>
                        </ToastProvider>
                    </QueryClientProvider>
                    {process.env.NODE_ENV === 'development' && <TanstackDevtools />}
                    <Scripts />
                </body>
            </html>
        </ClerkProvider>
    );
}
