import { env } from '@/env';
import { useTranslations } from '@/hooks/use-translations';
import { signOut } from '@/lib/auth-client';
import { ShieldAlertIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { type AuthBackgroundImage, getRandomAuthImage } from '../../utils/auth-images';

/**
 * Forbidden Route
 * Displayed when an authenticated user lacks ACCESS_PANEL_ADMIN permission.
 * Breaks the redirect loop between _authed -> signin -> dashboard.
 */
export const Route = createFileRoute('/auth/forbidden')({
    component: ForbiddenPage
});

/**
 * ForbiddenPage Component
 * Twin-panel layout matching signin/signup visual pattern.
 * Shows access denied message with actions to switch account or go to website.
 */
function ForbiddenPage(): React.JSX.Element {
    const { t } = useTranslations();
    const [isClient, setIsClient] = useState(false);
    const [backgroundImage, setBackgroundImage] = useState<AuthBackgroundImage | null>(null);
    const [isSigningOut, setIsSigningOut] = useState(false);

    useEffect(() => {
        setIsClient(true);
        setBackgroundImage(getRandomAuthImage());
    }, []);

    const handleSwitchAccount = async () => {
        setIsSigningOut(true);
        try {
            await signOut({
                fetchOptions: {
                    onSuccess: () => {
                        if (typeof window !== 'undefined') {
                            window.location.href = '/auth/signin';
                        }
                    }
                }
            });
        } catch {
            // Fallback: redirect to signin even if signout fails
            if (typeof window !== 'undefined') {
                window.location.href = '/auth/signin';
            }
        }
    };

    const siteUrl = env.VITE_SITE_URL ?? '';

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

                        <div className="rounded-xl border bg-card p-8 shadow-lg">
                            <div className="flex flex-col items-center space-y-6">
                                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                                    <ShieldAlertIcon className="h-10 w-10 text-destructive" />
                                </div>

                                <div className="text-center">
                                    <h1 className="mb-2 font-bold text-2xl text-foreground">
                                        {t('admin-pages.auth.forbidden.title')}
                                    </h1>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        {t('admin-pages.auth.forbidden.message')}
                                    </p>
                                </div>

                                <div className="flex w-full flex-col gap-3">
                                    <button
                                        type="button"
                                        onClick={handleSwitchAccount}
                                        disabled={isSigningOut}
                                        className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isSigningOut
                                            ? t('admin-pages.auth.signin.redirecting')
                                            : t('admin-pages.auth.forbidden.switchAccount')}
                                    </button>

                                    <a
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
