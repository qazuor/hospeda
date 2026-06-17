import { Stack } from 'expo-router';

/**
 * Nested Stack navigator for the Consultas (conversations) section (SPEC-243 T-043).
 *
 * Screens:
 * - index   — conversations inbox list
 * - [id]    — conversation thread + reply
 *
 * `headerShown: false` leaves header rendering to each individual screen so
 * they can customise back-button labels and titles using their own i18n keys.
 *
 * Expo Router requires a **default export** for route files.
 */
export default function ConversationsLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}
