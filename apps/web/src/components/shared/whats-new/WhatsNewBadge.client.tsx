/**
 * @file WhatsNewBadge.client.tsx
 * @description What's New icon button with unseen count pill for the account sidebar.
 *
 * Opens the WhatsNewPanel slide-over on click.
 */

import { useWhatsNew } from '@/hooks/use-whats-new';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { SparkleIcon } from '@repo/icons';
import { useCallback, useState } from 'react';
import styles from './WhatsNew.module.css';
import { WhatsNewPanel } from './WhatsNewPanel.client';

interface WhatsNewBadgeProps {
    readonly locale: SupportedLocale;
}

export function WhatsNewBadge({ locale }: WhatsNewBadgeProps) {
    const { t } = createTranslations(locale);
    const { unseenCount } = useWhatsNew();
    const [panelOpen, setPanelOpen] = useState(false);

    const handleClick = useCallback(() => {
        setPanelOpen(true);
    }, []);

    const handlePanelChange = useCallback((open: boolean) => {
        setPanelOpen(open);
    }, []);

    const ariaLabel =
        unseenCount > 0
            ? `${t('account.whatsNewBadge.label')} — ${t('account.whatsNewBadge.unseenCount', '{{count}} sin leer', { count: unseenCount })}`
            : t('account.whatsNewBadge.labelNone');

    return (
        <>
            <div className={styles.badgeRoot}>
                <button
                    type="button"
                    className={styles.badgeButton}
                    aria-label={ariaLabel}
                    title={ariaLabel}
                    onClick={handleClick}
                >
                    <SparkleIcon
                        size={20}
                        weight="regular"
                        aria-hidden="true"
                    />
                </button>

                {unseenCount > 0 && (
                    <span
                        aria-hidden="true"
                        className={styles.countPill}
                    >
                        {unseenCount > 99 ? '99+' : unseenCount}
                    </span>
                )}
            </div>

            <WhatsNewPanel
                locale={locale}
                open={panelOpen}
                onOpenChange={handlePanelChange}
            />
        </>
    );
}
