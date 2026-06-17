import { Stack } from 'expo-router';

/**
 * Layout for the (auth) route group.
 *
 * Renders a Stack navigator without a header. Auth screens (sign-in, sign-up)
 * supply their own full-screen layout including the Hospeda brand mark.
 *
 * Expo Router requires a **default export** for route files — this is the
 * one legitimate exception to the named-export-only rule (see CLAUDE.md).
 *
 * T-005 will add role-gated redirect logic here (after session restore).
 * For now the group simply exposes the two auth routes as reachable screens.
 */
export default function AuthLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="sign-up" />
        </Stack>
    );
}
