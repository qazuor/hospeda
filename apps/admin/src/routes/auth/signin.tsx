import { signIn } from '@/lib/auth-client';
import { LoaderIcon } from '@repo/icons';
import { Link, createFileRoute } from '@tanstack/react-router';
import { type FormEvent, useEffect, useState } from 'react';
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
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    return null;
}

/**
 * SignIn Route
 * Uses Better Auth email/password sign-in
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
    const { isSyncing, canRedirectToProtected, syncError } = useAuthSync();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        setIsClient(true);
        setBackgroundImage(getRandomAuthImage());
    }, []);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setFormError(null);
        setIsSubmitting(true);

        try {
            const result = await signIn.email({
                email,
                password
            });

            if (result.error) {
                setFormError(result.error.message || 'Sign in failed');
                return;
            }

            // Redirect to dashboard on success
            if (typeof window !== 'undefined') {
                window.location.href = '/dashboard';
            }
        } catch (error) {
            setFormError(error instanceof Error ? error.message : 'An unexpected error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            await signIn.social({
                provider: 'google',
                callbackURL: `${window.location.origin}/dashboard`
            });
        } catch (error) {
            setFormError(error instanceof Error ? error.message : 'Google sign in failed');
        }
    };

    // Show loading state while checking session
    if (isSyncing) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100">
                <div className="flex min-h-screen items-center justify-center">
                    <div className="text-center">
                        <div className="mb-4">
                            <LoaderIcon className="mx-auto h-12 w-12 animate-spin text-cyan-600" />
                        </div>
                        <h2 className="font-semibold text-gray-900 text-xl">Checking session...</h2>
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
                        <h2 className="font-semibold text-gray-900 text-xl">
                            Authentication Error
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
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Already authenticated, redirect
    if (canRedirectToProtected) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100">
                <div className="flex min-h-screen items-center justify-center">
                    <div className="text-center">
                        <div className="mb-4">
                            <LoaderIcon className="mx-auto h-12 w-12 animate-spin text-cyan-600" />
                        </div>
                        <h2 className="font-semibold text-gray-900 text-xl">Redirecting...</h2>
                        <p className="mt-2 text-gray-600">You are already authenticated</p>
                        <AutoRedirect />
                    </div>
                </div>
            </div>
        );
    }

    if (!isClient) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100">
                <div className="flex min-h-screen">
                    <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
                        <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/50 to-emerald-600/30" />
                        <div className="h-full w-full animate-pulse bg-gradient-to-br from-cyan-200 to-emerald-200" />
                    </div>
                    <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
                        <div className="w-full max-w-md">
                            <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
                                <div className="animate-pulse space-y-4">
                                    <div className="h-10 rounded-md bg-gray-200" />
                                    <div className="h-10 rounded-md bg-gray-200" />
                                    <div className="h-10 rounded-md bg-gray-200" />
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
                            <form
                                onSubmit={handleSubmit}
                                className="space-y-4"
                            >
                                {formError && (
                                    <div className="rounded-md bg-red-50 p-3 text-red-700 text-sm">
                                        {formError}
                                    </div>
                                )}

                                <div>
                                    <label
                                        htmlFor="email"
                                        className="block font-medium text-gray-700 text-sm"
                                    >
                                        Email
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                        placeholder="you@example.com"
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="password"
                                        className="block font-medium text-gray-700 text-sm"
                                    >
                                        Password
                                    </label>
                                    <input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                        placeholder="Enter your password"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full rounded-md bg-cyan-600 px-4 py-2 font-medium text-white transition-colors hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Signing in...' : 'Sign in'}
                                </button>
                            </form>

                            <div className="my-4 flex items-center gap-3">
                                <div className="h-px flex-1 bg-gray-200" />
                                <span className="text-gray-400 text-sm">or</span>
                                <div className="h-px flex-1 bg-gray-200" />
                            </div>

                            <button
                                type="button"
                                onClick={handleGoogleSignIn}
                                className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-50"
                            >
                                <svg
                                    className="h-5 w-5"
                                    viewBox="0 0 24 24"
                                    role="img"
                                    aria-hidden="true"
                                >
                                    <path
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                                        fill="#4285F4"
                                    />
                                    <path
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        fill="#34A853"
                                    />
                                    <path
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        fill="#FBBC05"
                                    />
                                    <path
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        fill="#EA4335"
                                    />
                                </svg>
                                Continue with Google
                            </button>
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
