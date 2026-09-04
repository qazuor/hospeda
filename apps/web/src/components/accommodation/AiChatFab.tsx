/**
 * @file AiChatFab.tsx
 * @description Floating action button for the AI chat widget.
 * Fixed bottom-right, hidden when the chat panel is open.
 *
 * @module AiChatFab
 */

import { ChatIcon } from '@repo/icons';
import type { AiChatEntityType } from '@repo/schemas';
import { forwardRef } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './AiChatFab.module.css';
import { aiChatCopyKey } from './AiChatWidget';

export interface AiChatFabProps {
    /** Which kind of listing the chat is about, for the vertical-specific label. */
    readonly entityType: AiChatEntityType;
    readonly isOpen: boolean;
    readonly onClick: () => void;
    readonly locale: SupportedLocale;
}

/**
 * Floating action button that opens the AI chat panel.
 * Accepts a forwarded ref so `AiChatWidget` can return focus to this button
 * on panel close (WCAG 2.1 AA dialog pattern).
 *
 * @param props - isOpen (hides FAB), onClick handler, locale for i18n.
 * @param ref - Forwarded ref to the underlying `<button>` element.
 */
export const AiChatFab = forwardRef<HTMLButtonElement, AiChatFabProps>(function AiChatFab(
    { isOpen, onClick, locale, entityType },
    ref
) {
    if (isOpen) return null;

    const { t } = createTranslations(locale);

    return (
        <button
            ref={ref}
            type="button"
            className={styles.fab}
            onClick={onClick}
            aria-label={t(aiChatCopyKey(entityType, 'fabLabel'))}
        >
            <ChatIcon
                size={24}
                weight="regular"
                aria-hidden="true"
            />
        </button>
    );
});

AiChatFab.displayName = 'AiChatFab';
