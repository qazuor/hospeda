/**
 * @file AiChatFab.tsx
 * @description Floating action button for the AI chat widget.
 * Fixed bottom-right, hidden when the chat panel is open.
 *
 * @module AiChatFab
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { ChatIcon } from '@repo/icons';
import styles from './AiChatFab.module.css';

export interface AiChatFabProps {
    readonly isOpen: boolean;
    readonly onClick: () => void;
    readonly locale: SupportedLocale;
}

/**
 * Floating action button that opens the AI chat panel.
 *
 * @param props - isOpen (hides FAB), onClick handler, locale for i18n.
 */
export function AiChatFab({ isOpen, onClick, locale }: AiChatFabProps) {
    if (isOpen) return null;

    const { t } = createTranslations(locale);

    return (
        <button
            type="button"
            className={styles.fab}
            onClick={onClick}
            aria-label={t('accommodations.aiChat.fabLabel')}
        >
            <ChatIcon
                size={24}
                weight="regular"
                aria-hidden="true"
            />
        </button>
    );
}
