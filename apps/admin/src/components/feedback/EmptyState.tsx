/**
 * EmptyState Component
 *
 * Displays a placeholder when a table, list, or section has no data.
 * Provides optional action button for creating new items.
 *
 * @module EmptyState
 */

import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
    /** i18n key for the message */
    readonly messageKey?: TranslationKey;
    /** Direct message string (used if messageKey is not provided) */
    readonly message?: string;
    /** Icon to display above the message */
    readonly icon?: ReactNode;
    /** Optional action button */
    readonly action?: ReactNode;
    /** Additional CSS classes */
    readonly className?: string;
}

/**
 * Renders an empty state placeholder for tables and lists.
 */
export function EmptyState({ messageKey, message, icon, action, className }: EmptyStateProps) {
    const { t } = useTranslations();

    const displayMessage = messageKey
        ? t(messageKey)
        : (message ?? t('admin-common.emptyState.noData' as TranslationKey));

    return (
        <div
            className={`flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center ${className ?? ''}`}
        >
            {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
            <p className="mb-4 text-muted-foreground text-sm">{displayMessage}</p>
            {action && <div>{action}</div>}
        </div>
    );
}
