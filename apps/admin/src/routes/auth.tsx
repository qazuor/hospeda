import { useTranslations } from '@/hooks/use-translations';
import { getAuth } from '@clerk/tanstack-react-start/server';
import { Link, Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getWebRequest } from '@tanstack/react-start/server';

/**
 * Server function to check if user is already authenticated
 * If authenticated, they should be redirected to dashboard
 */
const checkAlreadyAuthenticated = createServerFn({ method: 'GET' }).handler(async () => {
    const request = getWebRequest();
    if (!request) {
        return { isAuthenticated: false };
    }

    const { userId } = await getAuth(request);

    return {
        userId,
        isAuthenticated: !!userId
    };
});

/**
 * NotFoundComponent for auth routes
 * Shows a minimal 404 for routes under /auth that don't exist
 */
function AuthNotFoundComponent() {
    const { t } = useTranslations();

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100">
            <div className="text-center">
                <div className="mb-4">
                    <h1 className="font-bold text-6xl text-gray-200">404</h1>
                </div>
                <h2 className="mb-2 font-semibold text-gray-900 text-xl">
                    {t('ui.errors.pageNotFound')}
                </h2>
                <p className="mb-6 text-gray-600">{t('ui.errors.pageNotFoundDescription')}</p>
                <div className="space-x-4">
                    <Link
                        to="/auth/signin"
                        className="inline-flex items-center rounded-md bg-cyan-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
                    >
                        Sign In
                    </Link>
                    <button
                        type="button"
                        onClick={() => {
                            if (typeof window !== 'undefined') {
                                window.history.back();
                            }
                        }}
                        className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
                    >
                        {t('ui.actions.goBack')}
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Auth Layout Route
 * Provides a minimal layout for authentication pages (signin, signup)
 * Redirects to dashboard if user is already authenticated
 */
export const Route = createFileRoute('/auth')({
    beforeLoad: async () => {
        const authState = await checkAlreadyAuthenticated();

        // If already authenticated, redirect to dashboard
        if (authState.isAuthenticated) {
            throw redirect({
                to: '/'
            });
        }

        return authState;
    },
    component: AuthLayout,
    notFoundComponent: AuthNotFoundComponent
});

/**
 * AuthLayout Component
 * Minimal layout without sidebar for auth pages
 * Just renders the child route content
 */
function AuthLayout() {
    return <Outlet />;
}
