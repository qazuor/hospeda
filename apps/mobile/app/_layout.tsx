import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

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
 */
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    useEffect(() => {
        SplashScreen.hideAsync();
    }, []);

    return (
        <Stack>
            <Stack.Screen
                name="index"
                options={{ title: 'Hospeda', headerShown: false }}
            />
        </Stack>
    );
}
