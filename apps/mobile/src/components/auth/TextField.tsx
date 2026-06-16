/**
 * @file TextField.tsx
 * @description Reusable text input component for auth forms.
 *
 * Follows ADR-033: StyleSheet.create at module scope, design tokens only,
 * no hardcoded hex values.
 *
 * Named export (exception: route files use default exports per Expo Router).
 */
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { theme } from '../../design';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TextFieldProps extends TextInputProps {
    /** Accessible label shown above the input. */
    readonly label: string;
    /** Error message shown below the input. Empty string = no error. */
    readonly error?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Labeled text input with optional error message for auth screens.
 *
 * @param label  - Input label text (pre-translated)
 * @param error  - Validation error text (pre-translated). Omit or pass empty to hide.
 * @param rest   - All other `TextInput` props are forwarded.
 *
 * @example
 * ```tsx
 * <TextField
 *   label={getTranslation('auth-ui.signIn.email', locale)}
 *   value={email}
 *   onChangeText={setEmail}
 *   error={emailError ? getTranslation(emailError, locale) : ''}
 *   keyboardType="email-address"
 *   autoCapitalize="none"
 * />
 * ```
 */
export function TextField({ label, error, style, ...rest }: TextFieldProps) {
    const hasError = Boolean(error);

    return (
        <View style={styles.wrapper}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                style={[styles.input, hasError ? styles.inputError : null, style]}
                placeholderTextColor={theme.colors.neutral[400]}
                accessibilityLabel={label}
                {...rest}
            />
            {hasError ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles — module scope (ADR-033)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: theme.spacing[4]
    },
    label: {
        // bodySm = 14px — compact label above input field
        fontSize: theme.typography.semantic.bodySm,
        fontWeight: '600',
        color: theme.colors.neutral[700],
        marginBottom: theme.spacing[1]
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderColor: theme.colors.semantic.border,
        // radius.scale.sm = 8px — standard input field rounding
        borderRadius: theme.radius.scale.sm,
        paddingHorizontal: theme.spacing[4],
        fontSize: theme.typography.semantic.body,
        color: theme.colors.neutral[700],
        backgroundColor: theme.colors.semantic.background
    },
    inputError: {
        borderColor: theme.colors.danger[500]
    },
    errorText: {
        fontSize: theme.typography.semantic.caption,
        color: theme.colors.danger[500],
        marginTop: theme.spacing[1]
    }
});
