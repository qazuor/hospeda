/**
 * @file PaidSignupsPausedNotice.tsx
 * @description The notice rendered INSTEAD of a checkout CTA while an admin has
 * paused new self-service paid signups (`billing_settings.newPaidSignupsFrozen`,
 * surfaced to the web through `fetchCheckoutConfig`).
 *
 * One component and one pair of i18n keys for every surface the freeze covers
 * — the pricing plan cards, the owner commerce publish CTA and the add-on
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
}

/**
 * "New signups are paused" notice.
 *
 * @param props.locale - Active locale.
 * @param props.testId - Optional `data-testid` (defaults to `paid-signups-paused-notice`).
 * @returns The notice element.
 */
export function PaidSignupsPausedNotice({
    locale,
    testId = 'paid-signups-paused-notice'
}: PaidSignupsPausedNoticeProps): JSX.Element {
    const { t } = createTranslations(locale);

    return (
        <div
            role="status"
            className={styles.notice}
            data-testid={testId}
        >
            <p className={styles.title}>
                {t('billing.checkout.signupsPaused.title', 'Contrataciones nuevas en pausa')}
            </p>
            <p className={styles.body}>
                {t(
                    'billing.checkout.signupsPaused.body',
                    'Por el momento pausamos las suscripciones y compras nuevas. Si ya tenés una suscripción, sigue funcionando con normalidad.'
                )}
            </p>
        </div>
    );
}
