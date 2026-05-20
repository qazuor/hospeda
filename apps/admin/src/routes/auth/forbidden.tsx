/**
 * Forbidden Route.
 *
 * Renders the residual "access denied" surface for authenticated users who
 * landed in the admin without `ACCESS_PANEL_ADMIN`. Tourists (USER role) are
 * never sent here — they are redirected by `_authed.tsx` to the public
 * host-onboarding funnel. This page only sees:
 *
 *   - `reason=host-missing-permission` — HOST without panel access (config bug).
 *   - `reason=generic` — staff with the wrong account, exotic roles, guests
 *     who somehow ended up here.
 *
 * The page is reason-aware: copy and CTAs adapt to the situation. The user's
 * email is always shown so people accidentally signed in with the wrong
 * account can spot it immediately.
 *
 * @module routes/auth/forbidden
 */

import { env } from '@/env';
import { useTranslations } from '@/hooks/use-translations';
import { signOut } from '@/lib/auth-client';
import { type AuthState, fetchAuthSession } from '@/lib/auth-session';
import { type ForbiddenReason, buildSupportMailto } from '@/lib/forbidden-mailto';
import { ShieldAlertIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { type AuthBackgroundImage, getRandomAuthImage } from '../../utils/auth-images';

const searchSchema = z.object({
    reason: z.enum(['host-missing-permission', 'generic']).optional().catch(undefined),
    redirect: z.string().optional().catch(undefined)
});

export const Route = createFileRoute('/auth/forbidden')({
    validateSearch: searchSchema,
    loader: async (): Promise<{ readonly authState: AuthState }> => {
        const authState = await fetchAuthSession();
        return { authState };
    },
    component: ForbiddenPage
});

/**
 * ForbiddenPage Component.
 * Twin-panel layout matching signin/signup visual pattern.
 */
function ForbiddenPage(): React.JSX.Element {
    const { t } = useTranslations();
    const { reason: reasonParam, redirect: redirectPath } = Route.useSearch();
    const { authState } = Route.useLoaderData();

    const [isClient, setIsClient] = useState(false);
    const [backgroundImage, setBackgroundImage] = useState<AuthBackgroundImage | null>(null);
    const [isSigningOut, setIsSigningOut] = useState(false);

    const reason: ForbiddenReason = reasonParam ?? 'generic';

    useEffect(() => {
        setIsClient(true);
        setBackgroundImage(getRandomAuthImage());
    }, []);

    const handleSwitchAccount = async () => {
        setIsSigningOut(true);
        const signInTarget = redirectPath
            ? `/auth/signin?redirect=${encodeURIComponent(redirectPath)}`
            : '/auth/signin';

        try {
            await signOut({
                fetchOptions: {
                    onSuccess: () => {
                        if (typeof window !== 'undefined') {
                            window.location.href = signInTarget;
                        }
                    }
                }
            });
        } catch {
            if (typeof window !== 'undefined') {
                window.location.href = signInTarget;
            }
        }
    };

    const siteUrl = env.VITE_SITE_URL ?? '';

    const titleKey =
        reason === 'host-missing-permission'
            ? 'admin-pages.auth.forbidden.reason.host-missing-permission.title'
            : 'admin-pages.auth.forbidden.reason.generic.title';
    const messageKey =
        reason === 'host-missing-permission'
            ? 'admin-pages.auth.forbidden.reason.host-missing-permission.message'
            : 'admin-pages.auth.forbidden.reason.generic.message';

    const mailtoHref = buildSupportMailto({
        email: authState.email,
        userId: authState.userId,
        reason,
        originalPath: redirectPath,
        subjectLine: t('admin-pages.auth.forbidden.mailto.subject'),
        bodyTemplate: t('admin-pages.auth.forbidden.mailto.body')
    });

    if (!isClient) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100 dark:from-cyan-950 dark:via-emerald-950 dark:to-blue-950">
                <div className="flex min-h-screen">
                    <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
                        <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/50 to-emerald-600/30" />
                        <div className="h-full w-full animate-pulse bg-gradient-to-br from-cyan-200 to-emerald-200" />
                    </div>
                    <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
                        <div className="w-full max-w-md">
                            <div className="rounded-xl border bg-card p-8 shadow-lg">
                                <div className="animate-pulse space-y-4">
                                    <div className="mx-auto h-16 w-16 rounded-full bg-muted" />
                                    <div className="h-8 rounded-md bg-muted" />
                                    <div className="h-4 rounded-md bg-muted" />
                                    <div className="h-10 rounded-md bg-muted" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const displayName = authState.displayName ?? '';
    const greetingText = displayName
        ? t('admin-pages.auth.forbidden.greeting', { name: displayName })
        : null;
    const emailLine = authState.email
        ? t('admin-pages.auth.forbidden.email', { email: authState.email })
        : null;

    const showAllActions = reason === 'generic';

    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100 dark:from-cyan-950 dark:via-emerald-950 dark:to-blue-950">
            <div className="flex min-h-screen">
                {/* Left side - Image */}
                <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
                    <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/50 to-emerald-600/30" />
                    {backgroundImage && (
                        <img
                            src={backgroundImage.src}
                            alt={backgroundImage.alt}
                            className="h-full w-full object-cover"
                        />
                    )}
                    {backgroundImage && (
                        <div className="absolute bottom-8 left-8 text-white">
                            <p className="mt-1 text-cyan-200 text-sm opacity-80 dark:text-cyan-400">
                                {backgroundImage.location}
                            </p>
                        </div>
                    )}
                </div>

                {/* Right side - Forbidden message */}
                <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
                    <div className="w-full max-w-md space-y-8">
                        <div className="text-center">
                            <div className="mb-6 flex justify-center">
                                <img
                                    src="/logo.webp"
                                    alt="Logo"
                                    className="h-16 w-auto"
                                />
                            </div>
                        </div>

                        <div
                            data-testid="forbidden-card"
                            data-reason={reason}
                            className="rounded-xl border bg-card p-8 shadow-lg"
                        >
                            <div className="flex flex-col items-center space-y-6">
                                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                                    <ShieldAlertIcon className="h-10 w-10 text-destructive" />
                                </div>

                                <div className="text-center">
                                    {greetingText && (
                                        <p
                                            data-testid="forbidden-greeting"
                                            className="mb-2 font-medium text-foreground text-sm"
                                        >
                                            {greetingText}
                                        </p>
                                    )}
                                    <h1 className="mb-2 font-bold text-2xl text-foreground">
                                        {t(titleKey)}
                                    </h1>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        {t(messageKey)}
                                    </p>
                                    {emailLine && (
                                        <p
                                            data-testid="forbidden-email"
                                            className="mt-3 text-muted-foreground text-xs"
                                        >
                                            {emailLine}
                                        </p>
                                    )}
                                </div>

                                <div className="flex w-full flex-col gap-3">
                                    <a
                                        data-testid="forbidden-contact-admin"
                                        href={mailtoHref}
                                        className="w-full rounded-md bg-primary px-4 py-2 text-center font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                                    >
                                        {t('admin-pages.auth.forbidden.contactAdmin')}
                                    </a>

                                    {showAllActions && (
                                        <button
                                            data-testid="forbidden-switch-account"
                                            type="button"
                                            onClick={handleSwitchAccount}
                                            disabled={isSigningOut}
                                            className="w-full rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {isSigningOut
                                                ? t('admin-pages.auth.signin.redirecting')
                                                : t('admin-pages.auth.forbidden.switchAccount')}
                                        </button>
                                    )}

                                    <a
                                        data-testid="forbidden-go-to-site"
                                        href={siteUrl}
                                        className="inline-flex w-full items-center justify-center rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                                    >
                                        {t('admin-pages.auth.forbidden.goToSite')}
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
