/**
 * @file ProfileEditExtrasSection.tsx
 * @description "Más sobre vos" section — website + occupation fields.
 *
 * Pure presentational subcomponent — all state lives in
 * `ProfileEditForm.client.tsx`. Introduced in the SPEC-113 polish round
 * so the profile edit page can display + persist the extended profile
 * fields collected during signup.
 */

import type { ProfileEditFieldErrors } from './ProfileEditForm.helpers';
import styles from './ProfileEditForm.module.css';

/** Props for the extras section. */
export interface ProfileEditExtrasSectionProps {
    readonly website: string;
    readonly occupation: string;
    readonly fieldErrors: ProfileEditFieldErrors;
    readonly submitting: boolean;
    readonly t: (key: string, fallback?: string) => string;
    readonly onWebsiteChange: (value: string) => void;
    readonly onOccupationChange: (value: string) => void;
}

/**
 * Renders the website + occupation inputs.
 *
 * @param props - Component props (see {@link ProfileEditExtrasSectionProps})
 */
export function ProfileEditExtrasSection({
    website,
    occupation,
    fieldErrors,
    submitting,
    t,
    onWebsiteChange,
    onOccupationChange
}: ProfileEditExtrasSectionProps) {
    return (
        <section
            className={styles.section}
            aria-labelledby="extras-section-title"
        >
            <h3
                className={styles.sectionTitle}
                id="extras-section-title"
            >
                {t('account.pages.editProfile.extrasSection', 'Más sobre vos')}
            </h3>
            <div className={styles.grid}>
                {/* website */}
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="website"
                    >
                        {t('account.editProfile.fields.website', 'Sitio web')}
                    </label>
                    <input
                        id="website"
                        type="url"
                        className={`${styles.input} ${fieldErrors.website ? styles.inputError : ''}`}
                        value={website}
                        onChange={(e) => onWebsiteChange(e.target.value)}
                        placeholder="https://mipagina.com"
                        aria-describedby={fieldErrors.website ? 'website-error' : undefined}
                        autoComplete="url"
                        disabled={submitting}
                    />
                    {fieldErrors.website && (
                        <p
                            id="website-error"
                            className={styles.errorMsg}
                            role="alert"
                        >
                            {fieldErrors.website}
                        </p>
                    )}
                </div>

                {/* occupation */}
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="occupation"
                    >
                        {t('account.editProfile.fields.occupation', 'Ocupación')}
                    </label>
                    <input
                        id="occupation"
                        type="text"
                        className={`${styles.input} ${fieldErrors.occupation ? styles.inputError : ''}`}
                        value={occupation}
                        onChange={(e) => onOccupationChange(e.target.value)}
                        maxLength={100}
                        aria-describedby={fieldErrors.occupation ? 'occupation-error' : undefined}
                        autoComplete="organization-title"
                        disabled={submitting}
                    />
                    {fieldErrors.occupation && (
                        <p
                            id="occupation-error"
                            className={styles.errorMsg}
                            role="alert"
                        >
                            {fieldErrors.occupation}
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
}
