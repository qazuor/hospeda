/**
 * StickySaveBar — the explicit-save bar (HOS-2413 T-026, D8).
 *
 * For a form with several fields saved as a whole. Drive it with
 * `useSaveBar`. It is hidden while `clean`; otherwise it is a named `region`
 * that says the state (a polite `status`, or an assertive `alert` on error),
 * offers «Guardar cambios» and «Descartar», and on error «Ir al primer error».
 * While visible it renders a spacer that reserves its height, so the last
 * field stays reachable. Desktop: sticky in the content column. Mobile: fixed
 * to the bottom, safe-area aware, with 44px buttons.
 *
 * It registers NO leave warning itself: `useSaveBar` goes through
 * `useUnsavedChangesGuard`.
 *
 * @module components/account/ui/StickySaveBar
 */

import { createT, type SupportedLocale } from '@/lib/i18n';
import { Button } from './Button';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './StickySaveBar.module.css';
import type { SaveBarStatus } from './use-save-bar';

/** Props of {@link StickySaveBar}. */
export interface StickySaveBarProps {
    /** From `useSaveBar`. */
    readonly status: SaveBarStatus;
    /** Runs the save. */
    readonly onSave: () => void;
    /** Discards the edits. */
    readonly onDiscard: () => void;
    /** Focuses the first invalid field (shown on error). */
    readonly onGoToFirstError?: () => void;
    /** Locale for the copy. */
    readonly locale: SupportedLocale;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The kit save bar.
 *
 * @param props - See {@link StickySaveBarProps}.
 * @returns The bar and its spacer, or `null` while `clean`.
 */
export function StickySaveBar({
    status,
    onSave,
    onDiscard,
    onGoToFirstError,
    locale,
    className,
    helpId
}: StickySaveBarProps) {
    if (status === 'clean') return null;
    const t = createT(locale);
    const busy = status === 'saving';
    const message = t(`account.ui.saveBar.${status}`);

    return (
        <>
            <div
                className={styles.spacer}
                aria-hidden="true"
                data-testid="save-bar-spacer"
            />
            <section
                {...helpAttr({ helpId })}
                aria-label={t('account.ui.saveBar.region')}
                data-status={status}
                className={cx(styles.bar, styles[status], className)}
            >
                <p
                    role={status === 'error' ? 'alert' : 'status'}
                    className={styles.message}
                >
                    <span
                        className={styles.dot}
                        aria-hidden="true"
                    />
                    {message}
                </p>
                <div className={styles.actions}>
                    {status === 'error' && onGoToFirstError ? (
                        <Button
                            variant="ghost"
                            size="lg"
                            onClick={onGoToFirstError}
                        >
                            {t('account.ui.saveBar.goToError')}
                        </Button>
                    ) : null}
                    <Button
                        variant="secondary"
                        size="lg"
                        disabled={busy}
                        onClick={onDiscard}
                    >
                        {t('account.ui.saveBar.discard')}
                    </Button>
                    <Button
                        variant="primary"
                        size="lg"
                        loading={busy}
                        onClick={onSave}
                    >
                        {t('account.ui.saveBar.save')}
                    </Button>
                </div>
            </section>
        </>
    );
}
