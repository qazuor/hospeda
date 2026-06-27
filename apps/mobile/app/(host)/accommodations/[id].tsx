import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { TextField } from '../../../src/components/auth/TextField';
import { theme } from '../../../src/design';
import { useOwnAccommodation } from '../../../src/lib/api/hooks/use-own-accommodations';
import {
    AccommodationOperationalUpdateSchema,
    usePatchAccommodation
} from '../../../src/lib/api/hooks/use-patch-accommodation';
import type { AccommodationOperationalUpdate } from '../../../src/lib/api/hooks/use-patch-accommodation';
import { getTranslation } from '../../../src/lib/i18n';
import { useLocale } from '../../../src/lib/locale-context';
import { logger } from '../../../src/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Editable form field keys (all string; phone/social may be URL-like). */
type FormFields = {
    phone: string;
    email: string;
    website: string;
    twitter: string;
    facebook: string;
    instagram: string;
    linkedin: string;
    tiktok: string;
    youtube: string;
    summary: string;
    description: string;
};

/** Per-field Zod validation errors (translated string). */
type FormErrors = Partial<Record<keyof FormFields, string>>;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Accommodation detail + operational-fields edit screen (SPEC-243 T-042).
 *
 * Reads `:id` via expo-router `useLocalSearchParams`.
 * Fetches GET /api/v1/protected/accommodations/:id.
 * Edits contact, social, summary, and description fields.
 * Saves via PATCH /api/v1/protected/accommodations/:id.
 *
 * NOTE: openingHours is intentionally excluded.
 * TODO(SPEC-243 T-042): schedule editor — openingHours maps through extraInfo,
 *   confirm mapper before adding.
 *
 * Expo Router requires a **default export** for route files.
 * Styling uses StyleSheet.create at module scope (ADR-034).
 */
export default function AccommodationDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { locale } = useLocale();
    const t = (key: string) => getTranslation(key, locale);

    const { data, isLoading, error } = useOwnAccommodation(id);
    const mutation = usePatchAccommodation();

    // Form state — initialised from server data once loaded
    const [fields, setFields] = useState<FormFields>({
        phone: '',
        email: '',
        website: '',
        twitter: '',
        facebook: '',
        instagram: '',
        linkedin: '',
        tiktok: '',
        youtube: '',
        summary: '',
        description: ''
    });

    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Populate form fields once the accommodation loads (or changes).
    // contactInfo uses nested fields: mobilePhone=phone, personalEmail=email, website=website.
    // socialNetworks uses linkedIn (capital I) per ContactInfoSchema.
    useEffect(() => {
        if (!data) return;
        setFields({
            phone: data.contactInfo?.mobilePhone ?? '',
            email: data.contactInfo?.personalEmail ?? '',
            website: data.contactInfo?.website ?? '',
            twitter: data.socialNetworks?.twitter ?? '',
            facebook: data.socialNetworks?.facebook ?? '',
            instagram: data.socialNetworks?.instagram ?? '',
            linkedin: data.socialNetworks?.linkedIn ?? '',
            tiktok: data.socialNetworks?.tiktok ?? '',
            youtube: data.socialNetworks?.youtube ?? '',
            summary: data.summary ?? '',
            description: data.description ?? ''
        });
    }, [data]);

    // ---------------------------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------------------------

    /** Updates a single field in state. */
    function setField(key: keyof FormFields, value: string) {
        setFields((prev) => ({ ...prev, [key]: value }));
        // Clear the per-field error when the user edits
        if (formErrors[key]) {
            setFormErrors((prev) => ({ ...prev, [key]: undefined }));
        }
    }

    /**
     * Validates via Zod safeParse and surfaces per-field errors.
     * On success, calls the PATCH mutation.
     */
    async function handleSave() {
        setSaveSuccess(false);
        setFormErrors({});

        // Build the partial body — omit empty strings (treat as "no change").
        //
        // V1 LIMITATION: clearing an optional field (social URL, website, phone, email)
        // to an empty string omits it from the PATCH body entirely, so the server-side
        // value is NOT removed. Truly unsetting an optional field requires backend
        // null-to-unset support (PATCH body with explicit `null`) and is deferred to a
        // follow-up task. Do NOT add dirty-tracking or change this behavior here.
        const body: AccommodationOperationalUpdate = {};
        if (fields.phone) body.phone = fields.phone;
        if (fields.email) body.email = fields.email;
        if (fields.website) body.website = fields.website;
        if (fields.twitter) body.twitter = fields.twitter;
        if (fields.facebook) body.facebook = fields.facebook;
        if (fields.instagram) body.instagram = fields.instagram;
        if (fields.linkedin) body.linkedin = fields.linkedin;
        if (fields.tiktok) body.tiktok = fields.tiktok;
        if (fields.youtube) body.youtube = fields.youtube;
        if (fields.summary) body.summary = fields.summary;
        if (fields.description) body.description = fields.description;

        const parsed = AccommodationOperationalUpdateSchema.safeParse(body);

        if (!parsed.success) {
            const errors: FormErrors = {};
            for (const issue of parsed.error.issues) {
                const field = issue.path[0] as keyof FormFields | undefined;
                if (field && !errors[field]) {
                    errors[field] = issue.message;
                }
            }
            setFormErrors(errors);
            return;
        }

        if (!id) return;

        mutation.mutate(
            { id, body: parsed.data },
            {
                onSuccess: () => {
                    setSaveSuccess(true);
                    logger.info('Accommodation patched', { id });
                },
                onError: (err) => {
                    logger.error('Accommodation patch failed', { id, error: String(err) });
                    Alert.alert(t('mobile.host.accommodations.edit.error'));
                }
            }
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
                <Text style={styles.loadingText}>
                    {t('mobile.host.accommodations.edit.loading')}
                </Text>
            </View>
        );
    }

    if (error || !data) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>
                    {error
                        ? t('mobile.host.accommodations.edit.error')
                        : t('mobile.host.accommodations.edit.notFound')}
                </Text>
                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => router.back()}
                >
                    <Text style={styles.retryButtonText}>
                        {t('mobile.host.accommodations.retry')}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ---------------------------------------------------------------------------
    // Edit form
    // ---------------------------------------------------------------------------

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
                <Text style={styles.screenTitle}>{t('mobile.host.accommodations.edit.title')}</Text>
                <Text style={styles.accomName}>{data.name}</Text>

                {/* Success banner */}
                {saveSuccess ? (
                    <View style={styles.successBanner}>
                        <Text style={styles.successBannerText}>
                            {t('mobile.host.accommodations.edit.success')}
                        </Text>
                    </View>
                ) : null}

                {/* Section: Contact */}
                <SectionHeader label={t('mobile.host.accommodations.edit.contact')} />

                <TextField
                    label={t('mobile.host.accommodations.edit.phone')}
                    value={fields.phone}
                    onChangeText={(v) => setField('phone', v)}
                    error={formErrors.phone}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <TextField
                    label={t('mobile.host.accommodations.edit.email')}
                    value={fields.email}
                    onChangeText={(v) => setField('email', v)}
                    error={formErrors.email}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <TextField
                    label={t('mobile.host.accommodations.edit.website')}
                    value={fields.website}
                    onChangeText={(v) => setField('website', v)}
                    error={formErrors.website}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                />

                {/* Section: Social */}
                <SectionHeader label={t('mobile.host.accommodations.edit.social')} />

                <TextField
                    label={t('mobile.host.accommodations.edit.twitter')}
                    value={fields.twitter}
                    onChangeText={(v) => setField('twitter', v)}
                    error={formErrors.twitter}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <TextField
                    label={t('mobile.host.accommodations.edit.facebook')}
                    value={fields.facebook}
                    onChangeText={(v) => setField('facebook', v)}
                    error={formErrors.facebook}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <TextField
                    label={t('mobile.host.accommodations.edit.instagram')}
                    value={fields.instagram}
                    onChangeText={(v) => setField('instagram', v)}
                    error={formErrors.instagram}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <TextField
                    label={t('mobile.host.accommodations.edit.linkedin')}
                    value={fields.linkedin}
                    onChangeText={(v) => setField('linkedin', v)}
                    error={formErrors.linkedin}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <TextField
                    label={t('mobile.host.accommodations.edit.tiktok')}
                    value={fields.tiktok}
                    onChangeText={(v) => setField('tiktok', v)}
                    error={formErrors.tiktok}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <TextField
                    label={t('mobile.host.accommodations.edit.youtube')}
                    value={fields.youtube}
                    onChangeText={(v) => setField('youtube', v)}
                    error={formErrors.youtube}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                />

                {/* Section: Summary */}
                <SectionHeader label={t('mobile.host.accommodations.edit.summary')} />

                <TextField
                    label={t('mobile.host.accommodations.edit.summary')}
                    value={fields.summary}
                    onChangeText={(v) => setField('summary', v)}
                    error={formErrors.summary}
                    multiline
                    numberOfLines={3}
                    style={styles.multilineInput}
                    autoCapitalize="sentences"
                />
                <Text style={styles.hint}>{t('mobile.host.accommodations.edit.summaryHint')}</Text>

                {/* Section: Description */}
                <SectionHeader label={t('mobile.host.accommodations.edit.description')} />

                <TextField
                    label={t('mobile.host.accommodations.edit.description')}
                    value={fields.description}
                    onChangeText={(v) => setField('description', v)}
                    error={formErrors.description}
                    multiline
                    numberOfLines={6}
                    style={styles.multilineInput}
                    autoCapitalize="sentences"
                />

                {/* Save button */}
                <TouchableOpacity
                    style={[
                        styles.saveButton,
                        mutation.isPending ? styles.saveButtonDisabled : null
                    ]}
                    onPress={() => void handleSave()}
                    disabled={mutation.isPending}
                    accessibilityRole="button"
                >
                    {mutation.isPending ? (
                        <ActivityIndicator
                            color={theme.colors.semantic.textInverted}
                            size="small"
                        />
                    ) : (
                        <Text style={styles.saveButtonText}>
                            {t('mobile.host.accommodations.edit.save')}
                        </Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

// ---------------------------------------------------------------------------
// SectionHeader
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
    label: string;
}

/** Visual section separator with label. */
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
        marginBottom: theme.spacing[1]
    },
    accomName: {
        fontSize: theme.typography.semantic.body,
        color: theme.colors.neutral[500],
        marginBottom: theme.spacing[5]
    },
    loadingText: {
        marginTop: theme.spacing[3],
        fontSize: theme.typography.semantic.bodySm,
        color: theme.colors.neutral[500]
    },
    errorText: {
        fontSize: theme.typography.semantic.body,
        color: theme.colors.danger[600],
        textAlign: 'center',
        marginBottom: theme.spacing[4]
    },
    retryButton: {
        backgroundColor: theme.colors.river[500],
        borderRadius: theme.radius.semantic.button,
        paddingVertical: theme.spacing[3],
        paddingHorizontal: theme.spacing[6]
    },
    retryButtonText: {
        color: theme.colors.semantic.textInverted,
        fontSize: theme.typography.semantic.button,
        fontWeight: '600'
    },
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
    hint: {
        fontSize: theme.typography.semantic.caption,
        color: theme.colors.neutral[400],
        marginTop: -theme.spacing[3],
        marginBottom: theme.spacing[3]
    },
    multilineInput: {
        height: undefined,
        textAlignVertical: 'top',
        paddingTop: theme.spacing[3]
    },
    saveButton: {
        backgroundColor: theme.colors.accent[500],
        borderRadius: theme.radius.semantic.button,
        paddingVertical: theme.spacing[4],
        paddingHorizontal: theme.spacing[6],
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
        marginTop: theme.spacing[6]
    },
    saveButtonDisabled: {
        backgroundColor: theme.colors.accent[300]
    },
    saveButtonText: {
        fontSize: theme.typography.semantic.button,
        fontWeight: '600',
        color: theme.colors.semantic.textInverted
    }
});
