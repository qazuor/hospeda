/**
 * @file CommerceLeadProcess.tsx
 * @description The "what happens after you submit" explainer and the
 * post-submit confirmation for the commerce lead form (HOS-305).
 *
 * Both surfaces describe the SAME four-step journey, deliberately: the
 * explainer sets the expectation before submitting, and the confirmation
 * repeats it so the applicant is not left with a bare "thanks" and no idea
 * whether anything else is required of them.
 *
 * Step 3 is worded so it is true both today and after HOS-296 ships. Today the
 * approved lead always provisions a NEW account
 * (`apps/api/src/lib/commerce-ports.ts` calls `signUpEmail` with no lookup);
 * once HOS-296 lands it will link to an existing one instead. Neither is
 * promised here — "we email you with the steps to get in" holds either way.
 * Do not add a linking claim until the code does it.
 *
 * Plain sub-components, not islands: they render inside `CommerceLead.client`.
 * Extracted to a sibling file to keep that component under the project's
 * 500-line ceiling.
 */

import { CheckCircleIcon } from '@repo/icons';
import styles from './CommerceLead.module.css';

/** The subset of the i18n API these components need. */
type TranslateFn = (key: string, fallback?: string, params?: Record<string, unknown>) => string;

/** The four journey steps, in order, as `[i18n key, Spanish fallback]`. */
const PROCESS_STEPS: ReadonlyArray<readonly [string, string]> = [
    ['commerce.lead.process.step1', 'Enviás el formulario con los datos de tu negocio.'],
    [
        'commerce.lead.process.step2',
        'Nuestro equipo lo revisa y lo aprueba. Suele tardar entre 24 y 48 horas hábiles.'
    ],
    [
        'commerce.lead.process.step3',
        'Te avisamos por correo cuando esté listo, con los pasos para entrar.'
    ],
    ['commerce.lead.process.step4', 'Completás la publicación y contratás el plan.']
] as const;

/**
 * Renders the four journey steps as an ordered list.
 *
 * @param params.t - Bound translation function
 * @returns The `<ol>` of steps
 */
function ProcessSteps({ t }: { readonly t: TranslateFn }) {
    return (
        <ol className={styles.processSteps}>
            {PROCESS_STEPS.map(([key, fallback]) => (
                <li
                    key={key}
                    className={styles.processStep}
                >
                    {t(key, fallback)}
                </li>
            ))}
        </ol>
    );
}

/**
 * Pre-submit explainer — sets the expectation that a human reviews the
 * application before anything is published.
 *
 * @param params.t - Bound translation function
 * @returns The explainer block rendered above the form fields
 */
export function CommerceLeadProcess({ t }: { readonly t: TranslateFn }) {
    return (
        <section
            className={styles.process}
            aria-labelledby="cl-process-title"
        >
            <h2
                id="cl-process-title"
                className={styles.processTitle}
            >
                {t('commerce.lead.process.title', 'Cómo sigue después de enviarlo')}
            </h2>
            <ProcessSteps t={t} />
        </section>
    );
}

/**
 * Post-submit confirmation — a real page state, not a toast. Confirms what was
 * received, where the reply will land, and repeats the same journey so the
 * applicant knows nothing further is expected of them.
 *
 * @param params.t - Bound translation function
 * @param params.email - The address the lead was submitted with, echoed back
 * @returns The confirmation block that replaces the form
 */
export function CommerceLeadSuccess({
    t,
    email
}: {
    readonly t: TranslateFn;
    readonly email: string;
}) {
    return (
        <div
            className={styles.success}
            role="alert"
            aria-live="assertive"
        >
            <span
                className={styles.successIcon}
                aria-hidden="true"
            >
                <CheckCircleIcon
                    size={64}
                    weight="duotone"
                />
            </span>
            <h2 className={styles.successTitle}>
                {t('commerce.lead.successDetail.title', '¡Listo! Recibimos tu solicitud.')}
            </h2>

            {email && (
                <p className={styles.successSentTo}>
                    {t('commerce.lead.successDetail.sentTo', 'Te vamos a escribir a {{email}}.', {
                        email
                    })}
                </p>
            )}

            <h3 className={styles.successProcessTitle}>
                {t('commerce.lead.successDetail.processTitle', 'Qué pasa ahora')}
            </h3>
            <ProcessSteps t={t} />

            <p className={styles.successClosing}>
                {t(
                    'commerce.lead.successDetail.closing',
                    'No hace falta que hagas nada más por ahora. Si en unos días no tenés novedades, escribinos y lo revisamos.'
                )}
            </p>
        </div>
    );
}
