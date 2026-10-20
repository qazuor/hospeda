import { type FormEvent, useState } from 'react';
import { type PublishVerticalSlug, promoCodeApi } from '@/lib/api/endpoints-protected';
import {
    parseRedeemResult,
    readRedeemRejection,
    resolveRedeemNotice
} from '@/lib/billing/promo-redeem';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import styles from './PromoCodeRedeem.module.css';

export interface PromoCodeRedeemProps {
    readonly vertical: PublishVerticalSlug;
    readonly locale: SupportedLocale;
    readonly offer: 'SUBSCRIPTION' | 'TRIAL';
}
type State = 'idle' | 'pending' | 'done' | 'rejected' | 'error';

/** Inline promo redemption for subscriptions and active trials. */
export function PromoCodeRedeem({ vertical, locale, offer }: PromoCodeRedeemProps) {
    const { t, tPlural } = createTranslations(locale);
    const [code, setCode] = useState('');
    const [state, setState] = useState<State>('idle');
    const [lines, setLines] = useState<
        readonly {
            readonly key: string;
            readonly params?: Readonly<Record<string, string | number>>;
        }[]
    >([]);
    const [reason, setReason] = useState<string | null>(null);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setState('pending');
        setReason(null);
        try {
            const result = await promoCodeApi.redeem({
                code: code.toUpperCase().replace(/\s+/g, ''),
                vertical
            });
            if (!result.ok) {
                const rejected = readRedeemRejection({ result });
                setReason(rejected);
                setState(rejected ? 'rejected' : 'error');
                return;
            }
            const parsed = parseRedeemResult({ result });
            if (!parsed) {
                setState('error');
                return;
            }
            setLines(resolveRedeemNotice({ result: parsed, locale }));
            setState('done');
        } catch {
            setState('error');
        }
    }

    const titleKey =
        offer === 'TRIAL'
            ? 'account.subscription.promoRedeem.trialTitle'
            : 'account.subscription.promoRedeem.subscriptionTitle';
    return (
        <section
            className={styles.root}
            data-testid="promo-redeem"
            data-vertical={vertical}
        >
            <h3>{t(titleKey)}</h3>
            <form onSubmit={(event) => void submit(event)}>
                <label htmlFor={`promo-code-${vertical}-${offer}`}>
                    {t('account.subscription.promoRedeem.label')}
                </label>
                <input
                    id={`promo-code-${vertical}-${offer}`}
                    name="code"
                    autoComplete="off"
                    value={code}
                    onChange={(event) => setCode(event.currentTarget.value)}
                    required
                    maxLength={64}
                />
                <button
                    className={styles.submit}
                    type="submit"
                    disabled={state === 'pending'}
                >
                    {t(
                        state === 'pending'
                            ? 'account.subscription.promoRedeem.pending'
                            : 'account.subscription.promoRedeem.submit'
                    )}
                </button>
            </form>
            <div
                className={styles.result}
                aria-live="polite"
            >
                {state === 'done' && (
                    <div data-testid="promo-redeem-notice">
                        {lines.map((line) => (
                            <p key={line.key}>
                                {line.params?.count === undefined
                                    ? t(line.key, undefined, line.params)
                                    : tPlural(line.key, line.params.count as number, line.params)}
                            </p>
                        ))}
                    </div>
                )}
                {state === 'rejected' && reason && (
                    <p data-testid="promo-redeem-error">{t(`common.apiError.${reason}`)}</p>
                )}
                {state === 'error' && (
                    <p data-testid="promo-redeem-error">
                        {t('account.subscription.promoRedeem.error')}
                    </p>
                )}
            </div>
        </section>
    );
}
