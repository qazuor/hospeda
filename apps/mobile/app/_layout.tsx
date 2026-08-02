import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { queryClient } from '../src/lib/api/query-client';
import type { SessionStatus } from '../src/lib/auth/roles';
import { resolveAuthGroup } from '../src/lib/auth/roles';
import { useActorRoles } from '../src/lib/auth/use-actor-roles';
import { useSession } from '../src/lib/auth-client';
import { validateEnv } from '../src/lib/env';
import { LocaleProvider } from '../src/lib/locale-context';
import { usePushRegistration } from '../src/lib/push/use-push-registration';

/**
 * Root layout for the Hospeda mobile app.
 *
 * Expo Router requires a default export for the root `_layout.tsx`.
 *
 * ## Responsibilities
 * 1. Wraps all routes in `QueryClientProvider` (TanStack Query singleton) and
 *    `LocaleProvider`.
 * 2. Renders {@link RootNavigationGate}, which holds the splash screen until
 *    BOTH the Better Auth session and the actor's role set have resolved, then
 *    redirects to the right group.
 *
 * ## Why the providers wrap the gate (HOS-296)
 *
 * The gate now needs the role set, which comes from `GET /api/v1/public/auth/me`
 * through TanStack Query (see `useActorRoles`). A hook cannot consume a
 * provider its own component renders, so the gate had to move one level down.
 * That is the only structural change here; the redirect semantics are described
 * on the gate itself.
 *
 * ## SplashScreen
 * `preventAutoHideAsync()` is called at module scope (outside any component)
 * so Expo holds the splash before the first render. `hideAsync()` is called
 * only once the target group is known, to avoid a flash of blank screen — and,
 * more importantly, a flash of the WRONG shell.
 *
 * @module _layout
 */
// Fail loud at startup on missing required env (e.g. EXPO_PUBLIC_API_URL in
// production). No-op under NODE_ENV=test.
validateEnv();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    return (
        <LocaleProvider>
            <QueryClientProvider client={queryClient}>
                <RootNavigationGate />
            </QueryClientProvider>
        </LocaleProvider>
    );
}

/**
 * Role-gated navigation gate (SPEC-243 T-005, reworked for HOS-296).
 *
 * ## Session + roles resolution
 *
 * Two independent async sources have to settle before a destination exists:
 *
 * 1. The Better Auth session, restored from SecureStore by `useSession()`.
 * 2. The actor's ROLE SET, fetched from `/auth/me` by `useActorRoles()`.
 *    Before HOS-296 this was a scalar `role` riding along on the session, so
 *    there was only ever one thing to wait for. `users.role` no longer exists
 *    and Better Auth's `additionalFields` cannot carry a related table, so the
 *    set arrives out of band.
 *
 * `resolveAuthGroup` returns `null` while either is unsettled. `null` means
 * "navigate nowhere and keep the splash up" — NOT "assume tourist". Falling
 * through to `(tourist)` during the load is the same defect as reading an
 * `undefined` role: a host would be shown the tourist shell.
 *
 * ## Redirect rule
 *
 * Redirect whenever the current top-level group differs from the target. The
 * pre-HOS-296 gate only redirected out of `(auth)` and the root index, which
 * was sufficient while the role was known synchronously and could never change
 * mid-session. It is not sufficient now: an actor placed in `(tourist)` by the
 * `/auth/me` failure fallback must be promoted to `(host)` when a later
 * refetch succeeds (TanStack Query refetches on reconnect). A user already
 * deep inside the correct group — e.g. `(host)/accommodations/[id]` — matches
 * on `segments[0]` and is left alone.
 *
 * ### Cold launch
 * 1. App starts → session `loading` → group `null` → render nothing (splash stays).
 * 2. Session resolves → `/auth/me` fires → roles `loading` → still `null`.
 * 3. Roles resolve → group known → splash hidden → redirect to the right group.
 *
 * ### Post-sign-in / post-sign-out
 * `useSession()` re-renders on both; `useActorRoles` is keyed by user id and
 * drops its cache when the id disappears, so the next sign-in always re-reads
 * the set instead of serving the previous one.
 */
function RootNavigationGate() {
    const { data, isPending } = useSession();
    const segments = useSegments();
    const router = useRouter();

    const sessionStatus: SessionStatus = isPending
        ? 'loading'
        : data !== null && data !== undefined
          ? 'authenticated'
          : 'unauthenticated';

    const userId = sessionStatus === 'authenticated' ? data?.user.id : undefined;

    // Register push token once the session is resolved and a user is present.
    // Runs in the background — never blocks navigation or rendering.
    usePushRegistration(sessionStatus === 'authenticated');

    const { roles, status: rolesStatus } = useActorRoles({ userId });
    const { group } = resolveAuthGroup({ sessionStatus, rolesStatus, roles });

    useEffect(() => {
        // Undecided: session and/or roles still in flight. Hold the splash and
        // navigate nowhere.
        if (group === null) return;

        // Destination known — hide the splash screen.
        SplashScreen.hideAsync();

        // segments[0] is the top-level route group, e.g. '(auth)', '(host)',
        // '(tourist)', or undefined at the bare '/' route.
        const currentGroup = segments[0] as string | undefined;
        if (currentGroup === group) return;

        if (group === '(auth)') {
            router.replace('/(auth)/sign-in');
            return;
        }
        router.replace(`/${group}` as `/${typeof group}`);
    }, [group, segments, router]);

    // While the destination is undecided, render nothing — the splash screen
    // stays visible (held by preventAutoHideAsync).
    if (group === null) return null;

    return (
        <Stack screenOptions={{ headerShown: false }}>
            {/* Loading gate — root effect redirects away immediately */}
            <Stack.Screen name="index" />
            {/* Auth group: sign-in + sign-up */}
            <Stack.Screen name="(auth)" />
            {/* Tourist shell: logged-in users holding no host role */}
            <Stack.Screen name="(tourist)" />
            {/* Host shell: actors holding HOST, ADMIN or SUPER_ADMIN */}
            <Stack.Screen name="(host)" />
        </Stack>
    );
}
