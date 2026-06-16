import { StyleSheet, Text, View } from 'react-native';
import { AuthButton } from '../../src/components/auth/AuthButton';
import { theme } from '../../src/design';
import { signOut } from '../../src/lib/auth-client';
import { appDefaultLocale, getTranslation } from '../../src/lib/i18n';

/**
 * Tourist home screen — placeholder for SPEC-243 T-005.
 *
 * Real content (accommodation browsing, search, etc.) will be built in
 * Sub-1+ tasks. This screen exists only to:
 * 1. Confirm the (tourist) route group renders correctly after redirect.
 * 2. Provide a Sign out button so the auth gate can be exercised end-to-end
 *    on device (sign-out clears the session → root effect redirects to (auth)).
 *
 * Uses `auth-ui.signOut.button` i18n key (verified in es/auth-ui.json line 115).
 *
 * Expo Router requires a **default export** for route files — this is the
 * one legitimate exception to the named-export-only rule (see CLAUDE.md).
 *
 * Styling uses StyleSheet.create at module scope (ADR-033).
 * Colors sourced from the mobile design system — no hardcoded hex values.
 */
export default function TouristHomeScreen() {
    const locale = appDefaultLocale;
    const t = (key: string) => getTranslation(key, locale);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Tourist Home</Text>
            <Text style={styles.subtitle}>{t('auth-ui.userMenu.dashboard')}</Text>
            <AuthButton
                label={t('auth-ui.signOut.button')}
                onPress={() => signOut()}
                style={styles.signOutButton}
            />
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles — module scope (ADR-033)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.semantic.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing[6]
    },
    title: {
        fontSize: theme.typography.semantic.display,
        fontWeight: '700',
        color: theme.colors.neutral[700],
        marginBottom: theme.spacing[2]
    },
    subtitle: {
        fontSize: theme.typography.semantic.body,
        color: theme.colors.neutral[500],
        marginBottom: theme.spacing[8]
    },
    signOutButton: {
        width: '100%'
    }
});
