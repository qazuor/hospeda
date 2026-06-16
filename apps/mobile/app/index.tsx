import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { appDefaultLocale, getTranslation, supportedLocales } from '../src/lib/i18n';

/**
 * Placeholder home screen for the Hospeda mobile app (T-001 scaffold).
 *
 * This screen satisfies AC-F1.2: Expo Router renders at least a placeholder
 * home screen. It will be replaced by the role-gated navigator in T-005.
 *
 * Expo Router requires a **default export** for route files — this is the
 * one legitimate exception to the named-export-only rule (see CLAUDE.md).
 *
 * Styling uses StyleSheet.create as locked in ADR-033 (decision #1).
 *
 * T-002: imports from src/lib/i18n to force Metro to bundle @repo/i18n and
 * @repo/schemas, confirming workspace package resolution works correctly.
 */
export default function HomeScreen() {
    // T-002: exercise @repo/i18n via the lib helper (Metro resolution proof)
    const greeting = getTranslation('common.accommodations', appDefaultLocale);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Hospeda</Text>
            <Text style={styles.subtitle}>Tu plataforma de alojamiento turístico</Text>
            <Text style={styles.locale}>
                {greeting} · {supportedLocales.join(' / ')}
            </Text>
            <StatusBar style="auto" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 8
    },
    locale: {
        fontSize: 12,
        color: '#9ca3af',
        textAlign: 'center',
        marginTop: 4
    }
});
