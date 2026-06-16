import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

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
 */
export default function HomeScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Hospeda</Text>
            <Text style={styles.subtitle}>Tu plataforma de alojamiento turístico</Text>
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
        textAlign: 'center'
    }
});
