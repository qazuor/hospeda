import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuthButton } from '../../src/components/auth/AuthButton';
import { TextField } from '../../src/components/auth/TextField';
import { theme } from '../../src/design';
import { signIn } from '../../src/lib/auth-client';
import { getFieldError, signInFormSchema } from '../../src/lib/auth/auth-form-schemas';
import { appDefaultLocale, getTranslation } from '../../src/lib/i18n';

/**
 * Sign-in screen for the Hospeda mobile app.
 *
 * Validates the form locally with `signInFormSchema` (Zod) before calling
 * Better Auth's `signIn.email`. Errors are localized via `getTranslation`.
 *
 * Navigation to sign-up uses `expo-router`'s `useRouter`.
 *
 * Role-gated redirect after successful sign-in is deferred to T-005.
 * For now, a successful sign-in logs to console (network-only, device gate).
 *
 * Expo Router requires a **default export** for route files — this is the
 * one legitimate exception to the named-export-only rule (see CLAUDE.md).
 *
 * Styling uses StyleSheet.create at module scope (ADR-033).
 * All colors are sourced from design tokens — no hardcoded hex values.
 */
export default function SignInScreen() {
    const locale = appDefaultLocale;
    const router = useRouter();

    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Validation errors (i18n key strings)
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');

    // API-level error (i18n key string)
    const [apiError, setApiError] = useState('');

    // Submission loading state
    const [loading, setLoading] = useState(false);

    /** t - shorthand translation helper for this screen. */
    const t = (key: string) => getTranslation(key, locale);

    /** Clears all errors before a new submit attempt. */
    function clearErrors() {
        setEmailError('');
        setPasswordError('');
        setApiError('');
    }

    /**
     * Handles form submission.
     *
     * 1. Validates with signInFormSchema (Zod safeParse).
     * 2. On validation failure: surfaces per-field errors.
     * 3. On validation success: calls signIn.email via Better Auth.
     * 4. Maps Better Auth errors to param-free i18n keys.
     *
     * NOTE: The live network flow (signIn.email → session persist) requires
     * a real device or simulator (T-003 spike — UNVERIFIED headless).
     */
    async function handleSubmit() {
        clearErrors();

        const result = signInFormSchema.safeParse({ email, password });

        if (!result.success) {
            const issues = result.error.issues;
            const emailKey = getFieldError(issues, 'email');
            const passwordKey = getFieldError(issues, 'password');
            if (emailKey) setEmailError(t(emailKey));
            if (passwordKey) setPasswordError(t(passwordKey));
            return;
        }

        setLoading(true);
        try {
            await signIn.email({
                email: result.data.email,
                password: result.data.password
            });
            // T-005 will navigate to the appropriate tab navigator here.
        } catch (err: unknown) {
            const errorKey = mapSignInError(err);
            setApiError(t(errorKey));
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
                    <Text style={styles.title}>{t('auth-ui.signIn.title')}</Text>
                    <Text style={styles.subtitle}>{t('auth-ui.signIn.subtitle')}</Text>

                    {/* API error banner */}
                    {apiError ? (
                        <View style={styles.errorBanner}>
                            <Text style={styles.errorBannerText}>{apiError}</Text>
                        </View>
                    ) : null}

                    {/* Email field */}
                    <TextField
                        label={t('auth-ui.signIn.email')}
                        value={email}
                        onChangeText={setEmail}
                        error={emailError}
                        placeholder={t('auth-ui.signIn.emailPlaceholder')}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        returnKeyType="next"
                    />

                    {/* Password field */}
                    <TextField
                        label={t('auth-ui.signIn.password')}
                        value={password}
                        onChangeText={setPassword}
                        error={passwordError}
                        placeholder={t('auth-ui.signIn.passwordPlaceholder')}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="current-password"
                        returnKeyType="done"
                        onSubmitEditing={handleSubmit}
                    />

                    {/* Submit button */}
                    <AuthButton
                        label={
                            loading ? t('auth-ui.signIn.loading') : t('auth-ui.signIn.signInButton')
                        }
                        loading={loading}
                        onPress={handleSubmit}
                        style={styles.submitButton}
                    />

                    {/* Sign-up link */}
                    <View style={styles.signUpRow}>
                        <Text style={styles.signUpText}>{t('auth-ui.signIn.dontHaveAccount')}</Text>
                        <Text
                            style={styles.signUpLink}
                            onPress={() => router.push('/(auth)/sign-up')}
                            accessibilityRole="link"
                        >
                            {' '}
                            {t('auth-ui.signIn.signUpLink')}
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/**
 * Maps a Better Auth sign-in error to a param-free i18n key.
 *
 * Better Auth error objects include a `code` string or a `status` number.
 * We map known codes to the pre-existing `auth-ui.signIn.errors.*` keys.
 * Anything unrecognized falls back to `unknownError`.
 */
function mapSignInError(err: unknown): string {
    if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        if (msg.includes('invalid email')) return 'auth-ui.signIn.errors.invalidEmail';
        if (msg.includes('invalid') || msg.includes('credentials') || msg.includes('password')) {
            return 'auth-ui.signIn.errors.invalidCredentials';
        }
        if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
            return 'auth-ui.signIn.errors.networkError';
        }
    }
    return 'auth-ui.signIn.errors.unknownError';
}

// ---------------------------------------------------------------------------
// Styles — module scope (ADR-033)
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
    signUpRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center'
    },
    signUpText: {
        fontSize: theme.typography.semantic.bodySm,
        // neutral[500] = '#717171'
        color: theme.colors.neutral[500]
    },
    signUpLink: {
        fontSize: theme.typography.semantic.bodySm,
        // river[600] = '#1c5dbf' — readable branded link color
        color: theme.colors.river[600],
        fontWeight: '600'
    }
});
