/**
 * EmptyState Component
 *
 * Displays a placeholder when a table, list, or section has no data.
 * Provides optional action button for creating new items.
 *
 * @module EmptyState
 */

import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@repo/i18n';
import { ListIcon } from '@repo/icons';
import type { ReactNode } from 'react';
import { EMPTY_SURFACE_CLASS } from './empty-surface';

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
        <div className={cn(EMPTY_SURFACE_CLASS, 'p-12', className)}>
            <div className="mb-3 text-primary">
                {icon ?? (
                    <ListIcon
                        className="h-8 w-8"
                        aria-hidden="true"
                    />
                )}
            </div>
            <p className="mb-4 font-heading text-base text-foreground">{displayMessage}</p>
            {action && <div>{action}</div>}
        </div>
    );
}
