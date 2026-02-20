/**
 * ComingSoon Component
 *
 * Displays a placeholder for features that are planned but not yet implemented.
 * Replaces mock data and broken empty states with clear user communication.
 *
 * @module ComingSoon
 */

import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import type { ReactNode } from 'react';

export interface ComingSoonProps {
    /** i18n key for the feature title */
    readonly titleKey?: TranslationKey;
    /** Direct title string (used if titleKey is not provided) */
    readonly title?: string;
    /** i18n key for the description */
    readonly descriptionKey?: TranslationKey;
    /** Direct description string (used if descriptionKey is not provided) */
    readonly description?: string;
    /** Icon to display above the title */
    readonly icon?: ReactNode;
    /** Additional CSS classes */
    readonly className?: string;
}

/**
 * Renders a "Coming Soon" placeholder for unimplemented features.
 */
export function ComingSoon({
    titleKey,
    title,
    descriptionKey,
    description,
    icon,
    className
}: ComingSoonProps) {
    const { t } = useTranslations();

    const displayTitle = titleKey
        ? t(titleKey)
        : (title ?? t('admin-common.comingSoon.title' as TranslationKey));
    const displayDescription = descriptionKey
        ? t(descriptionKey)
        : (description ?? t('admin-common.comingSoon.description' as TranslationKey));

    return (
        <div
            className={`flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center ${className ?? ''}`}
        >
            {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
            <h3 className="mb-1 font-semibold text-sm">{displayTitle}</h3>
            <p className="max-w-sm text-muted-foreground text-xs">{displayDescription}</p>
        </div>
    );
}
