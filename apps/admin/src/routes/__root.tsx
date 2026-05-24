import { createQZPayBilling } from '@qazuor/qzpay-core';
import { QZPayProvider, type QZPayProviderProps, QZPayThemeProvider } from '@qazuor/qzpay-react';
import { TanstackDevtools } from '@tanstack/react-devtools';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    HeadContent,
    Link,
    Outlet,
    Scripts,
    createRootRoute,
    useRouterState
} from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type * as React from 'react';

import { ToastProvider } from '@/components/ui/ToastProvider';
import { initializeSections } from '@/config/sections';
import { env, validateAdminEnv } from '@/env';
import { useTranslations } from '@/hooks/use-translations';
import { initPostHog } from '@/lib/analytics/posthog-client';
import { useSession } from '@/lib/auth-client';
import { createHttpBillingAdapter } from '@/lib/billing-http-adapter';
import { GlobalErrorBoundary } from '@/lib/error-boundaries';
import { adminQzpayTheme } from '@/lib/qzpay-theme';
import { initSentry } from '@/lib/sentry';
import { FeedbackErrorBoundary, FeedbackFAB } from '@repo/feedback';
import '@repo/feedback/styles.css';
import * as Sentry from '@sentry/react';

/**
 * Returns the most recent Sentry event ID, if any. Wrapped in try/catch so
 * SDK changes or pre-init calls don't crash the FAB.
 */
const getSentryEventId = (): string | undefined => {
    try {
        const fn = (Sentry as { lastEventId?: () => string | undefined }).lastEventId;
        return typeof fn === 'function' ? fn() : undefined;
    } catch {
        return undefined;
    }
};

/**
 * Mirrors a successful feedback report into Sentry's User Feedback channel.
 * Best-effort: any SDK error is swallowed so the Linear flow is unaffected.
 */
const handleSentryFeedback = (payload: {
    name: string;
    email: string;
    message: string;
    associatedEventId?: string;
}): void => {
    try {
        const fn = (
            Sentry as {
                captureFeedback?: (data: {
                    name: string;
                    email: string;
                    message: string;
                    associatedEventId?: string;
                }) => void;
            }
        ).captureFeedback;
        fn?.(payload);
    } catch {
        // Intentional no-op
    }
};

// Validate environment variables eagerly at module load time - fails fast on misconfiguration
validateAdminEnv();

// Initialize Sentry for error tracking (only in production with valid DSN)
initSentry();

// Initialize PostHog analytics (only in production with valid VITE_POSTHOG_KEY)
initPostHog();

// Sections must be initialized lazily on the first render of RootDocument.
// Top-level invocation breaks the Nitro/Rolldown SSR bundle: the bundler
// emits the call before the `sections` array is assigned, producing
// `TypeError: e is not iterable` at runtime. Module-scope guard ensures
// it runs exactly once per process (idempotent across SSR requests).
let sectionsInitialized = false;

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

const BASE_TITLE = 'Hospeda Admin';

/**
 * Maps the first path segment of an admin route to a human-readable section
 * label used to compose the document title. Keeps lookup O(1) and avoids
 * coupling the title to the i18n bundle (the admin app currently runs in a
 * single static locale, so this stays in sync with admin-menu.json by value).
 */
const SECTION_LABELS: Record<string, string> = {
    dashboard: 'Panel de Control',
    accommodations: 'Alojamientos',
    destinations: 'Destinos',
    events: 'Eventos',
    posts: 'Publicaciones',
    access: 'Acceso',
    content: 'Contenido',
    billing: 'Facturación',
    sponsors: 'Patrocinadores',
    settings: 'Configuración',
    tags: 'Etiquetas',
    analytics: 'Analíticas',
    notifications: 'Notificaciones',
    newsletter: 'Newsletter',
    conversations: 'Conversaciones',
    auth: 'Autenticación',
    dev: 'Dev'
};

const titleForPath = (pathname: string): string => {
    const segment = pathname.split('/').filter(Boolean)[0];
    const label = segment ? SECTION_LABELS[segment] : undefined;
    return label ? `${label} · ${BASE_TITLE}` : BASE_TITLE;
};

export const Route = createRootRoute({
    head: () => ({
        meta: [{ title: BASE_TITLE }]
    }),
    component: () => {
        return (
            <RootDocument>
                <Outlet />
            </RootDocument>
        );
    },
    notFoundComponent: NotFoundComponent
});

/**
 * Keeps `document.title` aligned with the active route so each admin page
 * surfaces a distinct, descriptive title to screen readers and browser tabs
 * (fixes SPEC-136 F-003 across all 105 routes without per-route head wiring).
 */
function DocumentTitle() {
    const pathname = useRouterState({ select: (s) => s.location.pathname });

    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.title = titleForPath(pathname);
        }
    }, [pathname]);

    return null;
}

function RootDocument({ children }: { children: React.ReactNode }) {
    // Lazy section registration: ensures the `sections` array is fully
    // assigned before `registerSections` iterates it. The module-scope
    // guard avoids re-registering on subsequent SSR requests in the
    // same Node process. See top-of-file note for the underlying bundle bug.
    useState(() => {
        if (!sectionsInitialized) {
            initializeSections();
            sectionsInitialized = true;
        }
        return null;
    });

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
                            // Skip retries on any response that carries a status code.
                            // 4xx (including 429 rate-limit) and 5xx will not succeed on
                            // retry in this admin: 4xx is permanent per the request, and
                            // most 5xx are schema-mismatch or misconfigured billing
                            // service responses that retrying just amplifies (SPEC-117
                            // M-2 — every API failure used to produce 4 visible network
                            // entries). Only retry genuine network failures (no status).
                            if (error instanceof Error && 'status' in error) {
                                const status = (error as { status: number }).status;
                                if (typeof status === 'number' && status >= 400) {
                                    return false;
                                }
                            }
                            // Network errors / unknown shape: retry up to 2 times.
                            return failureCount < 2;
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

        // Cast needed: @qazuor/qzpay-react depends on qzpay-core@1.1.0
        // while admin uses qzpay-core@1.2.0. The interfaces are compatible
        // but TypeScript sees them as distinct nominal types.
        // TYPE-WORKAROUND: qzpay-core version skew between @qazuor/qzpay-react (1.1.0) and admin (1.2.0) produces nominally distinct billing types; structurally identical, version-only mismatch.
        return createQZPayBilling({
            storage: adapter,
            defaultCurrency: 'ARS',
            livemode: env.PROD ?? false
        }) as unknown as QZPayProviderProps['billing'];
    });

    return (
        <html
            lang={env.VITE_DEFAULT_LOCALE}
            data-app="admin"
        >
            <head>
                <HeadContent />
                {/*
                 * Brand fonts (SPEC-153 T-153-28): Geologica (headings) +
                 * Roboto (body), shared with apps/web. NO Caveat — that
                 * decorative face is web-only (doc 05 Eje 4). display=swap
                 * prevents FOIT (fallback shows immediately, swaps on load);
                 * preconnect + preload warm the fetch. CSP-safe — no inline
                 * script needed.
                 */}
                <link
                    rel="preconnect"
                    href="https://fonts.googleapis.com"
                />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin="anonymous"
                />
                <link
                    rel="preload"
                    as="style"
                    href="https://fonts.googleapis.com/css2?family=Geologica:wght@400;500;700&family=Roboto:wght@400;500;700&display=swap"
                />
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Geologica:wght@400;500;700&family=Roboto:wght@400;500;700&display=swap"
                />
                <link
                    rel="stylesheet"
                    href={appCss}
                />
            </head>
            <body>
                <DocumentTitle />
                <QZPayProvider billing={billing}>
                    <QZPayThemeProvider theme={adminQzpayTheme}>
                        <QueryClientProvider client={queryClient}>
                            <ToastProvider>
                                <GlobalErrorBoundary>
                                    <FeedbackErrorBoundary
                                        appSource="admin"
                                        apiUrl={env.VITE_API_URL}
                                        feedbackPageUrl={`${env.VITE_SITE_URL}/${env.VITE_DEFAULT_LOCALE}/feedback`}
                                        deployVersion={env.VITE_APP_VERSION}
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
                {import.meta.env.VITE_FEEDBACK_ENABLED !== 'false' && (
                    <FeedbackErrorBoundary
                        appSource="admin"
                        apiUrl={env.VITE_API_URL}
                        feedbackPageUrl={`${env.VITE_SITE_URL}/${env.VITE_DEFAULT_LOCALE}/feedback`}
                        deployVersion={env.VITE_APP_VERSION}
                    >
                        <FeedbackFAB
                            apiUrl={env.VITE_API_URL}
                            appSource="admin"
                            deployVersion={env.VITE_APP_VERSION}
                            userId={session?.user.id}
                            userEmail={session?.user.email}
                            userName={session?.user.name}
                            getSentryEventId={getSentryEventId}
                            onSentryFeedback={handleSentryFeedback}
                        />
                    </FeedbackErrorBoundary>
                )}
                {env.NODE_ENV === 'development' && <TanstackDevtools />}
                <Scripts />
            </body>
        </html>
    );
}
