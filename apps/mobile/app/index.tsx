import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { theme } from '../src/design';

/**
 * Root index route — minimal loading gate for SPEC-243 T-005.
 *
 * This screen is displayed for a brief moment on cold launch while the root
 * `_layout.tsx` effect waits for the Better Auth session to resolve.
 * The root effect redirects away from this screen as soon as `isPending`
 * becomes `false`, so in practice this is rarely visible.
 *
 * Prior T-001 scaffold content (i18n/icon proof-of-bundle) has been removed —
 * those Metro resolution concerns were verified in T-002 and T-008.
 *
 * Expo Router requires a **default export** for route files — this is the
 * one legitimate exception to the named-export-only rule (see CLAUDE.md).
 *
 * Styling uses StyleSheet.create at module scope (ADR-034).
 * Colors sourced from the mobile design system — no hardcoded hex values.
 */
export default function LoadingGate() {
    return (
        <View style={styles.container}>
            <ActivityIndicator
                size="large"
                color={theme.colors.accent[500]}
            />
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles — module scope (ADR-034)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.semantic.background,
        alignItems: 'center',
        justifyContent: 'center'
    }
});
