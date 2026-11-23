/**
 * @file ProfileEditAboutSection.tsx
 * @description "Sobre vos" section of the profile edit form: bio and
 * occupation. Presentational.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { PROFILE_FIELD_PREFIX, ProfileTextField } from './ProfileEditFields';
import type { ProfileEditFieldErrors } from './ProfileEditForm.helpers';
import styles from './ProfileEditForm.module.css';
import { Field } from './ui/Field';
import { Section } from './ui/Section';
import { Textarea } from './ui/Textarea';

/** Server-aligned maximum length of the bio. */
const BIO_MAX_LENGTH = 300;

/** Props of {@link ProfileEditAboutSection}. */
export interface ProfileEditAboutSectionProps {
    readonly locale: SupportedLocale;
    readonly t: (key: string, fallback?: string) => string;
    readonly bio: string;
    readonly occupation: string;
    readonly fieldErrors: ProfileEditFieldErrors;
    readonly submitting: boolean;
    readonly onBioChange: (value: string) => void;
    readonly onOccupationChange: (value: string) => void;
}

/**
 * About section.
 *
 * @param props - See {@link ProfileEditAboutSectionProps}.
 */
export function ProfileEditAboutSection({
    locale,
    t,
    bio,
    occupation,
    fieldErrors,
    submitting,
    onBioChange,
    onOccupationChange
}: ProfileEditAboutSectionProps) {
    return (
        <Section
            title={t('account.pages.editProfile.aboutSection')}
            helpId="section:profile.about"
        >
            <div className={styles.grid}>
                <Field
                    label={t('account.editProfile.fields.bio', 'Biografía')}
                    locale={locale}
                    idParts={{ prefix: PROFILE_FIELD_PREFIX, name: 'bio' }}
                    error={fieldErrors.bio}
                    className={styles.full}
                >
                    <Textarea
                        value={bio}
                        onChange={(event) => onBioChange(event.target.value)}
                        limit={BIO_MAX_LENGTH}
                        locale={locale}
                        rows={4}
                        disabled={submitting}
                    />
                </Field>
                <ProfileTextField
                    name="occupation"
                    label={t('account.editProfile.fields.occupation')}
                    locale={locale}
                    value={occupation}
                    onChange={onOccupationChange}
                    error={fieldErrors.occupation}
                    maxLength={100}
                    autoComplete="organization-title"
                    disabled={submitting}
                />
            </div>
        </Section>
    );
}
