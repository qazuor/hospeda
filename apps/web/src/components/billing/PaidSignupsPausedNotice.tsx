/**
 * @file PaidSignupsPausedNotice.tsx
 * @description The notice rendered INSTEAD of a checkout CTA while an admin has
 * paused new self-service paid signups (`billing_settings.newPaidSignupsFrozen`,
 * surfaced to the web through `fetchCheckoutConfig`).
 *
 * One component and one pair of i18n keys for every surface the freeze covers
 * — the pricing plan cards, the owner listing publish CTA and the add-on
 * purchase cards — so the three never drift into three different promises.
 * Rendered with `role="status"`: it is information, not an error.
 */

import type { JSX } from 'react';
import type { SupportedLocale } from '../../lib/i18n';
import { createTranslations } from '../../lib/i18n';
import styles from './PaidSignupsPausedNotice.module.css';

/** Props for {@link PaidSignupsPausedNotice}. */
export interface PaidSignupsPausedNoticeProps {
    /** Active locale for the copy. */
    readonly locale: SupportedLocale;
    /** Optional test id, so each surface can be targeted independently. */
    readonly testId?: string;
    /**
     * Which promise the notice makes. `signup` (default) is for checkouts and
     * purchases; `firstPublish` is for a host's FIRST publish, which starts a
     * trial and is paused too — its copy says the listing stays a draft.
     */
    readonly variant?: PaidSignupsPausedVariant;
}

/** The two copies the notice can carry. */
export type PaidSignupsPausedVariant = 'signup' | 'firstPublish';

/** i18n keys + Spanish fallbacks per variant. */
const COPY_BY_VARIANT: Readonly<
    Record<
        PaidSignupsPausedVariant,
        {
            readonly titleKey: string;
            readonly titleFallback: string;
            readonly bodyKey: string;
            readonly bodyFallback: string;
        }
    >
> = {
    signup: {
        titleKey: 'billing.checkout.signupsPaused.title',
        titleFallback: 'Contrataciones nuevas en pausa',
        bodyKey: 'billing.checkout.signupsPaused.body',
        bodyFallback:
            'Por el momento pausamos las suscripciones y compras nuevas. Si ya tenés una suscripción, sigue funcionando con normalidad.'
    },
    firstPublish: {
        titleKey: 'billing.checkout.firstPublishPaused.title',
        titleFallback: 'Publicación de fichas nuevas en pausa',
        bodyKey: 'billing.checkout.firstPublishPaused.body',
        bodyFallback:
            'Por el momento pausamos la publicación de fichas nuevas. Tu ficha queda guardada como borrador y vas a poder publicarla cuando se reanuden.'
    }
};

/**
 * "New signups are paused" notice.
 *
 * @param props.locale - Active locale.
 * @param props.testId - Optional `data-testid` (defaults to `paid-signups-paused-notice`).
 * @param props.variant - `signup` (default) or `firstPublish`.
 * @returns The notice element.
 */
export function PaidSignupsPausedNotice({
    locale,
    testId = 'paid-signups-paused-notice',
    variant = 'signup'
}: PaidSignupsPausedNoticeProps): JSX.Element {
    const { t } = createTranslations(locale);
    const copy = COPY_BY_VARIANT[variant];

    return (
        <div
            role="status"
            className={styles.notice}
            data-testid={testId}
        >
            <p className={styles.title}>{t(copy.titleKey, copy.titleFallback)}</p>
            <p className={styles.body}>{t(copy.bodyKey, copy.bodyFallback)}</p>
        </div>
    );
}
