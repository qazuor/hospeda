/**
 * Tourist profile route screen (SPEC-243 T-050).
 *
 * Thin wrapper — renders the shared `ProfileScreen` component.
 * The Tabs navigator in `(tourist)/_layout.tsx` registers this file as
 * the second tab ("Perfil").
 *
 * Expo Router requires a **default export** for route files — this is the
 * one legitimate exception to the named-export-only rule (see CLAUDE.md).
 */
import { ProfileScreen } from '../../src/components/profile/ProfileScreen';

export default function TouristProfileScreen() {
    return <ProfileScreen />;
}
