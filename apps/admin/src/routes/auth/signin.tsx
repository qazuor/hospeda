import { SignIn } from '@clerk/tanstack-react-start';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useAuthSync } from '../../hooks/use-auth-sync';
import { type AuthBackgroundImage, getRandomAuthImage } from '../../utils/auth-images';

/**
 * AutoRedirect Component
 * Automatically redirects to dashboard after a delay
 */
function AutoRedirect() {
    useEffect(() => {
        const timer = setTimeout(() => {
            if (typeof window !== 'undefined') {
                window.location.href = '/dashboard';
            }
        }, 3000); // 3 seconds delay

        return () => clearTimeout(timer);
    }, []);

    return null;
}

/**
 * SignIn Route
 * Uses Clerk's official SignIn component for TanStack Start
 * Following the official TanStack + Clerk pattern
 */
export const Route = createFileRoute('/auth/signin')({
    component: SignInPage
});

/**
 * SignInPage Component
 * Layout with image on left and form on right
 */
function SignInPage(): React.JSX.Element {
    const [isClient, setIsClient] = useState(false);
    const [backgroundImage, setBackgroundImage] = useState<AuthBackgroundImage | null>(null);
    const { isSyncing, shouldShowSignIn, canRedirectToProtected, syncError } = useAuthSync();

    useEffect(() => {
        setIsClient(true);
        setBackgroundImage(getRandomAuthImage());
    }, []);

    // Show loading state while syncing
    if (isSyncing) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100">
                <div className="flex min-h-screen items-center justify-center">
                    <div className="text-center">
                        <div className="mb-4">
                            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-cyan-600 border-t-transparent" />
                        </div>
                        <h2 className="font-semibold text-gray-900 text-xl">
                            Sincronizando sesión...
                        </h2>
                        <p className="mt-2 text-gray-600">Verificando tu autenticación</p>
                    </div>
                </div>
            </div>
        );
    }

    // Show sync error if there was a problem
    if (syncError) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100">
                <div className="flex min-h-screen items-center justify-center">
                    <div className="text-center">
                        <div className="mb-4">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                                <svg
                                    className="h-6 w-6 text-red-600"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    role="img"
                                    aria-labelledby="error-icon-title"
                                >
                                    <title id="error-icon-title">Error</title>
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                </svg>
                            </div>
                        </div>
                        <h2 className="font-semibold text-gray-900 text-xl">
                            Error de autenticación
                        </h2>
                        <p className="mt-2 text-gray-600">{syncError}</p>
                        <button
                            type="button"
                            onClick={() => {
                                if (typeof window !== 'undefined') {
                                    window.location.reload();
                                }
                            }}
                            className="mt-4 rounded-md bg-cyan-600 px-4 py-2 text-white hover:bg-cyan-700"
                        >
                            Reintentar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Only redirect to protected routes AFTER sync has completed successfully
    if (canRedirectToProtected) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100">
                <div className="flex min-h-screen items-center justify-center">
                    <div className="text-center">
                        <div className="mb-4">
                            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-cyan-600 border-t-transparent" />
                        </div>
                        <h2 className="font-semibold text-gray-900 text-xl">Redirigiendo...</h2>
                        <p className="mt-2 text-gray-600">Ya estás autenticado</p>
                        <p className="mt-1 text-gray-500 text-sm">
                            Si no redirige automáticamente, haz clic{' '}
                            <button
                                type="button"
                                onClick={() => {
                                    if (typeof window !== 'undefined') {
                                        window.location.href = '/dashboard';
                                    }
                                }}
                                className="text-cyan-600 underline hover:text-cyan-500"
                            >
                                aquí
                            </button>
                        </p>
                        <AutoRedirect />
                    </div>
                </div>
            </div>
        );
    }

    // If user is signed in with Clerk but sync hasn't started yet, show syncing state
    // This handles the timing gap between Clerk auth and backend sync
    if (!shouldShowSignIn && !canRedirectToProtected && !isSyncing && !syncError) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100">
                <div className="flex min-h-screen items-center justify-center">
                    <div className="text-center">
                        <div className="mb-4">
                            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-cyan-600 border-t-transparent" />
                        </div>
                        <h2 className="font-semibold text-gray-900 text-xl">
                            Preparando sesión...
                        </h2>
                        <p className="mt-2 text-gray-600">Conectando con el servidor</p>
                    </div>
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
                            <h2 className="mb-2 font-bold text-3xl">Welcome back</h2>
                            <p className="text-cyan-100">Manage your accommodations with ease</p>
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
                            <SignIn
                                routing="path"
                                path="/auth/signin"
                                signUpUrl="/auth/signup"
                                fallbackRedirectUrl="/dashboard"
                                forceRedirectUrl="/dashboard"
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
