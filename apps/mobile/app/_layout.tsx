import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { queryClient } from '../src/lib/api/query-client';
import { useSession } from '../src/lib/auth-client';
import { resolveAuthGroup } from '../src/lib/auth/roles';
import { validateEnv } from '../src/lib/env';
import { usePushRegistration } from '../src/lib/push/use-push-registration';

/**
 * Root layout for the Hospeda mobile app.
 *
 * Expo Router requires a default export for the root `_layout.tsx`.
 *
 * ## Responsibilities
 * 1. Wraps all routes in `QueryClientProvider` (TanStack Query singleton).
 * 2. Holds the splash screen until the Better Auth session is resolved.
 * 3. Implements the role-gated navigation gate (T-005):
 *    - While `isPending` → render nothing (splash stays visible).
 *    - No session → redirect to `(auth)/sign-in`.
 *    - Authenticated + host role → redirect to `(host)`.
 *    - Authenticated + any other role → redirect to `(tourist)`.
 *
 * ## Session restore / redirect logic
 *
 * The gate uses the effect-based pattern with `useSegments` + `router.replace()`
 * (canonical expo-router auth pattern). This fires on BOTH cold launch (session
 * restored from SecureStore by Better Auth) AND post-sign-in / post-sign-out
 * transitions (useSession re-renders when `data` changes).
 *
 * ### Cold launch
 * 1. App starts → `isPending = true` → return null (splash stays).
 * 2. Better Auth reads SecureStore → resolves session.
 * 3. `isPending` → false → effect fires → splash hidden → redirect to correct group.
 *
 * ### Post-sign-in
 * 1. User submits sign-in form → Better Auth calls the API.
 * 2. On success → `useSession().data` updates → this effect re-fires.
 * 3. User is now in `(auth)` group → effect redirects to `(host)` or `(tourist)`.
 *
 * ### Post-sign-out
 * 1. User presses Sign out → Better Auth clears the session.
 * 2. `useSession().data` → null → effect fires → redirect to `(auth)/sign-in`.
 *
 * ## SplashScreen
 * `preventAutoHideAsync()` is called at module scope (outside any component)
 * so Expo holds the splash before the first render. `hideAsync()` is called
 * only after `isPending === false` to avoid a flash of blank screen.
 *
 * @module _layout
 */
// Fail loud at startup on missing required env (e.g. EXPO_PUBLIC_API_URL in
// production). No-op under NODE_ENV=test.
validateEnv();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const { data, isPending } = useSession();
    const segments = useSegments();
    const router = useRouter();

    // Register push token once the session is resolved and a user is present.
    // Runs in the background — never blocks navigation or rendering.
    const hasSession = !isPending && data !== null && data !== undefined;
    usePushRegistration(hasSession);

    useEffect(() => {
        // Do nothing while session is still being restored from SecureStore.
        if (isPending) return;

        // Session resolved — hide the splash screen.
        SplashScreen.hideAsync();

        const hasSession = data !== null && data !== undefined;

        // Determine which group the user currently occupies.
        // segments[0] is the top-level route group, e.g. '(auth)', '(host)', '(tourist)', 'index'.
        const currentGroup = segments[0] as string | undefined;

        if (!hasSession) {
            // Unauthenticated: ensure user is in (auth) group.
            if (currentGroup !== '(auth)') {
                router.replace('/(auth)/sign-in');
            }
            return;
        }

        // Authenticated: compute the target group.
        // `data.user` comes from Better Auth's `useSession()`. The server is
        // configured with `additionalFields: { role: { type: 'string' } }` but
        // the Better Auth React client type does not expose additional fields in
        // its inferred shape. We access `role` via an index signature cast — this
        // is safe because the field is always populated by the server (default
        // `USER` on sign-up), and our `resolveAuthGroup` handles null/undefined
        // gracefully.
        const userWithRole = data.user as typeof data.user & { role?: string };
        const targetGroup = resolveAuthGroup(userWithRole.role, true);

        // Only redirect if the user is currently in (auth) or at the root index
        // (segments[0] === undefined covers the bare '/' / 'index' route).
        // This guards against redirect loops when the user is already in the
        // correct group.
        const isInAuthGroup = currentGroup === '(auth)';
        const isAtRootIndex = currentGroup === undefined || currentGroup === 'index';

        if (isInAuthGroup || isAtRootIndex) {
            router.replace(`/${targetGroup}` as `/${typeof targetGroup}`);
        }
    }, [isPending, data, segments, router]);

    // While the session is pending, render nothing — the splash screen stays
    // visible (held by preventAutoHideAsync).
    if (isPending) return null;

    return (
        <QueryClientProvider client={queryClient}>
            <Stack screenOptions={{ headerShown: false }}>
                {/* Loading gate — root effect redirects away immediately */}
                <Stack.Screen name="index" />
                {/* Auth group: sign-in + sign-up */}
                <Stack.Screen name="(auth)" />
                {/* Tourist shell: logged-in users that are not host/admin */}
                <Stack.Screen name="(tourist)" />
                {/* Host shell: HOST, ADMIN, SUPER_ADMIN */}
                <Stack.Screen name="(host)" />
            </Stack>
        </QueryClientProvider>
    );
}
