/**
 * @file WhatsNewCountPill.client.tsx
 * @description Inline unseen-count pill for the "Qué hay de nuevo" account nav
 * item. Renders a small count of unseen what's-new entries, or nothing when
 * there are none.
 *
 * Unlike {@link WhatsNewBadge}, this has NO sparkle button and opens NO panel —
 * the surrounding nav item is itself a link to the what's-new page. It exists so
 * the sidebar keeps the useful "unseen" notification without the redundant
 * second sparkle icon (HOS-131 review feedback).
 */

import { useWhatsNew } from '@/hooks/use-whats-new';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './WhatsNew.module.css';

interface WhatsNewCountPillProps {
    readonly locale: SupportedLocale;
}

/**
 * Renders the unseen what's-new count as a compact inline pill.
 *
 * @param props - Component props.
 * @param props.locale - Active locale for the accessible label.
 * @returns The pill element, or `null` when there is nothing unseen.
 */
export function WhatsNewCountPill({ locale }: WhatsNewCountPillProps) {
    const { t } = createTranslations(locale);
    const { unseenCount } = useWhatsNew();

    if (unseenCount <= 0) {
        return null;
    }

    const label = t('account.whatsNewBadge.unseenCount', '{{count}} sin leer', {
        count: unseenCount
    });

    return (
        <span
            className={styles.inlineCountPill}
            role="status"
            aria-label={label}
        >
            {unseenCount > 99 ? '99+' : unseenCount}
        </span>
    );
}
