import { createQZPayBilling } from '@qazuor/qzpay-core';
import { QZPayProvider, QZPayThemeProvider } from '@qazuor/qzpay-react';
import { TanstackDevtools } from '@tanstack/react-devtools';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HeadContent, Link, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import { useState } from 'react';
import type * as React from 'react';

import { ToastProvider } from '@/components/ui/ToastProvider';
import { initializeSections } from '@/config/sections';
import { env, validateAdminEnv } from '@/env';
import { useTranslations } from '@/hooks/use-translations';
import { useSession } from '@/lib/auth-client';
import { createHttpBillingAdapter } from '@/lib/billing-http-adapter';
import { GlobalErrorBoundary } from '@/lib/error-boundaries';
import { adminQzpayTheme } from '@/lib/qzpay-theme';
import { initSentry } from '@/lib/sentry';
import { FeedbackErrorBoundary, FeedbackFAB } from '@repo/feedback';

// Validate environment variables eagerly at module load time - fails fast on misconfiguration
validateAdminEnv();

// Initialize Sentry for error tracking (only in production with valid DSN)
initSentry();

// Initialize navigation sections (register all sections with the registry)
initializeSections();

import appCss from '../styles.css?url';

/**
 * NotFoundComponent
 * Renders a 404 page when no route matches
 */
function NotFoundComponent() {
    const { t } = useTranslations();

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="text-center">
                <div className="mb-4">
                    <h1 className="font-bold text-9xl text-muted">404</h1>
                </div>
                <h2 className="mb-2 font-semibold text-2xl text-foreground">
                    {t('ui.errors.pageNotFound')}
                </h2>
                <p className="mb-8 text-muted-foreground">
                    {t('ui.errors.pageNotFoundDescription')}
                </p>
                <div className="space-x-4">
                    <Link
                        to="/"
                        className="inline-flex items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
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
                        className="inline-flex items-center rounded-md border border-border bg-background px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
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
    const { data: session } = useSession();

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

    // Create QZPay billing instance with HTTP adapter
    // Uses lazy initializer to prevent recreation on every render
    const [billing] = useState(() => {
        const adapter = createHttpBillingAdapter({
            apiUrl: env.VITE_API_URL
            // getAuthToken not provided - Better Auth handles auth via cookies
        });

        return createQZPayBilling({
            storage: adapter,
            defaultCurrency: 'ARS',
            livemode: env.PROD ?? false
        });
    });

    return (
        <html lang="en">
            <head>
                <HeadContent />
                <link
                    rel="stylesheet"
                    href={appCss}
                />
            </head>
            <body>
                <QZPayProvider billing={billing}>
                    <QZPayThemeProvider theme={adminQzpayTheme}>
                        <QueryClientProvider client={queryClient}>
                            <ToastProvider>
                                <GlobalErrorBoundary>
                                    <FeedbackErrorBoundary
                                        appSource="admin"
                                        apiUrl={env.VITE_API_URL}
                                        feedbackPageUrl="/es/feedback"
                                        userId={session?.user.id}
                                        userEmail={session?.user.email}
                                        userName={session?.user.name}
                                    >
                                        {children}
                                    </FeedbackErrorBoundary>
                                </GlobalErrorBoundary>
                            </ToastProvider>
                        </QueryClientProvider>
                    </QZPayThemeProvider>
                </QZPayProvider>
                <FeedbackFAB
                    apiUrl={env.VITE_API_URL}
                    appSource="admin"
                    userId={session?.user.id}
                    userEmail={session?.user.email}
                    userName={session?.user.name}
                />
                {env.NODE_ENV === 'development' && <TanstackDevtools />}
                <Scripts />
            </body>
        </html>
    );
}
