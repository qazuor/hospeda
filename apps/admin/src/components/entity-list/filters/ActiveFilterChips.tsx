/**
 * @file ActiveFilterChips component
 *
 * Renders a horizontal row of FilterChip components for all active filters.
 * Uses aria-live="polite" so screen readers announce changes.
 */

import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { useCallback, useRef } from 'react';
import { FilterChip } from './FilterChip';
import type { FilterChipData } from './filter-types';

type ActiveFilterChipsProps = {
    readonly chips: readonly FilterChipData[];
    readonly onRemove: (paramKey: string) => void;
};

/**
 * Container for active filter chips.
 * Renders a horizontal, wrapping row of removable FilterChip components.
 * Uses aria-live="polite" for screen reader announcements when filters change.
 *
 * @param chips - List of active filter chips to render
 * @param onRemove - Callback invoked with the paramKey of the chip to remove
 */
export const ActiveFilterChips = ({ chips, onRemove }: ActiveFilterChipsProps) => {
    const { t } = useTranslations();
    const containerRef = useRef<HTMLOutputElement>(null);

    const handleRemove = useCallback(
        (paramKey: string, index: number) => {
            onRemove(paramKey);

            // Focus management: after removal, focus next chip's remove button,
            // or previous if last. If none remain, focus fallback targets.
            requestAnimationFrame(() => {
                const container = containerRef.current;
                if (!container) return;

                const buttons = container.querySelectorAll<HTMLButtonElement>(
                    'button[aria-label^="Remove filter"]'
                );

                if (buttons.length === 0) {
                    // No chips left — focus Clear all button, or first filter control
                    const clearBtn = document.querySelector<HTMLButtonElement>(
                        '[data-filter-actions] button'
                    );
                    if (clearBtn) {
                        clearBtn.focus();
                        return;
                    }
                    const firstControl =
                        document.querySelector<HTMLButtonElement>('[role="combobox"]');
                    firstControl?.focus();
                    return;
                }

                const nextIndex = index < buttons.length ? index : buttons.length - 1;
                buttons[nextIndex]?.focus();
            });
        },
        [onRemove]
    );

    if (chips.length === 0) return null;

    return (
        <output
            ref={containerRef}
            className="flex flex-wrap items-center gap-1.5"
            aria-live="polite"
            aria-label={t('admin-filters.activeFilters' as TranslationKey)}
        >
            {chips.map((chip, index) => (
                <FilterChip
                    key={chip.paramKey}
                    chip={chip}
                    onRemove={() => handleRemove(chip.paramKey, index)}
                />
            ))}
        </output>
    );
};
