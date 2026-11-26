/**
 * @file ReceiptViewer.client.tsx
 * @description Opens one payment receipt behind the owner's session (HOS-2566).
 *
 * The PDF comes from `GET /api/v1/protected/billing-subscription/receipts/{id}/pdf`.
 * The API is another origin, so a plain `<a href>` would travel without the
 * session cookie and save a 401 to disk. The fetch below carries
 * `credentials: 'include'` and hands the blob over through an object URL.
 *
 * A 404 is shown as «not found»: the API answers the same for a receipt that
 * does not exist and one that belongs to somebody else, and so does this page.
 */

import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/env';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './ReceiptViewer.module.css';

/** Props of {@link ReceiptViewer}. */
export interface ReceiptViewerProps {
    /** The receipt row id, from the page's route. */
    readonly receiptId: string;
    /** Page locale. */
    readonly locale: SupportedLocale;
    /** Where the «back» link goes. */
    readonly backHref: string;
}

type ViewerState =
    | { readonly kind: 'loading' }
    | { readonly kind: 'ready'; readonly objectUrl: string }
    | { readonly kind: 'notFound' }
    | { readonly kind: 'error' };

/**
 * Renders the receipt page body: a status line, then the open/download actions.
 *
 * @param props - See {@link ReceiptViewerProps}.
 */
export function ReceiptViewer({ receiptId, locale, backHref }: ReceiptViewerProps): JSX.Element {
    const { t } = createTranslations(locale);
    const [state, setState] = useState<ViewerState>({ kind: 'loading' });
    const [attempt, setAttempt] = useState(0);

    const load = useCallback(async (): Promise<string | null> => {
        try {
            const response = await fetch(
                `${getApiUrl()}/api/v1/protected/billing-subscription/receipts/${encodeURIComponent(receiptId)}/pdf`,
                { credentials: 'include', headers: { 'X-Client-Locale': locale } }
            );
            if (response.status === 404) {
                setState({ kind: 'notFound' });
                return null;
            }
            if (!response.ok) {
                setState({ kind: 'error' });
                return null;
            }
            const objectUrl = URL.createObjectURL(await response.blob());
            setState({ kind: 'ready', objectUrl });
            return objectUrl;
        } catch {
            setState({ kind: 'error' });
            return null;
        }
    }, [receiptId, locale]);

    // `attempt` re-runs the read when the reader presses «retry».
    // biome-ignore lint/correctness/useExhaustiveDependencies: attempt is the retry trigger
    useEffect(() => {
        setState({ kind: 'loading' });
        let created: string | null = null;
        let cancelled = false;
        void load().then((url) => {
            created = url;
            if (cancelled && url) URL.revokeObjectURL(url);
        });
        return () => {
            cancelled = true;
            if (created) URL.revokeObjectURL(created);
        };
    }, [load, attempt]);

    return (
        <div
            className={styles.root}
            data-testid="receipt-viewer"
            data-state={state.kind}
        >
            {state.kind === 'loading' && (
                <p
                    className={styles.line}
                    role="status"
                >
                    {t('account.subscription.receipts.page.loading')}
                </p>
            )}
            {state.kind === 'ready' && (
                <div className={styles.actions}>
                    <a
                        className={styles.primary}
                        href={state.objectUrl}
                        target="_blank"
                        rel="noopener"
                    >
                        {t('account.subscription.receipts.page.open')}
                    </a>
                    <a
                        className={styles.secondary}
                        href={state.objectUrl}
                        download={`comprobante-${receiptId}.pdf`}
                    >
                        {t('account.subscription.receipts.page.download')}
                    </a>
                </div>
            )}
            {state.kind === 'notFound' && (
                <div role="alert">
                    <p className={styles.line}>
                        {t('account.subscription.receipts.page.notFound')}
                    </p>
                    <p className={styles.hint}>
                        {t('account.subscription.receipts.page.notFoundHint')}
                    </p>
                </div>
            )}
            {state.kind === 'error' && (
                <div role="alert">
                    <p className={styles.line}>{t('account.subscription.receipts.page.error')}</p>
                    <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => setAttempt((n) => n + 1)}
                    >
                        {t('account.subscription.receipts.page.retry')}
                    </button>
                </div>
            )}
            <a
                className={styles.back}
                href={backHref}
            >
                {t('account.subscription.receipts.page.back')}
            </a>
        </div>
    );
}
