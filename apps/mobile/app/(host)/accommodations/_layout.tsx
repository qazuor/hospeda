import { Stack } from 'expo-router';

/**
 * Accommodations nested Stack layout (SPEC-243 T-041).
 *
 * Renders a header-less Stack so the tab bar from the parent Tabs layout
 * remains visible while navigating list → detail.
 *
 * Expo Router requires a **default export** for route files.
 */
export default function AccommodationsLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}
