import { signUp } from '@/lib/auth-client';
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
 * SignUp Route
 * Uses Better Auth email/password sign-up
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

    const [name, setName] = useState('');
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
            const result = await signUp.email({
                email,
                password,
                name
            });

            if (result.error) {
                setFormError(result.error.message || 'Sign up failed');
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

    // Show loading state while checking session
    if (isSyncing) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-cyan-50 to-teal-100">
                <div className="flex min-h-screen items-center justify-center">
                    <div className="text-center">
                        <div className="mb-4">
                            <LoaderIcon className="mx-auto h-12 w-12 animate-spin text-emerald-600" />
                        </div>
                        <h2 className="font-semibold text-gray-900 text-xl">Checking session...</h2>
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
                            <LoaderIcon className="mx-auto h-12 w-12 animate-spin text-emerald-600" />
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
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-cyan-50 to-teal-100">
                <div className="flex min-h-screen">
                    <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
                        <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/50 to-cyan-600/30" />
                        <div className="h-full w-full animate-pulse bg-gradient-to-br from-emerald-200 to-cyan-200" />
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
                                        htmlFor="name"
                                        className="block font-medium text-gray-700 text-sm"
                                    >
                                        Full Name
                                    </label>
                                    <input
                                        id="name"
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        placeholder="John Doe"
                                    />
                                </div>

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
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                                        minLength={8}
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        placeholder="At least 8 characters"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Creating account...' : 'Create account'}
                                </button>
                            </form>
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
