import { createQZPayBilling } from '@qazuor/qzpay-core';
import { QZPayProvider, type QZPayProviderProps, QZPayThemeProvider } from '@qazuor/qzpay-react';
import { TanStackDevtools } from '@tanstack/react-devtools';
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

import { BrowserGateBanner } from '@/components/BrowserGateBanner';
import { AdminFeedbackHeadlessHost } from '@/components/feedback/AdminFeedbackHeadlessHost';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { validatedConfig } from '@/config/ia/validate';
import { env, validateAdminEnv } from '@/env';
import { useTranslations } from '@/hooks/use-translations';
import { initPostHog } from '@/lib/analytics/posthog-client';
import { useSession } from '@/lib/auth-client';
import { createHttpBillingAdapter } from '@/lib/billing-http-adapter';
import { GlobalErrorBoundary } from '@/lib/error-boundaries';
import { adminQzpayTheme } from '@/lib/qzpay-theme';
import { initSentry } from '@/lib/sentry';
import { FeedbackErrorBoundary } from '@repo/feedback';
import '@repo/feedback/styles.css';

// Validate environment variables eagerly at module load time - fails fast on misconfiguration
validateAdminEnv();

// Initialize Sentry for error tracking (only in production with valid DSN)
initSentry();

// Initialize PostHog analytics (only in production with valid VITE_POSTHOG_KEY)
initPostHog();

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
 * Derives a document title from the validated IA config.
 *
 * Strategy: find the first section whose `defaultRoute` or `route` is a
 * prefix of the current pathname, then return `sectionLabel · Hospeda Admin`.
 * Falls back to `BASE_TITLE` when no section matches (e.g. `/me/profile`).
 *
 * Uses the 'es' locale label from the config (Argentina market default).
 * This avoids coupling the title to the i18n bundle or SECTION_LABELS map,
 * deriving it from the same authoritative config that drives the navigation.
 */
/**
 * Derives a document title from the validated IA config.
 *
 * Strategy: find the section whose `defaultRoute` or `route` is the longest
 * prefix of the current pathname, then return `sectionLabel · Hospeda Admin`.
 * Falls back to `BASE_TITLE` when no section matches (e.g. `/me/profile`).
 *
 * Uses the 'es' locale label (Argentina market default). This avoids coupling
 * the title to the old SECTION_LABELS map — the IA config is the single
 * source of truth for section labels.
 */
const titleForPath = (pathname: string): string => {
    let bestLabel: string | undefined;
    let bestScore = -1;

    for (const section of Object.values(validatedConfig.sections)) {
        for (const candidate of [section.defaultRoute ?? section.route, section.route]) {
            if (!candidate) continue;
            if (pathname === candidate || pathname.startsWith(`${candidate}/`)) {
                const score = candidate.length;
                if (score > bestScore) {
                    bestScore = score;
                    bestLabel = section.label.es;
                }
            }
        }
    }

    return bestLabel ? `${bestLabel} · ${BASE_TITLE}` : BASE_TITLE;
};

export const Route = createRootRoute({
    head: () => ({
        meta: [
            { name: 'viewport', content: 'width=device-width, initial-scale=1' },
            { title: BASE_TITLE }
        ]
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
    const { data: session } = useSession();

    // QueryClient is intentionally created via a useState lazy initializer (per-request on SSR,
    // once on the client). This is the recommended TanStack Query pattern for SSR — each server
    // render gets an isolated QueryClient so cache from one request never leaks into another.
    // SPEC-209 identified this as a secondary suspect; after analysis it is NOT the memory-leak
    // source (the leak was the QZPayBilling construction above). Do not collapse this into a
    // module-level singleton without fully understanding the SSR isolation implications.
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

    // SPEC-209 AC-2.2 — Build QZPayBilling CLIENT-ONLY via useEffect.
    //
    // The previous useState lazy-initializer ran server-side on every SSR
    // request (TanStack Start mounts RootDocument once per request), producing
    // ~990 "QZPayBilling initialized" log lines per 48 h from healthcheck
    // probes. useEffect never executes on the server, so SSR builds no billing
    // instance. The client builds exactly one on mount, after hydration.
    //
    // QZPayProvider is only mounted when billing is non-null (client-side only).
    // All qzpay-react hook consumers live under _authed/billing/* routes and
    // are only reachable after client-side navigation — they never execute
    // during the initial SSR render, so removing the provider from SSR is safe.
    const [billing, setBilling] = useState<QZPayProviderProps['billing'] | null>(null);

    useEffect(() => {
        const adapter = createHttpBillingAdapter({
            apiUrl: env.VITE_API_URL
            // getAuthToken not provided - Better Auth handles auth via cookies
        });

        setBilling(
            // Cast needed: @qazuor/qzpay-react depends on qzpay-core@1.1.0 while
            // admin uses qzpay-core@1.2.0. The interfaces are compatible but
            // TypeScript sees them as distinct nominal types.
            // TYPE-WORKAROUND: qzpay-core version skew between @qazuor/qzpay-react (1.1.0) and admin (1.2.0) produces nominally distinct billing types; structurally identical, version-only mismatch.
            createQZPayBilling({
                storage: adapter,
                defaultCurrency: 'ARS',
                livemode: env.PROD ?? false
            }) as unknown as QZPayProviderProps['billing']
        );
    }, []);

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
                {/*
                 * SPEC-176 T-008 — Browser-gate banner. First visible child of
                 * the body so it sits above ALL admin content (including the
                 * signin/forbidden routes, which live outside AppLayout and are
                 * equally broken on Chrome <111). Self-styled (inline) so it
                 * renders legibly even when the panel's oklch CSS is broken.
                 */}
                <BrowserGateBanner />
                {/*
                 * SPEC-209 AC-2.2 — QZPayProvider wraps the tree only once
                 * billing is available (client-side, after useEffect).
                 * During SSR and the first hydration frame billing is null, so
                 * the inner tree renders without QZPayProvider. All qzpay-react
                 * hook consumers live under _authed/billing/* routes and are
                 * only reachable after client navigation, by which time billing
                 * will already be initialised.
                 *
                 * QZPayThemeProvider, QueryClientProvider, and ToastProvider
                 * are intentionally outside the billing conditional so they
                 * remain stable across the null→billing transition and their
                 * internal state (query cache, toasts) is preserved.
                 */}
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
                                    {billing !== null ? (
                                        <QZPayProvider billing={billing}>{children}</QZPayProvider>
                                    ) : (
                                        children
                                    )}
                                </FeedbackErrorBoundary>
                            </GlobalErrorBoundary>
                        </ToastProvider>
                    </QueryClientProvider>
                </QZPayThemeProvider>
                {/*
                 * SPEC-301 T-010 — Headless feedback host (no visible FAB).
                 * Activates on Ctrl+Shift+F or the `feedback:open` CustomEvent
                 * dispatched by the "Reportar un problema" item in the user menu.
                 * Wraps in FeedbackErrorBoundary so errors in the host don't
                 * crash the outer admin shell.
                 */}
                {import.meta.env.VITE_FEEDBACK_ENABLED !== 'false' && (
                    <FeedbackErrorBoundary
                        appSource="admin"
                        apiUrl={env.VITE_API_URL}
                        feedbackPageUrl={`${env.VITE_SITE_URL}/${env.VITE_DEFAULT_LOCALE}/feedback`}
                        deployVersion={env.VITE_APP_VERSION}
                    >
                        <AdminFeedbackHeadlessHost
                            apiUrl={env.VITE_API_URL}
                            deployVersion={env.VITE_APP_VERSION}
                            userId={session?.user.id}
                            userEmail={session?.user.email}
                            userName={session?.user.name}
                            turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                        />
                    </FeedbackErrorBoundary>
                )}
                {env.NODE_ENV === 'development' && <TanStackDevtools />}
                <Scripts />
            </body>
        </html>
    );
}
