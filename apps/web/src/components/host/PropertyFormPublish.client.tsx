/**
 * @file PropertyFormPublish.client.tsx
 * @description Section 8 — Publish section for the PropertyForm wizard.
 * Shows a missing-fields summary and provides Guardar borrador / Publicar actions.
 *
 * Publish flow:
 * - Calls onPublish() which internally runs Zod validation and POSTs/PATCHes to
 *   PATCH /api/v1/protected/accommodations/{id} with { lifecycleState: 'ACTIVE' }
 *   plus full form data and amenityIds.
 * - On success: window.location.href redirected to /alojamientos/{slug} or
 *   fallback to /mi-cuenta/propiedades.
 * - On error: inline error displayed near Publicar button.
 *
 * Toast system: no toast library is wired in apps/web at this time. On success
 * the redirect handles feedback. On error, an inline message is shown.
 * TODO: integrate @repo/notifications or a toast store if added in a later sprint.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './PropertyForm.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for PropertyFormPublish. */
export type PropertyFormPublishProps = {
    /**
     * List of required field paths that are not yet filled.
     * Empty when the form is ready to publish.
     */
    readonly missingRequiredFields: readonly string[];
    /** Whether the form passes all required field checks. */
    readonly isFormComplete: boolean;
    /** Whether a publish or save request is currently in flight. */
    readonly isSubmitting: boolean;
    /** Error message from the last failed publish attempt. */
    readonly publishError: string | null;
    /** Called when "Guardar borrador" is clicked. */
    readonly onSaveDraft: () => void;
    /** Called when "Publicar" is clicked. */
    readonly onPublish: () => Promise<void>;
    /** Active locale for i18n strings. */
    readonly locale: SupportedLocale;
};

// ---------------------------------------------------------------------------
// Styles (extend module CSS)
// ---------------------------------------------------------------------------

// These class names are added to PropertyForm.module.css via the CSS
// extension comment below. They are referenced here but defined in the
// module file to keep CSS co-located.

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Section 8 — Publish for the PropertyForm wizard.
 *
 * Displays a checklist of missing required fields. When the list is empty,
 * shows a green "ready to publish" indicator. Provides always-enabled
 * "Guardar borrador" and conditionally-enabled "Publicar" action buttons.
 *
 * @example
 * ```tsx
 * <PropertyFormPublish
 *   missingRequiredFields={missingRequiredFields}
 *   isFormComplete={isFormComplete}
 *   isSubmitting={form.isSubmitting}
 *   publishError={publishError}
 *   onSaveDraft={triggerSave}
 *   onPublish={handlePublish}
 *   locale={locale}
 * />
 * ```
 */
export function PropertyFormPublish({
    missingRequiredFields,
    isFormComplete,
    isSubmitting,
    publishError,
    onSaveDraft,
    onPublish,
    locale
}: PropertyFormPublishProps) {
    const { t } = createTranslations(locale);

    async function handlePublishClick(): Promise<void> {
        await onPublish();
    }

    return (
        <div className={styles.publishSection}>
            {/* Missing fields summary */}
            {missingRequiredFields.length > 0 ? (
                <section
                    className={styles.missingFieldsBlock}
                    aria-label={t(
                        'host.form.sections.publicar.missingFieldsTitle',
                        'Campos requeridos incompletos'
                    )}
                >
                    <p className={styles.missingFieldsTitle}>
                        {t(
                            'host.form.sections.publicar.missingFieldsTitle',
                            'Campos requeridos incompletos'
                        )}
                    </p>
                    <p className={styles.missingFieldsHint}>
                        {t(
                            'host.form.sections.publicar.missingFieldsHint',
                            'Completá los siguientes campos para poder publicar:'
                        )}
                    </p>
                    <ul
                        className={styles.missingFieldsList}
                        aria-live="polite"
                    >
                        {missingRequiredFields.map((field) => (
                            <li
                                key={field}
                                className={styles.missingFieldItem}
                            >
                                {field}
                            </li>
                        ))}
                    </ul>
                </section>
            ) : (
                <output
                    className={styles.readyBlock}
                    aria-live="polite"
                >
                    <span
                        className={styles.readyIcon}
                        aria-hidden="true"
                    >
                        ✓
                    </span>
                    <p className={styles.readyText}>
                        {t('host.form.sections.publicar.allReady', 'Todo listo para publicar')}
                    </p>
                </output>
            )}

            {/* Publish error */}
            {publishError && (
                <p
                    className={styles.publishError}
                    role="alert"
                    data-testid="publish-error"
                >
                    {publishError}
                </p>
            )}

            {/* Actions row */}
            <div className={styles.publishActions}>
                <button
                    type="button"
                    className={styles.saveDraftBtn}
                    onClick={onSaveDraft}
                    disabled={isSubmitting}
                >
                    {t('host.form.actions.saveDraft', 'Guardar borrador')}
                </button>

                <button
                    type="button"
                    className={`${styles.publishBtn} ${isFormComplete ? '' : styles.publishBtnDisabled}`}
                    onClick={() => {
                        void handlePublishClick();
                    }}
                    disabled={!isFormComplete || isSubmitting}
                    aria-disabled={!isFormComplete || isSubmitting}
                    data-testid="publish-button"
                >
                    {isSubmitting
                        ? t('host.form.actions.publishing', 'Publicando...')
                        : t('host.form.actions.publish', 'Publicar')}
                </button>
            </div>
        </div>
    );
}
