import { useTranslations } from '@/hooks/use-translations';
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
    const { t } = useTranslations();
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
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-cyan-50 to-teal-100 dark:from-emerald-950 dark:via-cyan-950 dark:to-teal-950">
                <div className="flex min-h-screen items-center justify-center">
                    <div className="text-center">
                        <div className="mb-4">
                            <LoaderIcon className="mx-auto h-12 w-12 animate-spin text-primary" />
                        </div>
                        <h2 className="font-semibold text-foreground text-xl">
                            {t('admin-pages.auth.signup.checkingSession')}
                        </h2>
                    </div>
                </div>
            </div>
        );
    }

    // Don't show sign-up form if user is already signed in
    if (!shouldShowSignIn) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-cyan-50 to-teal-100 dark:from-emerald-950 dark:via-cyan-950 dark:to-teal-950">
                <div className="flex min-h-screen items-center justify-center">
                    <div className="text-center">
                        <div className="mb-4">
                            <LoaderIcon className="mx-auto h-12 w-12 animate-spin text-primary" />
                        </div>
                        <h2 className="font-semibold text-foreground text-xl">
                            {t('admin-pages.auth.signup.redirecting')}
                        </h2>
                        <p className="mt-2 text-muted-foreground">
                            {t('admin-pages.auth.signup.alreadyAuthenticated')}
                        </p>
                        <AutoRedirect />
                    </div>
                </div>
            </div>
        );
    }

    if (!isClient) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-cyan-50 to-teal-100 dark:from-emerald-950 dark:via-cyan-950 dark:to-teal-950">
                <div className="flex min-h-screen">
                    <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
                        <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/50 to-cyan-600/30" />
                        <div className="h-full w-full animate-pulse bg-gradient-to-br from-emerald-200 to-cyan-200" />
                    </div>
                    <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
                        <div className="w-full max-w-md">
                            <div className="rounded-xl border bg-card p-8 shadow-lg">
                                <div className="animate-pulse space-y-4">
                                    <div className="h-10 rounded-md bg-muted" />
                                    <div className="h-10 rounded-md bg-muted" />
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
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-cyan-50 to-teal-100 dark:from-emerald-950 dark:via-cyan-950 dark:to-teal-950">
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
                        <h2 className="mb-2 font-bold text-3xl">
                            {t('admin-pages.auth.signup.joinUs')}
                        </h2>
                        <p className="text-emerald-100 dark:text-emerald-300">
                            {t('admin-pages.auth.signup.startManaging')}
                        </p>
                        {backgroundImage && (
                            <p className="mt-1 text-emerald-200 text-sm opacity-80 dark:text-emerald-400">
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
                            <h1 className="font-bold text-3xl text-foreground">
                                {t('admin-pages.auth.signup.title')}
                            </h1>
                            <p className="mt-2 text-muted-foreground">
                                {t('admin-pages.auth.signup.subtitle')}
                            </p>
                        </div>

                        <div className="rounded-xl border bg-card p-8 shadow-lg">
                            <form
                                onSubmit={handleSubmit}
                                className="space-y-4"
                            >
                                {formError && (
                                    <div className="rounded-md bg-destructive/5 p-3 text-destructive text-sm">
                                        {formError}
                                    </div>
                                )}

                                <div>
                                    <label
                                        htmlFor="name"
                                        className="block font-medium text-foreground text-sm"
                                    >
                                        {t('admin-pages.auth.signup.nameLabel')}
                                    </label>
                                    <input
                                        id="name"
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                        placeholder={t('admin-pages.auth.signup.namePlaceholder')}
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="email"
                                        className="block font-medium text-foreground text-sm"
                                    >
                                        {t('admin-pages.auth.signup.emailLabel')}
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                        placeholder={t('admin-pages.auth.signup.emailPlaceholder')}
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="password"
                                        className="block font-medium text-foreground text-sm"
                                    >
                                        {t('admin-pages.auth.signup.passwordLabel')}
                                    </label>
                                    <input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={8}
                                        className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                        placeholder={t(
                                            'admin-pages.auth.signup.passwordPlaceholder'
                                        )}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSubmitting
                                        ? t('admin-pages.auth.signup.submittingButton')
                                        : t('admin-pages.auth.signup.submitButton')}
                                </button>
                            </form>
                        </div>

                        <div className="text-center">
                            <p className="text-muted-foreground">
                                {t('admin-pages.auth.signup.hasAccount')}{' '}
                                <Link
                                    to="/auth/signin"
                                    className="font-medium text-primary transition-colors hover:text-primary/80"
                                >
                                    {t('admin-pages.auth.signup.signInLink')}
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
