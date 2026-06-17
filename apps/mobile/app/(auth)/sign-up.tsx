import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuthButton } from '../../src/components/auth/AuthButton';
import { TextField } from '../../src/components/auth/TextField';
import { theme } from '../../src/design';
import { signUp } from '../../src/lib/auth-client';
import { mapSignUpError } from '../../src/lib/auth/auth-errors';
import { getFieldError, signUpFormSchema } from '../../src/lib/auth/auth-form-schemas';
import { appDefaultLocale, getTranslation } from '../../src/lib/i18n';

/**
 * Sign-up screen for the Hospeda mobile app.
 *
 * Validates the form locally with `signUpFormSchema` (Zod) before calling
 * Better Auth's `signUp.email`. Password strength is enforced via
 * `StrongPasswordRegex` baked into the schema.
 *
 * The `name` field sent to Better Auth is the user's firstName (Better Auth
 * uses a single `name` field; the UI presents it as "First name" per the
 * auth-ui namespace which splits first/last).
 *
 * Role-gated redirect after successful sign-up is deferred to T-005.
 *
 * Expo Router requires a **default export** for route files — this is the
 * one legitimate exception to the named-export-only rule (see CLAUDE.md).
 *
 * Styling uses StyleSheet.create at module scope (ADR-034).
 * All colors are sourced from design tokens — no hardcoded hex values.
 */
export default function SignUpScreen() {
    const locale = appDefaultLocale;
    const router = useRouter();

    // Form state
    const [firstName, setFirstName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Validation errors (translated strings)
    const [firstNameError, setFirstNameError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');

    // API-level error (translated string)
    const [apiError, setApiError] = useState('');

    // Submission loading state
    const [loading, setLoading] = useState(false);

    /** t - shorthand translation helper for this screen. */
    const t = (key: string) => getTranslation(key, locale);

    /** Clears all errors before a new submit attempt. */
    function clearErrors() {
        setFirstNameError('');
        setEmailError('');
        setPasswordError('');
        setConfirmPasswordError('');
        setApiError('');
    }

    /**
     * Handles form submission.
     *
     * 1. Validates with signUpFormSchema (Zod safeParse).
     * 2. On validation failure: surfaces first per-field error.
     * 3. On validation success: calls signUp.email via Better Auth.
     *    - `name` = firstName (Better Auth's single-name field)
     * 4. Maps Better Auth errors to param-free i18n keys.
     *
     * NOTE: The live network flow (signUp.email → session persist) requires
     * a real device or simulator (T-003 spike — UNVERIFIED headless).
     */
    async function handleSubmit() {
        clearErrors();

        const result = signUpFormSchema.safeParse({ firstName, email, password, confirmPassword });

        if (!result.success) {
            const issues = result.error.issues;
            const firstNameKey = getFieldError(issues, 'firstName');
            const emailKey = getFieldError(issues, 'email');
            const passwordKey = getFieldError(issues, 'password');
            const confirmPasswordKey = getFieldError(issues, 'confirmPassword');

            if (firstNameKey) setFirstNameError(t(firstNameKey));
            if (emailKey) setEmailError(t(emailKey));
            if (passwordKey) setPasswordError(t(passwordKey));
            if (confirmPasswordKey) setConfirmPasswordError(t(confirmPasswordKey));
            return;
        }

        setLoading(true);
        try {
            // Better Auth client methods RESOLVE with { data, error } — they do
            // NOT throw on an API-level failure (user exists, etc.). The catch
            // below only fires on a transport/network rejection.
            const { error } = await signUp.email({
                email: result.data.email,
                password: result.data.password,
                name: result.data.firstName
            });
            if (error) {
                setApiError(t(mapSignUpError(error)));
                return;
            }
            // T-005 will navigate to the appropriate tab navigator here.
        } catch {
            setApiError(t('auth-ui.signUp.errors.networkError'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoid}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.container}>
                    {/* Header */}
                    <Text style={styles.title}>{t('auth-ui.signUp.title')}</Text>
                    <Text style={styles.subtitle}>{t('auth-ui.signUp.subtitle')}</Text>

                    {/* API error banner */}
                    {apiError ? (
                        <View style={styles.errorBanner}>
                            <Text style={styles.errorBannerText}>{apiError}</Text>
                        </View>
                    ) : null}

                    {/* First name field */}
                    <TextField
                        label={t('auth-ui.signUp.firstName')}
                        value={firstName}
                        onChangeText={setFirstName}
                        error={firstNameError}
                        placeholder={t('auth-ui.signUp.firstNamePlaceholder')}
                        autoCapitalize="words"
                        autoComplete="given-name"
                        returnKeyType="next"
                    />

                    {/* Email field */}
                    <TextField
                        label={t('auth-ui.signUp.email')}
                        value={email}
                        onChangeText={setEmail}
                        error={emailError}
                        placeholder={t('auth-ui.signUp.emailPlaceholder')}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        returnKeyType="next"
                    />

                    {/* Password field */}
                    <TextField
                        label={t('auth-ui.signUp.password')}
                        value={password}
                        onChangeText={setPassword}
                        error={passwordError}
                        placeholder={t('auth-ui.signUp.passwordPlaceholder')}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="new-password"
                        returnKeyType="next"
                    />

                    {/* Confirm password field */}
                    <TextField
                        label={t('auth-ui.signUp.confirmPassword')}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        error={confirmPasswordError}
                        placeholder={t('auth-ui.signUp.confirmPasswordPlaceholder')}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="new-password"
                        returnKeyType="done"
                        onSubmitEditing={handleSubmit}
                    />

                    {/* Submit button */}
                    <AuthButton
                        label={
                            loading ? t('auth-ui.signUp.loading') : t('auth-ui.signUp.signUpButton')
                        }
                        loading={loading}
                        onPress={handleSubmit}
                        style={styles.submitButton}
                    />

                    {/* Sign-in link */}
                    <View style={styles.signInRow}>
                        <Text style={styles.signInText}>
                            {t('auth-ui.signUp.alreadyHaveAccount')}
                        </Text>
                        <Text
                            style={styles.signInLink}
                            onPress={() => router.push('/(auth)/sign-in')}
                            accessibilityRole="link"
                        >
                            {' '}
                            {t('auth-ui.signUp.signInLink')}
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

// ---------------------------------------------------------------------------
// Styles — module scope (ADR-034)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    keyboardAvoid: {
        flex: 1
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center'
    },
    container: {
        flex: 1,
        backgroundColor: theme.colors.semantic.background,
        padding: theme.spacing[6],
        justifyContent: 'center'
    },
    title: {
        // display = 32px — prominent screen heading
        fontSize: theme.typography.semantic.display,
        fontWeight: '700',
        // neutral[700] = '#2e2e2e' — near-black heading
        color: theme.colors.neutral[700],
        marginBottom: theme.spacing[1]
    },
    subtitle: {
        // body = 16px — supporting subtitle below title
        fontSize: theme.typography.semantic.body,
        // neutral[500] = '#717171' — mid-gray body text
        color: theme.colors.neutral[500],
        marginBottom: theme.spacing[8]
    },
    errorBanner: {
        backgroundColor: theme.colors.danger[50],
        borderWidth: 1,
        borderColor: theme.colors.danger[200],
        borderRadius: theme.radius.scale.sm,
        padding: theme.spacing[3],
        marginBottom: theme.spacing[4]
    },
    errorBannerText: {
        fontSize: theme.typography.semantic.bodySm,
        // danger[600] = '#a7000d' — readable on danger[50] background
        color: theme.colors.danger[600]
    },
    submitButton: {
        marginTop: theme.spacing[2],
        marginBottom: theme.spacing[6]
    },
    signInRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center'
    },
    signInText: {
        fontSize: theme.typography.semantic.bodySm,
        // neutral[500] = '#717171'
        color: theme.colors.neutral[500]
    },
    signInLink: {
        fontSize: theme.typography.semantic.bodySm,
        // river[600] = '#1c5dbf' — readable branded link color
        color: theme.colors.river[600],
        fontWeight: '600'
    }
});
