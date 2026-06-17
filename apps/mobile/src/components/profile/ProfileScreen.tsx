/**
 * @file ProfileScreen.tsx
 * @description Shared profile screen used by both host and tourist roles (SPEC-243 T-050/T-051/T-052/T-054).
 *
 * Responsibilities:
 * - Show avatar (read-only), email (read-only), role (read-only)
 * - Editable: firstName, lastName, phone (→ contactInfo.mobilePhone), city, province, country
 * - Save via `usePatchUser` → PATCH /api/v1/protected/users/:id
 * - Notification channel toggles (enabled, allowPush, allowEmails, allowSms)
 * - Language selector (es/en/pt) via `useLocale().setLocale`
 * - Sign-out button (calls `signOut()`)
 * - Delete account stub (Alert "coming soon")
 *
 * Patterns followed:
 * - Same form pattern as `(host)/accommodations/[id].tsx` (useState+useEffect+Zod safeParse)
 * - Styling: StyleSheet.create at module scope, design tokens only (ADR-034)
 * - Named export (Expo Router screens are the only legitimate default-export exception)
 *
 * @module components/profile/ProfileScreen
 */

import type { Locale } from '@repo/i18n';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { theme } from '../../design';
import { UserPatchBodySchema, usePatchUser } from '../../lib/api/hooks/use-patch-user';
import type { UserPatchBody } from '../../lib/api/hooks/use-patch-user';
import { useSelfProfile } from '../../lib/api/hooks/use-self-profile';
import { signOut, useSession } from '../../lib/auth-client';
import { getTranslation } from '../../lib/i18n';
import { useLocale } from '../../lib/locale-context';
import { logger } from '../../lib/logger';
import { TextField } from '../auth/TextField';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Editable profile form fields (all string). */
type ProfileFields = {
    firstName: string;
    lastName: string;
    phone: string;
    city: string;
    region: string;
    country: string;
};

/** Per-field Zod validation errors (translated string or undefined). */
type ProfileErrors = Partial<Record<keyof ProfileFields, string>>;

/** Notification toggle state. */
type NotificationState = {
    enabled: boolean;
    allowPush: boolean;
    allowEmails: boolean;
    allowSms: boolean;
};

// ---------------------------------------------------------------------------
// Locale options
// ---------------------------------------------------------------------------

const LOCALE_OPTIONS: ReadonlyArray<{ code: Locale; labelKey: string }> = [
    { code: 'es', labelKey: 'mobile.settings.language.es' },
    { code: 'en', labelKey: 'mobile.settings.language.en' },
    { code: 'pt', labelKey: 'mobile.settings.language.pt' }
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Shared profile screen for host and tourist users.
 *
 * Reads the session from `useSession()` and fetches the full profile from
 * `useSelfProfile()`. Edits are persisted via `usePatchUser()`.
 *
 * Expo Router route files that render this component use a default export;
 * this component itself is a named export (CLAUDE.md rule).
 *
 * @example
 * ```tsx
 * // app/(host)/profile.tsx
 * import { ProfileScreen } from '../../src/components/profile/ProfileScreen';
 * export default function HostProfileScreen() { return <ProfileScreen />; }
 * ```
 */
export function ProfileScreen() {
    const { locale, setLocale } = useLocale();
    const t = (key: string) => getTranslation(key, locale);

    const { data: session } = useSession();
    const userId = (session?.user as { id?: string } | undefined)?.id ?? '';

    const { data: profile, isLoading, error: loadError } = useSelfProfile(userId);
    const mutation = usePatchUser();

    // ---------------------------------------------------------------------------
    // Form state
    // ---------------------------------------------------------------------------

    const [fields, setFields] = useState<ProfileFields>({
        firstName: '',
        lastName: '',
        phone: '',
        city: '',
        region: '',
        country: ''
    });

    const [formErrors, setFormErrors] = useState<ProfileErrors>({});
    const [saveSuccess, setSaveSuccess] = useState(false);

    const [notifications, setNotifications] = useState<NotificationState>({
        enabled: true,
        allowPush: true,
        allowEmails: true,
        allowSms: false
    });

    // Populate form once the profile loads
    useEffect(() => {
        if (!profile) return;
        setFields({
            firstName: profile.firstName ?? '',
            lastName: profile.lastName ?? '',
            phone: profile.contactInfo?.mobilePhone ?? '',
            city: profile.location?.city ?? '',
            region: profile.location?.region ?? '',
            country: profile.location?.country ?? ''
        });
        const notif = profile.settings?.notifications;
        if (notif) {
            setNotifications({
                enabled: notif.enabled,
                allowPush: notif.allowPush,
                allowEmails: notif.allowEmails,
                allowSms: notif.allowSms
            });
        }
    }, [profile]);

    // ---------------------------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------------------------

    /** Update a single profile form field, clearing its per-field error. */
    function setField(key: keyof ProfileFields, value: string) {
        setFields((prev) => ({ ...prev, [key]: value }));
        if (formErrors[key]) {
            setFormErrors((prev) => ({ ...prev, [key]: undefined }));
        }
    }

    /** Toggle a single notification channel preference. */
    function toggleNotification(key: keyof NotificationState, value: boolean) {
        setNotifications((prev) => ({ ...prev, [key]: value }));
    }

    /**
     * Maps Zod issue path leaf keys to their corresponding form field names.
     * Required because the Zod path for phone errors is `contactInfo.mobilePhone`
     * (leaf = `mobilePhone`) but the form field is named `phone`.
     */
    const PATH_TO_FIELD: Record<string, keyof ProfileFields> = { mobilePhone: 'phone' };

    /**
     * Build the PATCH body, validate with Zod, and call the mutation.
     * Empty strings are omitted (no-change semantics, same as accommodation edit).
     */
    async function handleSave() {
        // Guard must be first — no point building/validating if userId is absent
        if (!userId) return;

        setSaveSuccess(false);
        setFormErrors({});

        const body: UserPatchBody = {};
        if (fields.firstName) body.firstName = fields.firstName;
        if (fields.lastName) body.lastName = fields.lastName;

        if (fields.phone) {
            body.contactInfo = { mobilePhone: fields.phone };
        }

        const hasLocation = fields.city || fields.region || fields.country;
        if (hasLocation) {
            body.location = {};
            if (fields.city) body.location.city = fields.city;
            if (fields.region) body.location.region = fields.region;
            if (fields.country) body.location.country = fields.country;
        }

        // Always send the full notifications block so toggles are persisted
        body.settings = {
            notifications: {
                enabled: notifications.enabled,
                allowPush: notifications.allowPush,
                allowEmails: notifications.allowEmails,
                allowSms: notifications.allowSms
            }
        };

        const parsed = UserPatchBodySchema.safeParse(body);
        if (!parsed.success) {
            const errors: ProfileErrors = {};
            for (const issue of parsed.error.issues) {
                const rawKey = String(issue.path[issue.path.length - 1]);
                const field = (PATH_TO_FIELD[rawKey] ?? rawKey) as keyof ProfileFields;
                if (field && !errors[field]) {
                    errors[field] = issue.message;
                }
            }
            setFormErrors(errors);
            return;
        }

        mutation.mutate(
            { id: userId, body: parsed.data },
            {
                onSuccess: () => {
                    setSaveSuccess(true);
                    logger.info('User profile patched', { userId });
                },
                onError: (err) => {
                    logger.error('User profile patch failed', {
                        userId,
                        error: String(err)
                    });
                    Alert.alert(t('mobile.profile.saveError'));
                }
            }
        );
    }

    /** Handle sign out — root _layout effect redirects to (auth). */
    function handleSignOut() {
        void signOut();
    }

    /** Delete account stub — no backend endpoint exists yet. */
    function handleDeleteAccount() {
        Alert.alert(
            t('mobile.settings.account.deleteAccount'),
            t('mobile.settings.account.deleteAccountComingSoon')
        );
    }

    // ---------------------------------------------------------------------------
    // Render states
    // ---------------------------------------------------------------------------

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator
                    size="large"
                    color={theme.colors.river[500]}
                />
                <Text style={styles.loadingText}>{t('mobile.profile.loading')}</Text>
            </View>
        );
    }

    if (loadError) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>{t('mobile.profile.loadError')}</Text>
            </View>
        );
    }

    // ---------------------------------------------------------------------------
    // Render form
    // ---------------------------------------------------------------------------

    const userEmail = (session?.user as { email?: string } | undefined)?.email ?? '';
    const userRole = (session?.user as { role?: string } | undefined)?.role ?? '';

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoid}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.screenTitle}>{t('mobile.profile.title')}</Text>

                {/* Read-only identity block */}
                <View style={styles.identityBlock}>
                    {/* Avatar placeholder */}
                    <View style={styles.avatarCircle}>
                        <Text style={styles.avatarInitial}>
                            {fields.firstName.charAt(0).toUpperCase() ||
                                userEmail.charAt(0).toUpperCase() ||
                                '?'}
                        </Text>
                    </View>
                    <View style={styles.identityText}>
                        <Text style={styles.identityEmail}>{userEmail}</Text>
                        {userRole ? <Text style={styles.identityRole}>{userRole}</Text> : null}
                    </View>
                </View>

                {/* Success banner */}
                {saveSuccess ? (
                    <View style={styles.successBanner}>
                        <Text style={styles.successBannerText}>
                            {t('mobile.profile.saveSuccess')}
                        </Text>
                    </View>
                ) : null}

                {/* Section: Personal info */}
                <SectionHeader label={t('mobile.profile.sections.personalInfo')} />

                <TextField
                    label={t('mobile.profile.fields.firstName')}
                    value={fields.firstName}
                    onChangeText={(v) => setField('firstName', v)}
                    error={formErrors.firstName}
                    autoCapitalize="words"
                    autoCorrect={false}
                />
                <TextField
                    label={t('mobile.profile.fields.lastName')}
                    value={fields.lastName}
                    onChangeText={(v) => setField('lastName', v)}
                    error={formErrors.lastName}
                    autoCapitalize="words"
                    autoCorrect={false}
                />
                <TextField
                    label={t('mobile.profile.fields.phone')}
                    value={fields.phone}
                    onChangeText={(v) => setField('phone', v)}
                    error={formErrors.phone}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                />

                {/* Section: Location */}
                <SectionHeader label={t('mobile.profile.sections.location')} />

                <TextField
                    label={t('mobile.profile.fields.city')}
                    value={fields.city}
                    onChangeText={(v) => setField('city', v)}
                    error={formErrors.city}
                    autoCapitalize="words"
                    autoCorrect={false}
                />
                <TextField
                    label={t('mobile.profile.fields.region')}
                    value={fields.region}
                    onChangeText={(v) => setField('region', v)}
                    error={formErrors.region}
                    autoCapitalize="words"
                    autoCorrect={false}
                />
                <TextField
                    label={t('mobile.profile.fields.country')}
                    value={fields.country}
                    onChangeText={(v) => setField('country', v)}
                    error={formErrors.country}
                    autoCapitalize="words"
                    autoCorrect={false}
                />

                {/* Save button */}
                <TouchableOpacity
                    style={[
                        styles.saveButton,
                        mutation.isPending ? styles.saveButtonDisabled : null
                    ]}
                    onPress={() => void handleSave()}
                    disabled={mutation.isPending || !userId}
                    accessibilityRole="button"
                >
                    {mutation.isPending ? (
                        <ActivityIndicator
                            color={theme.colors.semantic.textInverted}
                            size="small"
                        />
                    ) : (
                        <Text style={styles.saveButtonText}>{t('mobile.profile.save')}</Text>
                    )}
                </TouchableOpacity>

                {/* Section: Notifications */}
                <SectionHeader label={t('mobile.settings.notifications.sectionTitle')} />

                <ToggleRow
                    label={t('mobile.settings.notifications.enabled')}
                    value={notifications.enabled}
                    onValueChange={(v) => toggleNotification('enabled', v)}
                />
                <ToggleRow
                    label={t('mobile.settings.notifications.allowPush')}
                    value={notifications.allowPush}
                    onValueChange={(v) => toggleNotification('allowPush', v)}
                />
                <ToggleRow
                    label={t('mobile.settings.notifications.allowEmails')}
                    value={notifications.allowEmails}
                    onValueChange={(v) => toggleNotification('allowEmails', v)}
                />
                <ToggleRow
                    label={t('mobile.settings.notifications.allowSms')}
                    value={notifications.allowSms}
                    onValueChange={(v) => toggleNotification('allowSms', v)}
                />

                {/* Section: Language */}
                <SectionHeader label={t('mobile.settings.language.sectionTitle')} />

                <View style={styles.localeRow}>
                    {LOCALE_OPTIONS.map(({ code, labelKey }) => (
                        <TouchableOpacity
                            key={code}
                            style={[
                                styles.localeButton,
                                locale === code ? styles.localeButtonActive : null
                            ]}
                            onPress={() => setLocale(code)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: locale === code }}
                        >
                            <Text
                                style={[
                                    styles.localeButtonText,
                                    locale === code ? styles.localeButtonTextActive : null
                                ]}
                            >
                                {t(labelKey)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Section: Account */}
                <SectionHeader label={t('mobile.settings.account.sectionTitle')} />

                <TouchableOpacity
                    style={styles.actionRow}
                    onPress={handleSignOut}
                    accessibilityRole="button"
                >
                    <Text style={styles.actionRowText}>{t('mobile.settings.account.signOut')}</Text>
                </TouchableOpacity>

                {/* Delete account stub */}
                <TouchableOpacity
                    style={[styles.actionRow, styles.actionRowDanger]}
                    onPress={handleDeleteAccount}
                    accessibilityRole="button"
                >
                    <Text style={[styles.actionRowText, styles.actionRowTextDanger]}>
                        {t('mobile.settings.account.deleteAccount')}
                    </Text>
                </TouchableOpacity>

                {/* Bottom padding */}
                <View style={styles.bottomSpacer} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
    readonly label: string;
}

/** Visual section separator with label (same pattern as accommodation edit screen). */
function SectionHeader({ label }: SectionHeaderProps) {
    return (
        <View style={sectionHeaderStyles.wrapper}>
            <Text style={sectionHeaderStyles.text}>{label}</Text>
            <View style={sectionHeaderStyles.divider} />
        </View>
    );
}

const sectionHeaderStyles = StyleSheet.create({
    wrapper: {
        marginTop: theme.spacing[6],
        marginBottom: theme.spacing[3]
    },
    text: {
        fontSize: theme.typography.semantic.bodySm,
        fontWeight: '600',
        color: theme.colors.neutral[500],
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: theme.spacing[2]
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.semantic.divider
    }
});

interface ToggleRowProps {
    readonly label: string;
    readonly value: boolean;
    readonly onValueChange: (value: boolean) => void;
}

/** A labeled Switch row for notification toggles. */
function ToggleRow({ label, value, onValueChange }: ToggleRowProps) {
    return (
        <View style={toggleStyles.row}>
            <Text style={toggleStyles.label}>{label}</Text>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{
                    false: theme.colors.neutral[200],
                    true: theme.colors.river[400]
                }}
                thumbColor={value ? theme.colors.river[600] : theme.colors.neutral[400]}
                accessibilityRole="switch"
                accessibilityState={{ checked: value }}
            />
        </View>
    );
}

const toggleStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: theme.spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.semantic.divider
    },
    label: {
        fontSize: theme.typography.semantic.body,
        color: theme.colors.neutral[700],
        flex: 1,
        marginRight: theme.spacing[3]
    }
});

// ---------------------------------------------------------------------------
// Styles — module scope (ADR-034)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    keyboardAvoid: {
        flex: 1,
        backgroundColor: theme.colors.semantic.background
    },
    scrollContent: {
        padding: theme.spacing[5],
        paddingBottom: theme.spacing[12]
    },
    centered: {
        flex: 1,
        backgroundColor: theme.colors.semantic.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing[6]
    },
    screenTitle: {
        fontSize: theme.typography.semantic.h2,
        fontWeight: '700',
        color: theme.colors.neutral[700],
        marginBottom: theme.spacing[5]
    },
    // Identity block
    identityBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing[4],
        backgroundColor: theme.colors.neutral[50],
        borderRadius: theme.radius.scale.md,
        padding: theme.spacing[4]
    },
    avatarCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.colors.river[100],
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: theme.spacing[4]
    },
    avatarInitial: {
        fontSize: theme.typography.semantic.h2,
        fontWeight: '700',
        color: theme.colors.river[600]
    },
    identityText: {
        flex: 1
    },
    identityEmail: {
        fontSize: theme.typography.semantic.bodySm,
        color: theme.colors.neutral[600]
    },
    identityRole: {
        fontSize: theme.typography.semantic.caption,
        color: theme.colors.neutral[400],
        marginTop: theme.spacing[1],
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    // Success banner
    successBanner: {
        backgroundColor: theme.colors.success[50],
        borderWidth: 1,
        borderColor: theme.colors.success[200],
        borderRadius: theme.radius.scale.sm,
        padding: theme.spacing[3],
        marginBottom: theme.spacing[4]
    },
    successBannerText: {
        fontSize: theme.typography.semantic.bodySm,
        color: theme.colors.success[700],
        textAlign: 'center'
    },
    // Save button
    saveButton: {
        backgroundColor: theme.colors.accent[500],
        borderRadius: theme.radius.semantic.button,
        paddingVertical: theme.spacing[4],
        paddingHorizontal: theme.spacing[6],
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
        marginTop: theme.spacing[4]
    },
    saveButtonDisabled: {
        backgroundColor: theme.colors.accent[300]
    },
    saveButtonText: {
        fontSize: theme.typography.semantic.button,
        fontWeight: '600',
        color: theme.colors.semantic.textInverted
    },
    // Locale selector
    localeRow: {
        flexDirection: 'row',
        gap: theme.spacing[2],
        marginTop: theme.spacing[2]
    },
    localeButton: {
        flex: 1,
        paddingVertical: theme.spacing[3],
        borderRadius: theme.radius.scale.sm,
        borderWidth: 1,
        borderColor: theme.colors.semantic.border,
        alignItems: 'center'
    },
    localeButtonActive: {
        borderColor: theme.colors.river[500],
        backgroundColor: theme.colors.river[50]
    },
    localeButtonText: {
        fontSize: theme.typography.semantic.bodySm,
        color: theme.colors.neutral[600],
        fontWeight: '500'
    },
    localeButtonTextActive: {
        color: theme.colors.river[700],
        fontWeight: '700'
    },
    // Account actions
    actionRow: {
        paddingVertical: theme.spacing[4],
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.semantic.divider
    },
    actionRowDanger: {
        marginTop: theme.spacing[2]
    },
    actionRowText: {
        fontSize: theme.typography.semantic.body,
        color: theme.colors.neutral[700]
    },
    actionRowTextDanger: {
        color: theme.colors.danger[600]
    },
    // Text states
    loadingText: {
        marginTop: theme.spacing[3],
        fontSize: theme.typography.semantic.bodySm,
        color: theme.colors.neutral[500]
    },
    errorText: {
        fontSize: theme.typography.semantic.body,
        color: theme.colors.danger[600],
        textAlign: 'center'
    },
    bottomSpacer: {
        height: theme.spacing[8]
    }
});
