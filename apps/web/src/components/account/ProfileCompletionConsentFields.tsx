/**
 * @file ProfileCompletionConsentFields.tsx
 * @description Pure presentational subcomponent for the ProfileCompletion island.
 *
 * Renders the consent block placed at the END of the form:
 *   - Newsletter opt-in checkbox
 *   - Terms & conditions acceptance checkbox
 *
 * Extracted from ProfileCompletionContactFields (SPEC-113 polish) so the
 * consent decisions sit visually at the bottom of the form, after all
 * profile data has been provided.
 *
 * All state lives in `ProfileCompletion.client.tsx`. This component is
 * a pure controlled presentation layer.
 */

import type { SupportedLocale } from '@/lib/i18n';
import type { ProfileCompletionFieldErrors } from './ProfileCompletion.helpers';
import styles from './ProfileCompletion.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Props for the consent-fields subcomponent. */
export interface ProfileCompletionConsentFieldsProps {
    /** Active locale — used for the terms link URL. */
    readonly locale: SupportedLocale;
    /** Whether newsletter opt-in is checked. */
    readonly newsletter: boolean;
    /** Whether terms checkbox is checked. */
    readonly acceptedTerms: boolean;
    /** Field-level errors from the parent. */
    readonly errors: ProfileCompletionFieldErrors;
    /** Whether the form is currently submitting (disables all inputs). */
    readonly submitting: boolean;
    /** Translation function from the parent island. */
    readonly t: (key: string, fallback: string) => string;
    /** Handler for newsletter checkbox change. */
    readonly onNewsletterChange: (checked: boolean) => void;
    /** Handler for terms checkbox change. */
    readonly onAcceptedTermsChange: (checked: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Consent fields subcomponent (newsletter + terms).
 *
 * Rendered at the very end of the profile completion form so the consent
 * decisions are the final step before submitting. Error messages are
 * rendered as passed-in strings (the parent maps i18n keys to translated
 * messages before passing them down via `errors`).
 *
 * @param props - Component props (see {@link ProfileCompletionConsentFieldsProps})
 */
export function ProfileCompletionConsentFields({
    locale,
    newsletter,
    acceptedTerms,
    errors,
    submitting,
    t,
    onNewsletterChange,
    onAcceptedTermsChange
}: ProfileCompletionConsentFieldsProps) {
    return (
        <>
            {/* ── Newsletter opt-in ─────────────────────────────────── */}
            <label className={styles.checkboxRow}>
                <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={newsletter}
                    onChange={(e) => onNewsletterChange(e.target.checked)}
                    disabled={submitting}
                />
                <span className={styles.checkboxLabel}>
                    {t(
                        'account.profileCompletion.fields.newsletter',
                        'Quiero recibir novedades y promociones por email'
                    )}
                </span>
            </label>

            {/* ── Terms acceptance ──────────────────────────────────── */}
            <div className={styles.field}>
                <label className={styles.checkboxRow}>
                    <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={acceptedTerms}
                        onChange={(e) => onAcceptedTermsChange(e.target.checked)}
                        aria-required="true"
                        aria-describedby={errors.terms ? 'pc-terms-error' : undefined}
                        disabled={submitting}
                    />
                    <span className={styles.checkboxLabel}>
                        {t('account.profileCompletion.fields.terms', 'Acepto los')}{' '}
                        <a
                            href={`/${locale}/legal/terminos/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.checkboxLink}
                        >
                            {t(
                                'account.profileCompletion.fields.termsLink',
                                'términos y condiciones'
                            )}
                        </a>
                    </span>
                </label>
                {errors.terms && (
                    <p
                        id="pc-terms-error"
                        className={styles.errorMsg}
                        role="alert"
                    >
                        {errors.terms}
                    </p>
                )}
            </div>
        </>
    );
}
