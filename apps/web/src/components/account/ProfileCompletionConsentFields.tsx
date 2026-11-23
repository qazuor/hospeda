/**
 * @file ProfileCompletionConsentFields.tsx
 * @description Pure presentational subcomponent for the ProfileCompletion island.
 *
 * Renders the consent block placed at the END of the form: the newsletter
 * opt-in and the terms acceptance, as kit checkboxes (HOS-2501).
 *
 * All state lives in `ProfileCompletion.client.tsx`. This component is a pure
 * controlled presentation layer.
 */

import { FieldError } from '@/components/ui/FieldError';
import type { FieldErrors } from '@/lib/forms/field-errors';
import type { SupportedLocale } from '@/lib/i18n';
import styles from './ProfileCompletion.module.css';
import { Checkbox, TextLink } from './ui';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Props for the consent-fields subcomponent. */
export interface ProfileCompletionConsentFieldsProps {
    /** Active locale — used for the terms link URL. */
    readonly locale: SupportedLocale;
    /** Whether newsletter opt-in is checked. */
    readonly newsletter: boolean;
    /** Whether terms checkbox is checked. */
    readonly acceptedTerms: boolean;
    /** Field-level errors from the parent (`terms` aliases the schema's `acceptedTerms`). */
    readonly errors: FieldErrors;
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
        <div className={styles.consent}>
            {/* ── Newsletter opt-in ─────────────────────────────────── */}
            <Checkbox
                checked={newsletter}
                onChange={(e) => onNewsletterChange(e.target.checked)}
                disabled={submitting}
                label={t(
                    'account.profileCompletion.fields.newsletter',
                    'Quiero recibir novedades y promociones por email'
                )}
            />

            {/* ── Terms acceptance ──────────────────────────────────── */}
            <div>
                <Checkbox
                    checked={acceptedTerms}
                    onChange={(e) => onAcceptedTermsChange(e.target.checked)}
                    aria-required="true"
                    aria-describedby={errors.terms ? 'pc-terms-error' : undefined}
                    invalid={Boolean(errors.terms)}
                    disabled={submitting}
                    label={
                        <>
                            {t('account.profileCompletion.fields.terms', 'Acepto los')}{' '}
                            <TextLink
                                href={`/${locale}/legal/terminos/`}
                                external
                                locale={locale}
                            >
                                {t(
                                    'account.profileCompletion.fields.termsLink',
                                    'términos y condiciones'
                                )}
                            </TextLink>
                        </>
                    }
                />
                <FieldError
                    id="pc-terms-error"
                    message={errors.terms}
                />
            </div>
        </div>
    );
}
