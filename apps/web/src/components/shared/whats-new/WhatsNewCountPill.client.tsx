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
 *
 * Inside an icon-only link whose `aria-label` overrides its content (the
 * account header), the pill's own label never reaches the link's accessible
 * name. Pass `labelsParentLink` there: while the count is above zero the pill
 * rewrites the closest link's `aria-label` to include it (plural-aware), and
 * puts the original label back when the count drops to zero or it unmounts.
 */

import { useEffect, useRef } from 'react';
import { useWhatsNew } from '@/hooks/use-whats-new';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './WhatsNew.module.css';

interface WhatsNewCountPillProps {
    readonly locale: SupportedLocale;
    /**
     * Rewrite the closest `<a>`'s `aria-label` to carry the unseen count. Use it
     * only where that link's label overrides its content (icon-only links).
     */
    readonly labelsParentLink?: boolean;
}

/**
 * Renders the unseen what's-new count as a compact inline pill.
 *
 * @param props - Component props.
 * @param props.locale - Active locale for the accessible label.
 * @param props.labelsParentLink - Put the count into the closest link's name.
 * @returns The pill element, or `null` when there is nothing unseen.
 */
export function WhatsNewCountPill({ locale, labelsParentLink = false }: WhatsNewCountPillProps) {
    const { t, tPlural } = createTranslations(locale);
    const { unseenCount } = useWhatsNew();
    const pillRef = useRef<HTMLSpanElement>(null);
    const linkLabel =
        labelsParentLink && unseenCount > 0
            ? tPlural('account.ui.chrome.whatsNewUnread', unseenCount, { count: unseenCount })
            : null;

    useEffect(() => {
        if (!linkLabel) return;
        const link = pillRef.current?.closest('a');
        if (!link) return;
        const original = link.getAttribute('aria-label');
        link.setAttribute('aria-label', linkLabel);
        return () => {
            if (original === null) link.removeAttribute('aria-label');
            else link.setAttribute('aria-label', original);
        };
    }, [linkLabel]);

    if (unseenCount <= 0) {
        return null;
    }

    const label = t('account.whatsNewBadge.unseenCount', '{{count}} sin leer', {
        count: unseenCount
    });

    return (
        <span
            ref={pillRef}
            className={styles.inlineCountPill}
            role="status"
            aria-label={label}
        >
            {unseenCount > 99 ? '99+' : unseenCount}
        </span>
    );
}
