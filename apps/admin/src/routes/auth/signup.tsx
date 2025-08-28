import { SignUp } from '@clerk/tanstack-react-start';
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
 * SignUp Route
 * Uses Clerk's official SignUp component for TanStack Start
 * Following the official TanStack + Clerk pattern
 */
export const Route = createFileRoute('/auth/signup')({
    component: SignUpPage
});

/**
 * SignUpPage Component
 * Layout with image on left and form on right
 */
function SignUpPage(): React.JSX.Element {
    const [isClient, setIsClient] = useState(false);
    const [backgroundImage, setBackgroundImage] = useState<AuthBackgroundImage | null>(null);
    const { isSyncing, shouldShowSignIn } = useAuthSync();

    useEffect(() => {
        setIsClient(true);
        setBackgroundImage(getRandomAuthImage());
    }, []);

    // Show loading state while syncing
    if (isSyncing) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-cyan-50 to-teal-100">
                <div className="flex min-h-screen items-center justify-center">
                    <div className="text-center">
                        <div className="mb-4">
                            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
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

    // Don't show sign-up form if user is already signed in
    if (!shouldShowSignIn) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-cyan-50 to-teal-100">
                <div className="flex min-h-screen items-center justify-center">
                    <div className="text-center">
                        <div className="mb-4">
                            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
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
                                className="text-emerald-600 underline hover:text-emerald-500"
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

    if (!isClient) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-cyan-50 to-teal-100">
                <div className="flex min-h-screen">
                    {/* Left side - Image */}
                    <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
                        <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/50 to-cyan-600/30" />
                        <div className="h-full w-full animate-pulse bg-gradient-to-br from-emerald-200 to-cyan-200" />
                        <div className="absolute bottom-8 left-8 text-white">
                            <h2 className="mb-2 font-bold text-3xl">Join us today</h2>
                            <p className="text-emerald-100">Start managing your accommodations</p>
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
                                <h1 className="font-bold text-3xl text-gray-900">Create account</h1>
                                <p className="mt-2 text-gray-600">
                                    Get started with your free account today
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
                                    Already have an account?{' '}
                                    <Link
                                        to="/auth/signin"
                                        className="font-medium text-emerald-600 transition-colors hover:text-emerald-500"
                                    >
                                        Sign in
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
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-cyan-50 to-teal-100">
            <div className="flex min-h-screen">
                {/* Left side - Image */}
                <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/50 to-cyan-600/30" />
                    {backgroundImage && (
                        <img
                            src={backgroundImage.src}
                            alt={backgroundImage.alt}
                            className="h-full w-full object-cover"
                        />
                    )}
                    <div className="absolute bottom-8 left-8 text-white">
                        <h2 className="mb-2 font-bold text-3xl">Join us today</h2>
                        <p className="text-emerald-100">Start managing your accommodations</p>
                        {backgroundImage && (
                            <p className="mt-1 text-emerald-200 text-sm opacity-80">
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
                            <h1 className="font-bold text-3xl text-gray-900">Create account</h1>
                            <p className="mt-2 text-gray-600">
                                Get started with your free account today
                            </p>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
                            <SignUp
                                routing="path"
                                path="/auth/signup"
                                signInUrl="/auth/signin"
                                fallbackRedirectUrl="/dashboard"
                                forceRedirectUrl="/dashboard"
                            />
                        </div>

                        <div className="text-center">
                            <p className="text-gray-600">
                                Already have an account?{' '}
                                <Link
                                    to="/auth/signin"
                                    className="font-medium text-emerald-600 transition-colors hover:text-emerald-500"
                                >
                                    Sign in
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
