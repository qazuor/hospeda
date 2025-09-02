import { AppLayout } from '@/components/layout/AppLayout';
import { useTranslations } from '@/hooks/use-translations';
import { getAuth } from '@clerk/tanstack-react-start/server';
import { Link, Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getWebRequest } from '@tanstack/react-start/server';

/**
 * Server function to check authentication
 * This runs on the server before the route loads
 */
const fetchAuthState = createServerFn({ method: 'GET' }).handler(async () => {
    const request = getWebRequest();
    if (!request) {
        throw new Error('No request found');
    }

    const { userId } = await getAuth(request);

    return {
        userId,
        isAuthenticated: !!userId
    };
});

/**
 * NotFoundComponent for authenticated routes
 * Renders a 404 page within the authenticated layout
 */
function AuthedNotFoundComponent() {
    const { t } = useTranslations();

    return (
        <div className="flex min-h-[60vh] items-center justify-center">
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
                        to="/"
                        className="inline-flex items-center rounded-md bg-cyan-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
                    >
                        {t('ui.actions.goBackHome')}
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
 * Protected Layout Route
 * All routes under this layout require authentication
 * Automatically applies AppLayout to all child routes
 */
export const Route = createFileRoute('/_authed')({
    beforeLoad: async () => {
        const authState = await fetchAuthState();

        // If not authenticated, redirect to signin
        if (!authState.isAuthenticated) {
            throw redirect({
                to: '/auth/signin',
                search: {
                    redirect: typeof window !== 'undefined' ? window.location.pathname : '/'
                }
            });
        }

        return authState;
    },
    component: AuthedLayout,
    notFoundComponent: AuthedNotFoundComponent
});

/**
 * AuthedLayout Component
 * Wraps all authenticated routes with AppLayout
 */
function AuthedLayout() {
    return (
        <AppLayout>
            <Outlet />
        </AppLayout>
    );
}
