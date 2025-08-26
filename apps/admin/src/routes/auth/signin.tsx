import { useTranslations } from '@/hooks/use-translations';
import { useAuth, useUser } from '@clerk/clerk-react';
import { SignInForm } from '@repo/auth-ui';
import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { type AuthBackgroundImage, getRandomAuthImage } from '../../utils/auth-images';
import { adminLogger } from '../../utils/logger';

export const Route = createFileRoute('/auth/signin')({
    component: SignInPage
});

function SignInPage(): React.JSX.Element {
    const router = useRouter();
    const { signOut, isSignedIn, isLoaded } = useAuth();
    const { user } = useUser();
    const { t } = useTranslations();
    const redirect =
        (router.state.location.search as Record<string, string | undefined>)?.redirect || '/';

    const [isClient, setIsClient] = useState(false);
    const [backgroundImage, setBackgroundImage] = useState<AuthBackgroundImage | null>(null);
    const [isHandlingCallback, setIsHandlingCallback] = useState(false);

    // Check if this is a callback from OAuth (has __clerk_handshake parameter or flag in sessionStorage)
    const hasHandshakeParam = !!(
        router.state.location.search as string & { __clerk_handshake?: string }
    )?.__clerk_handshake;
    const hasOAuthFlag =
        typeof window !== 'undefined' && sessionStorage.getItem('oauth_in_progress') === 'true';
    const isOAuthCallback = hasHandshakeParam || hasOAuthFlag;

    // Set OAuth flag when handshake is detected
    useEffect(() => {
        if (hasHandshakeParam && typeof window !== 'undefined') {
            sessionStorage.setItem('oauth_in_progress', 'true');
        }
    }, [hasHandshakeParam]);

    adminLogger.debug(
        {
            hasHandshakeParam,
            hasOAuthFlag,
            isOAuthCallback,
            isHandlingCallback,
            isLoaded,
            isSignedIn,
            user: !!user,
            searchParams: router.state.location.search,
            pathname: router.state.location.pathname
        },
        'SignIn Debug'
    );

    useEffect(() => {
        setIsClient(true);
        setBackgroundImage(getRandomAuthImage());
    }, []);

    // Handle OAuth callback
    useEffect(() => {
        const handleOAuthCallback = async () => {
            if (!isLoaded || !isOAuthCallback || isHandlingCallback) return;

            adminLogger.info(
                {
                    isSignedIn,
                    user: !!user
                },
                'OAuth callback detected, checking auth status'
            );

            if (isSignedIn && user) {
                adminLogger.info('User is signed in after OAuth, syncing with backend...');
                setIsHandlingCallback(true);

                try {
                    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                    adminLogger.info(
                        `${apiBaseUrl}/api/v1/public/auth/sync`,
                        'Making sync request to'
                    );

                    const response = await fetch(`${apiBaseUrl}/api/v1/public/auth/sync`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include'
                    });

                    adminLogger.info(
                        { status: response.status, statusText: response.statusText },
                        'Sync response status'
                    );
                    adminLogger.debug(
                        Object.fromEntries(response.headers.entries()),
                        'Sync response headers'
                    );

                    const responseText = await response.text();
                    adminLogger.debug(responseText, 'Sync response text');

                    let result: unknown;
                    try {
                        result = JSON.parse(responseText);
                    } catch (parseError) {
                        adminLogger.error(parseError, 'Failed to parse sync response as JSON');
                        throw new Error(`Invalid JSON response: ${responseText}`);
                    }

                    adminLogger.info(result, 'OAuth sync result');

                    if (
                        response.ok &&
                        result &&
                        typeof result === 'object' &&
                        'success' in result &&
                        (result as { success: boolean }).success
                    ) {
                        adminLogger.info(redirect, 'OAuth sync successful, redirecting to');
                        // Clear OAuth flag on success
                        if (typeof window !== 'undefined') {
                            sessionStorage.removeItem('oauth_in_progress');
                        }
                        // Small delay to ensure cookies are properly set
                        await new Promise((resolve) => setTimeout(resolve, 500));
                        await router.navigate({ to: redirect });
                    } else {
                        adminLogger.error(result, 'OAuth sync failed');
                        setIsHandlingCallback(false);
                    }
                } catch (error) {
                    adminLogger.error(error, 'OAuth sync error');

                    // If sync fails but user is authenticated in Clerk, still redirect
                    // The AuthGate will handle the backend sync later
                    if (isSignedIn && user) {
                        adminLogger.warn(
                            'Sync failed but user is authenticated, redirecting anyway...'
                        );
                        // Clear OAuth flag
                        if (typeof window !== 'undefined') {
                            sessionStorage.removeItem('oauth_in_progress');
                        }
                        await router.navigate({ to: redirect });
                        return;
                    }

                    // Clear OAuth flag on error
                    if (typeof window !== 'undefined') {
                        sessionStorage.removeItem('oauth_in_progress');
                    }
                    setIsHandlingCallback(false);
                }
            }
        };

        void handleOAuthCallback();
    }, [isLoaded, isSignedIn, user, isOAuthCallback, redirect, router, isHandlingCallback]);

    const handleClearSession = async () => {
        try {
            adminLogger.info('Clearing Clerk session...');
            await signOut({ sessionId: 'all' });
            // Also clear local storage
            localStorage.clear();
            sessionStorage.clear();
            // Reload the page
            window.location.reload();
        } catch (error) {
            adminLogger.error(error, 'Clear session error');
        }
    };

    // Show loading state for OAuth callback
    if (isHandlingCallback) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
                    <p className="text-gray-600">{t('admin-auth.signin.completingSignIn')}</p>
                </div>
            </div>
        );
    }

    if (!isClient) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100">
                <div className="flex min-h-screen">
                    {/* Left side - Image */}
                    <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
                        <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/50 to-emerald-600/30" />
                        <div className="h-full w-full animate-pulse bg-gradient-to-br from-cyan-200 to-emerald-200" />
                        <div className="absolute bottom-8 left-8 text-white">
                            <h2 className="mb-2 font-bold text-3xl">
                                {t('admin-auth.signin.welcomeBack')}
                            </h2>
                            <p className="text-cyan-100">
                                {t('admin-auth.signin.manageAccommodations')}
                            </p>
                        </div>
                    </div>

                    {/* Right side - Form */}
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
                                <h1 className="font-bold text-3xl text-gray-900">
                                    {t('admin-auth.signin.heading')}
                                </h1>
                                <p className="mt-2 text-gray-600">
                                    {t('admin-auth.signin.subtitle')}
                                </p>
                            </div>

                            <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
                                <div className="animate-pulse space-y-4">
                                    <div className="space-y-2">
                                        <div className="h-10 rounded-md bg-gray-200" />
                                        <div className="h-10 rounded-md bg-gray-200" />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="h-px flex-1 bg-gray-200" />
                                        <span className="text-gray-400">or</span>
                                        <div className="h-px flex-1 bg-gray-200" />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="h-10 rounded-md bg-gray-200" />
                                        <div className="h-10 rounded-md bg-gray-200" />
                                        <div className="h-10 rounded-md bg-gray-200" />
                                    </div>
                                </div>
                                {/* Clerk CAPTCHA element */}
                                <div
                                    id="clerk-captcha"
                                    style={{ display: 'none' }}
                                />
                            </div>

                            <div className="text-center">
                                <p className="text-gray-600">
                                    {t('admin-auth.signin.dontHaveAccount')}{' '}
                                    <Link
                                        to="/auth/signup"
                                        className="font-medium text-cyan-600 transition-colors hover:text-cyan-500"
                                    >
                                        {t('admin-auth.signin.signUpLink')}
                                    </Link>
                                </p>
                                {/* Debug button - remove in production */}
                                <div className="mt-4">
                                    <button
                                        onClick={handleClearSession}
                                        className="rounded bg-yellow-500 px-2 py-1 text-white text-xs hover:bg-yellow-600"
                                        type="button"
                                        title={t('ui.accessibility.clearAllSessionsAndReload')}
                                    >
                                        {t('admin-auth.signin.clearSession')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100">
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
                    <div className="absolute bottom-8 left-8 text-white">
                        <h2 className="mb-2 font-bold text-3xl">Welcome back</h2>
                        <p className="text-cyan-100">Manage your accommodations with ease</p>
                        {backgroundImage && (
                            <p className="mt-1 text-cyan-200 text-sm opacity-80">
                                {backgroundImage.location}
                            </p>
                        )}
                    </div>
                </div>

                {/* Right side - Form */}
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
                            <h1 className="font-bold text-3xl text-gray-900">Sign in</h1>
                            <p className="mt-2 text-gray-600">
                                Welcome back! Please sign in to your account
                            </p>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
                            <SignInForm
                                onSynced={() => router.navigate({ to: redirect })}
                                apiBaseUrl={import.meta.env.VITE_API_URL}
                            />
                            {/* Clerk CAPTCHA element */}
                            <div
                                id="clerk-captcha"
                                style={{ display: 'none' }}
                            />
                        </div>

                        <div className="text-center">
                            <p className="text-gray-600">
                                Don't have an account?{' '}
                                <Link
                                    to="/auth/signup"
                                    className="font-medium text-cyan-600 transition-colors hover:text-cyan-500"
                                >
                                    Sign up
                                </Link>
                            </p>
                            {/* Debug button - remove in production */}
                            <div className="mt-4">
                                <button
                                    onClick={handleClearSession}
                                    className="rounded bg-yellow-500 px-2 py-1 text-white text-xs hover:bg-yellow-600"
                                    type="button"
                                    title="Clear all sessions and reload page"
                                >
                                    {t('ui.actions.clearSession')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
