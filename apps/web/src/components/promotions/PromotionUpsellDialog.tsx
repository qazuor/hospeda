/**
 * @file PromotionUpsellDialog.tsx
 * @description The VIP upsell a blurred promotion card opens (HOS-2589 §7.6, AC-9).
 *
 * A native `<dialog>` (focus trap and ESC for free). The text reads X (the free
 * quota) and the VIP plan name from the catalog; when either is unknown the copy
 * drops it instead of guessing. The CTA points to the tourist plans page.
 */

import { CrownIcon } from '@repo/icons';
import { useEffect, useId, useRef } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { buildUrl } from '@/lib/urls';
import styles from './PromotionCards.module.css';

/** Props of {@link PromotionUpsellDialog}. */
export interface PromotionUpsellDialogProps {
    readonly locale: SupportedLocale;
    readonly open: boolean;
    readonly onClose: () => void;
    /** X: the free quota; `null` when it could not be read. */
    readonly freeQuota: number | null;
    /** The VIP plan name from the catalog; `null` when it could not be read. */
    readonly vipPlanName: string | null;
}

/**
 * Renders the upsell dialog.
 *
 * @param props - See {@link PromotionUpsellDialogProps}.
 * @returns A native dialog element.
 */
export function PromotionUpsellDialog({
    locale,
    open,
    onClose,
    freeQuota,
    vipPlanName
}: PromotionUpsellDialogProps) {
    const { t, tPlural } = createTranslations(locale);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            if (typeof dialog.showModal === 'function') dialog.showModal();
            else dialog.setAttribute('open', '');
        } else if (!open && dialog.open) {
            if (typeof dialog.close === 'function') dialog.close();
            else dialog.removeAttribute('open');
        }
    }, [open]);

    const body =
        freeQuota === null
            ? t('common.promotions.dialog.bodyNoQuota')
            : tPlural('common.promotions.dialog.body', freeQuota, { count: freeQuota });

    return (
        <dialog
            ref={dialogRef}
            className={`${styles.dialog} dialog-panel`}
            aria-labelledby={titleId}
            onClose={onClose}
            onCancel={onClose}
        >
            <div className={styles.dialogBody}>
                <CrownIcon
                    size="md"
                    aria-hidden="true"
                    className={styles.dialogIcon}
                />
                <h2
                    id={titleId}
                    className={styles.dialogTitle}
                >
                    {t('common.promotions.dialog.title')}
                </h2>
                <p>{body}</p>
                {vipPlanName ? (
                    <p>{t('common.promotions.dialog.plan', undefined, { plan: vipPlanName })}</p>
                ) : null}
                <div className={styles.dialogActions}>
                    <a
                        className={styles.dialogCta}
                        href={buildUrl({ locale, path: PRICING_PAGE_PATH_BY_AUDIENCE.tourist })}
                    >
                        {t('common.promotions.dialog.cta')}
                    </a>
                    <button
                        type="button"
                        className={styles.dialogClose}
                        onClick={onClose}
                    >
                        {t('common.promotions.dialog.close')}
                    </button>
                </div>
            </div>
        </dialog>
    );
}
