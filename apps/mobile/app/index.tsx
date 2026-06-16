import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { HouseIcon, ICON_DEFAULTS } from '../src/components/icons';
import { theme } from '../src/design';
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
 * Colors are sourced from the mobile design system (T-006/T-007) — no
 * hardcoded hex values. All tokens flow through `theme` from
 * `apps/mobile/src/design/` per the StyleSheet.create convention.
 *
 * T-002: imports from src/lib/i18n to force Metro to bundle @repo/i18n and
 * @repo/schemas, confirming workspace package resolution works correctly.
 *
 * T-008: imports `HouseIcon` from the icon wrapper to force Metro to bundle
 * `phosphor-react-native` + `react-native-svg`, verifying the icon layer
 * (ADR-033 decision #2) resolves correctly at compile time.
 */
export default function HomeScreen() {
    // T-002: exercise @repo/i18n via the lib helper (Metro resolution proof)
    const greeting = getTranslation('common.accommodations', appDefaultLocale);

    return (
        <View style={styles.container}>
            {/* T-008: icon wrapper proof-of-bundle — HouseIcon from phosphor-react-native */}
            <HouseIcon
                color={ICON_DEFAULTS.color}
                size={ICON_DEFAULTS.size}
                weight={ICON_DEFAULTS.weight}
                style={styles.icon}
            />
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
    // T-008: spacing below the brand icon before the title
    icon: {
        marginBottom: theme.spacing[3]
    },
    container: {
        flex: 1,
        // semantic.background = '#ffffff'  (oklch(1 0 0) → sRGB white)
        backgroundColor: theme.colors.semantic.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing[6]
    },
    title: {
        // typography.semantic.display = 32px (web: clamp(2rem…3rem), mobile lower-bound)
        fontSize: theme.typography.semantic.display,
        fontWeight: '700',
        // neutral[700] = '#2e2e2e'  (oklch(0.30 0 0) → near-black heading)
        color: theme.colors.neutral[700],
        marginBottom: theme.spacing[2]
    },
    subtitle: {
        // typography.semantic.body = 16px
        fontSize: theme.typography.semantic.body,
        // neutral[500] = '#717171'  (oklch(0.55 0 0) → mid-gray body text)
        color: theme.colors.neutral[500],
        textAlign: 'center',
        marginBottom: theme.spacing[2]
    },
    locale: {
        // typography.semantic.caption = 12px
        fontSize: theme.typography.semantic.caption,
        // neutral[400] = '#9e9e9e'  (oklch(0.70 0 0) → muted / meta text)
        color: theme.colors.neutral[400],
        textAlign: 'center',
        marginTop: theme.spacing[1]
    }
});
