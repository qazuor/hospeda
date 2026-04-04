/**
 * @file FilterChip component
 *
 * Renders a single removable filter chip showing the filter label,
 * its active value, and an optional "(default)" annotation.
 */

import { Badge } from '@/components/ui-wrapped/Badge';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { CloseIcon } from '@repo/icons';
import type { FilterChipData } from './filter-types';

type FilterChipProps = {
    readonly chip: FilterChipData;
    readonly onRemove: () => void;
};

/**
 * Individual removable filter chip.
 *
 * Shows the filter label, its display value, and an optional "(default)" badge
 * when the filter originates from a default value rather than a user selection.
 * Default-origin chips render with the `secondary` variant; user-applied chips
 * use the `outline` variant.
 *
 * @param chip - Computed filter chip data including label, value, and origin metadata
 * @param onRemove - Callback invoked when the user removes the filter
 */
export const FilterChip = ({ chip, onRemove }: FilterChipProps) => {
    const { t } = useTranslations();

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onRemove();
        }
    };

    const label = t(chip.labelKey as TranslationKey);
    const ariaLabel = `Remove filter ${label}: ${chip.displayValue}`;

    return (
        <Badge
            variant={chip.isDefault ? 'secondary' : 'outline'}
            size="sm"
            rightIcon={
                <button
                    type="button"
                    onClick={onRemove}
                    onKeyDown={handleKeyDown}
                    aria-label={ariaLabel}
                    tabIndex={0}
                    className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 focus:outline-none focus:ring-1 focus:ring-ring"
                >
                    <CloseIcon size={14} />
                </button>
            }
        >
            <span className="font-medium">{label}:</span> <span>{chip.displayValue}</span>
            {chip.isDefault && (
                <span className="ml-1 text-muted-foreground">
                    ({t('admin-filters.defaultBadge' as TranslationKey)})
                </span>
            )}
        </Badge>
    );
};
