import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { queryClient } from '../src/lib/api/query-client';

/**
 * Root layout for the Hospeda mobile app.
 *
 * Expo Router requires a default export for the root `_layout.tsx`.
 * This wraps all routes in a Stack navigator. Role-gated navigation
 * (tourist vs host tab navigators) will be added in T-005, after the
 * Better Auth spike (T-003) and auth screens (T-004).
 *
 * SplashScreen is hidden after the first effect fires. In later tasks
 * this will be deferred until the auth session is restored (T-005).
 *
 * ## QueryClientProvider
 *
 * The `QueryClientProvider` wraps the entire navigator so every route and
 * component can call `useQuery` / `useMutation` via `useApiQuery` /
 * `useApiMutation` (defined in `src/lib/api/use-api-query.ts`).
 *
 * We use the module-level `queryClient` singleton from `query-client.ts`.
 * React Native has no SSR, so a singleton is safe here — unlike TanStack
 * Start (admin app), which uses a per-request `useState` initializer to
 * isolate caches across server renders.
 */
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    useEffect(() => {
        SplashScreen.hideAsync();
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <Stack>
                <Stack.Screen
                    name="index"
                    options={{ title: 'Hospeda', headerShown: false }}
                />
            </Stack>
        </QueryClientProvider>
    );
}
