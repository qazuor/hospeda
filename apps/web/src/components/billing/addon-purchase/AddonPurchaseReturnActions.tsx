import type { AddonPurchaseReadResponseSchema } from '@repo/schemas';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/account/ui/Button';
import { buttonClassName } from '@/components/account/ui/button-class';
import { Field } from '@/components/account/ui/Field';
import { TextInput } from '@/components/account/ui/TextInput';
import { billingAddonApi } from '@/lib/api/endpoints-protected-addons';
import { translateApiError, visibleApiMessage } from '@/lib/api-errors';
import { mintOrderRequestId, purchaseStateFrom } from '@/lib/billing/addon-purchase';
import {
    ADDON_STORE_PATH,
    returnActionsFor,
    returnPurchaseBody
} from '@/lib/billing/addon-purchase-return-actions';
import type { createTranslations, SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './AddonPurchase.module.css';

type Translate = ReturnType<typeof createTranslations>['t'];
type PurchaseRead = z.infer<typeof AddonPurchaseReadResponseSchema>;

const KEY = 'billing.addonPurchase.returnActions';

/**
 * The actions under a recurring add-on purchase the owner came back to (HOS-2680). A pending
 * checkout offers «Reintentar el pago» (the same checkout, never a new purchase) and «Usar otro
 * mail» (a new checkout for another payer; the API releases the old one). A closed purchase
 * offers only «Empezar una compra nueva». A refused request shows the API's message and a link
 * back to the store, so the screen is never a dead end. Renders nothing for any other read or
 * outside the PROCESSING and CLOSED views.
 */
export function AddonPurchaseReturnActions(input: {
    /** The screen view; actions only show while it tells how the purchase is settling. */
    readonly view: string;
    readonly read: PurchaseRead | null;
    /** The email a new checkout starts with: the remembered payer email or the account's. */
    readonly defaultEmail: string;
    readonly locale: SupportedLocale;
    readonly navigateToCheckout?: (url: string) => void;
    readonly t: Translate;
}) {
    const { read, t } = input;
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [storeLink, setStoreLink] = useState(false);
    const [askingEmail, setAskingEmail] = useState(false);
    const [email, setEmail] = useState<string | null>(null);
    // The invalid-email message lives on the field (aria-invalid + aria-describedby); `error` is
    // only for refusals of the request.
    const [emailError, setEmailError] = useState<string | null>(null);
    const emailRef = useRef<HTMLInputElement>(null);
    // «Usar otro mail» unmounts its own button: move focus to the field it opens.
    useEffect(() => {
        if (askingEmail) emailRef.current?.focus();
    }, [askingEmail]);
    const actions = returnActionsFor({ read });
    if (!read || !actions || (input.view !== 'PROCESSING' && input.view !== 'CLOSED')) return null;

    const refused = (message: string) => {
        setError(message);
        setStoreLink(true);
    };

    const send = async (payer: { readonly payerEmail?: string }) => {
        if (busy) return;
        setBusy(true);
        setError(null);
        setNotice(null);
        setStoreLink(false);
        setEmailError(null);
        try {
            const result = await billingAddonApi.purchase({
                body: returnPurchaseBody({
                    read,
                    orderRequestId: mintOrderRequestId(),
                    ...payer
                })
            });
            if (result.ok) {
                const state = purchaseStateFrom({ response: result.data });
                if (state === 'REDIRECT' && result.data.checkoutUrl)
                    (input.navigateToCheckout ?? ((url: string) => window.location.assign(url)))(
                        result.data.checkoutUrl
                    );
                else setNotice(t(`${KEY}.stillPreparing`));
            } else if (result.error.code === 'ADDON_ALREADY_ACTIVE' && actions === 'PENDING')
                // The provider already holds this payment: say so, never offer to pay again. On a
                // closed purchase it means another active instance, so it gets the API copy.
                setNotice(t(`${KEY}.alreadyPaid`));
            else
                refused(
                    translateApiError({
                        error: result.error,
                        t,
                        fallback:
                            visibleApiMessage({ error: result.error }) ??
                            t('billing.addonPurchase.loadError')
                    })
                );
        } catch (cause) {
            refused(cause instanceof Error ? cause.message : t('billing.addonPurchase.loadError'));
        } finally {
            setBusy(false);
        }
    };

    /** A new checkout for the typed payer email, validated before anything is sent. */
    const sendWithEmail = (value: string) => {
        const parsed = z.email().safeParse(value.trim());
        if (!parsed.success) {
            setEmailError(t('billing.addonPurchase.payerEmailInvalid'));
            return;
        }
        void send({ payerEmail: parsed.data });
    };

    const emailValue = email ?? (actions === 'CLOSED' ? input.defaultEmail : '');
    const emailField = (
        <Field
            label={t('billing.addonPurchase.payerEmailLabel')}
            hint={t('billing.addonPurchase.payerEmailHint')}
            error={emailError ?? undefined}
            locale={input.locale}
            required
            className={styles.emailField}
        >
            <TextInput
                ref={emailRef}
                type="email"
                autoComplete="email"
                data-testid="addon-return-email"
                value={emailValue}
                onChange={(event) => {
                    setEmailError(null);
                    setEmail(event.currentTarget.value);
                }}
                required
            />
        </Field>
    );

    return (
        <section
            className={styles.section}
            data-testid="addon-return-actions"
        >
            {actions === 'PENDING' && (
                <div className={styles.actions}>
                    <Button
                        data-testid="addon-return-retry"
                        disabled={busy}
                        loading={busy && !askingEmail}
                        onClick={() => {
                            setAskingEmail(false);
                            // No payer email: a different one would release this purchase.
                            void send({});
                        }}
                    >
                        {t(`${KEY}.retry`)}
                    </Button>
                    {!askingEmail && (
                        <Button
                            variant="secondary"
                            data-testid="addon-return-other-email"
                            disabled={busy}
                            onClick={() => {
                                setError(null);
                                setNotice(null);
                                setStoreLink(false);
                                setAskingEmail(true);
                            }}
                        >
                            {t(`${KEY}.useOtherEmail`)}
                        </Button>
                    )}
                </div>
            )}
            {(actions === 'CLOSED' || askingEmail) && emailField}
            {(actions === 'CLOSED' || askingEmail) && (
                <Button
                    className={styles.confirm}
                    data-testid={
                        actions === 'CLOSED'
                            ? 'addon-return-start-new'
                            : 'addon-return-email-confirm'
                    }
                    disabled={busy}
                    loading={busy}
                    onClick={() => sendWithEmail(emailValue)}
                >
                    {t(actions === 'CLOSED' ? `${KEY}.startNew` : `${KEY}.otherEmailConfirm`)}
                </Button>
            )}
            {notice && (
                <p
                    role="status"
                    data-testid="addon-return-notice"
                >
                    {notice}
                </p>
            )}
            {error && (
                <p
                    role="alert"
                    className={styles.error}
                    data-testid="addon-return-error"
                >
                    {error}
                </p>
            )}
            {storeLink && (
                <a
                    className={buttonClassName({
                        variant: 'secondary',
                        size: 'md',
                        className: styles.confirm
                    })}
                    data-testid="addon-return-store"
                    href={buildUrl({ locale: input.locale, path: ADDON_STORE_PATH })}
                >
                    {t(`${KEY}.backToStore`)}
                </a>
            )}
        </section>
    );
}
