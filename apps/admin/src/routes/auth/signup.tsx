import { useTranslations } from '@/hooks/use-translations';
import { SignUpForm } from '@repo/auth-ui';
import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { type AuthBackgroundImage, getRandomAuthImage } from '../../utils/auth-images';

export const Route = createFileRoute('/auth/signup')({
    component: SignUpPage
});

function SignUpPage(): React.JSX.Element {
    const router = useRouter();
    const { t } = useTranslations();
    const redirect =
        (router.state.location.search as Record<string, string | undefined>)?.redirect || '/';

    const [isClient, setIsClient] = useState(false);
    const [backgroundImage, setBackgroundImage] = useState<AuthBackgroundImage | null>(null);

    useEffect(() => {
        setIsClient(true);
        setBackgroundImage(getRandomAuthImage());
    }, []);

    if (!isClient) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-cyan-50 to-teal-100">
                <div className="flex min-h-screen">
                    {/* Left side - Image */}
                    <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
                        <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/50 to-cyan-600/30" />
                        <div className="h-full w-full animate-pulse bg-gradient-to-br from-emerald-200 to-cyan-200" />
                        <div className="absolute bottom-8 left-8 text-white">
                            <h2 className="mb-2 font-bold text-3xl">
                                {t('admin-auth.signup.joinToday')}
                            </h2>
                            <p className="text-emerald-100">
                                {t('admin-auth.signup.startManaging')}
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
                                    {t('admin-auth.signup.heading')}
                                </h1>
                                <p className="mt-2 text-gray-600">
                                    {t('admin-auth.signup.subtitle')}
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
                                    {t('admin-auth.signup.alreadyHaveAccount')}{' '}
                                    <Link
                                        to="/auth/signin"
                                        className="font-medium text-emerald-600 transition-colors hover:text-emerald-500"
                                    >
                                        {t('admin-auth.signup.signInLink')}
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
                            <SignUpForm
                                onSynced={() => router.navigate({ to: redirect })}
                                apiBaseUrl={import.meta.env.VITE_ADMIN_API_BASE_URL}
                            />
                            {/* Clerk CAPTCHA element */}
                            <div
                                id="clerk-captcha"
                                style={{ display: 'none' }}
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
