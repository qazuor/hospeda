import { useAuth, useSignUp } from '@clerk/clerk-react';
import { useState } from 'react';

type Props = {
    onSynced?: (dbUserId: string) => void;
    apiBaseUrl?: string;
    redirectTo?: string;
    refreshAuthContext?: () => Promise<void>; // optional auth context refresh
};

export const SignUpForm = ({ onSynced, apiBaseUrl, redirectTo, refreshAuthContext }: Props) => {
    const { isLoaded, signUp, setActive } = useSignUp();
    const { isSignedIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isLoaded) {
        return (
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <div className="flex w-full items-center justify-center rounded-md border px-4 py-2 text-sm">
                        Loading...
                    </div>
                    <div className="flex w-full items-center justify-center rounded-md border px-4 py-2 text-sm">
                        Loading...
                    </div>
                </div>
                <div className="flex items-center gap-3 text-center text-muted-foreground text-xs">
                    <div className="h-px flex-1 bg-border" />
                    <span>or</span>
                    <div className="h-px flex-1 bg-border" />
                </div>
                <div className="flex flex-col gap-3">
                    <div className="h-10 rounded border bg-gray-50" />
                    <div className="h-10 rounded border bg-gray-50" />
                    <div className="h-10 rounded bg-gray-200" />
                </div>
            </div>
        );
    }

    const syncAndRedirect = async () => {
        const base = apiBaseUrl ?? window.location.origin;
        const r = await fetch(`${base}/api/v1/public/auth/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        const json = await r.json();
        const dbUserId: string | undefined = json?.data?.user?.id;

        // Refresh auth context if available
        if (refreshAuthContext) {
            try {
                await refreshAuthContext();
            } catch (error) {
                console.warn('Failed to refresh auth context:', error);
            }
        }

        if (dbUserId && onSynced) onSynced(dbUserId);
        if (redirectTo) window.location.replace(redirectTo);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            await signUp.create({ emailAddress: email, password });
            const res = await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
            if (res.status !== 'complete') {
                setError('Verification required. Please check your email.');
                return;
            }
            await setActive({ session: res.createdSessionId });
            await syncAndRedirect();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    };

    const handleOauth = async (provider: 'oauth_google' | 'oauth_facebook') => {
        try {
            // Check if already signed in
            if (isSignedIn) {
                console.warn('User is already signed in, redirecting...');
                await syncAndRedirect();
                return;
            }

            setIsLoading(true);
            setError('');

            const redirect = redirectTo ?? window.location.pathname ?? '/';
            await signUp.authenticateWithRedirect({
                strategy: provider,
                redirectUrl: '/auth/callback',
                redirectUrlComplete: redirect
            });
        } catch (err) {
            console.error('OAuth error:', err);

            // Handle specific error cases
            if (err instanceof Error) {
                if (err.message.includes('already signed in')) {
                    await syncAndRedirect();
                    return;
                }
                setError(`OAuth authentication failed: ${err.message}`);
            } else {
                setError('OAuth authentication failed. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
                <button
                    type="button"
                    aria-label="Sign up with Google"
                    onClick={() => void handleOauth('oauth_google')}
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-4 font-medium text-gray-700 text-sm shadow-sm transition-all duration-200 hover:border-gray-400 hover:bg-gray-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                    </svg>
                    Sign up with Google
                </button>
                <button
                    type="button"
                    aria-label="Sign up with Facebook"
                    onClick={() => void handleOauth('oauth_facebook')}
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-3 rounded-lg border border-blue-600 px-4 py-4 font-medium text-sm text-white shadow-sm transition-all duration-200 hover:border-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: '#1877F2' }}
                >
                    <svg
                        className="h-5 w-5"
                        fill="white"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Sign up with Facebook
                </button>
            </div>

            <div className="flex items-center gap-3 text-center text-muted-foreground text-xs">
                <div className="h-px flex-1 bg-border" />
                <span>or</span>
                <div className="h-px flex-1 bg-border" />
            </div>

            <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-4"
            >
                <div className="space-y-1">
                    <label
                        htmlFor="signup-email"
                        className="block font-medium text-gray-700 text-sm"
                    >
                        Email address
                    </label>
                    <input
                        id="signup-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="w-full rounded-lg border border-gray-300 px-4 py-4 text-sm transition-colors placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                        required
                        autoComplete="email"
                    />
                </div>
                <div className="space-y-1">
                    <label
                        htmlFor="signup-password"
                        className="block font-medium text-gray-700 text-sm"
                    >
                        Password
                    </label>
                    <input
                        id="signup-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a password"
                        className="w-full rounded-lg border border-gray-300 px-4 py-4 text-sm transition-colors placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                        required
                        autoComplete="new-password"
                    />
                </div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full rounded-lg px-4 py-4 font-medium text-sm text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                        background: 'linear-gradient(to right, #059669, #0891b2)',
                        borderColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                        if (!isLoading) {
                            e.currentTarget.style.background =
                                'linear-gradient(to right, #047857, #0e7490)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isLoading) {
                            e.currentTarget.style.background =
                                'linear-gradient(to right, #059669, #0891b2)';
                        }
                    }}
                >
                    {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg
                                className="h-4 w-4 animate-spin"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    fill="none"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                            </svg>
                            Creating account…
                        </span>
                    ) : (
                        'Create account'
                    )}
                </button>
                {error && (
                    <div
                        className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-600 text-sm"
                        role="alert"
                    >
                        {error}
                    </div>
                )}
            </form>
        </div>
    );
};
