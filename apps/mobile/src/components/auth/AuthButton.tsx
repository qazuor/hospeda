/**
 * @file AuthButton.tsx
 * @description Reusable primary button for auth form actions.
 *
 * Follows ADR-033: StyleSheet.create at module scope, design tokens only,
 * no hardcoded hex values.
 */
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { TouchableOpacityProps } from 'react-native';
import { theme } from '../../design';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AuthButtonProps extends TouchableOpacityProps {
    /** Button label text (pre-translated). */
    readonly label: string;
    /** Shows an activity spinner and disables the button when true. */
    readonly loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Primary action button for auth screens (sign-in, sign-up).
 *
 * Renders an accent-colored full-width button with loading state support.
 * Automatically disabled when `loading` is true or `disabled` prop is passed.
 *
 * @param label   - Button text (pre-translated)
 * @param loading - Show spinner + disable interaction when true
 * @param rest    - All other `TouchableOpacity` props are forwarded.
 *
 * @example
 * ```tsx
 * <AuthButton
 *   label={getTranslation('auth-ui.signIn.signInButton', locale)}
 *   loading={isPending}
 *   onPress={handleSubmit}
 * />
 * ```
 */
export function AuthButton({ label, loading = false, disabled, style, ...rest }: AuthButtonProps) {
    const isDisabled = loading || disabled;

    return (
        <TouchableOpacity
            style={[styles.button, isDisabled ? styles.buttonDisabled : null, style]}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityLabel={label}
            {...rest}
        >
            {loading ? (
                <ActivityIndicator
                    color={theme.colors.semantic.textInverted}
                    size="small"
                />
            ) : (
                <Text style={styles.label}>{label}</Text>
            )}
        </TouchableOpacity>
    );
}

// ---------------------------------------------------------------------------
// Styles — module scope (ADR-033)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    button: {
        backgroundColor: theme.colors.accent[500],
        borderRadius: theme.radius.semantic.button,
        paddingVertical: theme.spacing[4],
        paddingHorizontal: theme.spacing[6],
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48
    },
    buttonDisabled: {
        // accent[300] = '#ffad75' — lighter tint for disabled state
        backgroundColor: theme.colors.accent[300]
    },
    label: {
        fontSize: theme.typography.semantic.button,
        fontWeight: '600',
        // textInverted = '#ffffff' — white text on accent background
        color: theme.colors.semantic.textInverted
    }
});
