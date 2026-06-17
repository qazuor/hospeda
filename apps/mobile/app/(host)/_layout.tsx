import { Stack } from 'expo-router';

/**
 * Host group layout for the Hospeda mobile app (SPEC-243 T-005 placeholder).
 *
 * Wraps host routes in a Stack navigator. Real tab navigation and screens
 * will be built in Sub-1+ tasks.
 *
 * Expo Router requires a **default export** for route files — this is the
 * one legitimate exception to the named-export-only rule (see CLAUDE.md).
 */
export default function HostLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}
