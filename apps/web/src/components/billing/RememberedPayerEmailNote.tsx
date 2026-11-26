import { useMemo } from 'react';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import styles from './RememberedPayerEmailNote.module.css';

/** Props for the note shown in place of the payer-email field when one is remembered. */
export interface RememberedPayerEmailNoteProps {
    readonly locale: SupportedLocale;
    /** The email declared on the account's last approved charge. Never a confirmed identity. */
    readonly email: string;
    /** Opens the editable field so the payer can enter another email. */
    readonly onChange: () => void;
}

/**
 * Tells the payer which declared email the checkout will use (HOS-2616) and why a mismatch on
 * the Mercado Pago page means a different account, with a button to enter another email.
 */
export function RememberedPayerEmailNote({
    locale,
    email,
    onChange
}: RememberedPayerEmailNoteProps) {
    const { t } = useMemo(() => createTranslations(locale), [locale]);
    return (
        <div
            className={styles.note}
            data-testid="remembered-payer-email-note"
        >
            <p className={styles.text}>
                {t('billing.common.rememberedPayerEmail', undefined, { email })}
            </p>
            <button
                type="button"
                className={styles.change}
                data-testid="remembered-payer-email-change"
                onClick={onChange}
            >
                {t('billing.common.rememberedPayerEmailChange')}
            </button>
        </div>
    );
}
