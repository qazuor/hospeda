import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { getEventCategoryColorScheme, getEventCategoryIcon } from '@repo/icons';
import type { Event } from '../schemas/events.schemas';

/**
 * Maps each uppercase `EventCategoryEnum` value to its i18n label key. Keys are
 * spelled out (not built via template literals) so they stay within the
 * generated `TranslationKey` union.
 */
const CATEGORY_LABEL_KEYS: Readonly<Record<string, TranslationKey>> = {
    CULTURE: 'admin-entities.types.event.culture',
    SPORTS: 'admin-entities.types.event.sports',
    FESTIVAL: 'admin-entities.types.event.festival',
    WORKSHOP: 'admin-entities.types.event.workshop',
    MUSIC: 'admin-entities.types.event.music',
    GASTRONOMY: 'admin-entities.types.event.gastronomy',
    NATURE: 'admin-entities.types.event.nature',
    OTHER: 'admin-entities.types.event.other'
};

/**
 * Category cell for the events list: a colored pill showing the event
 * category's representative icon + localized label. The icon and color tokens
 * come from the cross-app single source of truth in `@repo/icons`, so a
 * category renders identically in admin and web. Colors are applied via inline
 * style using the shared `oklch(from var(--token) …)` scheme; the referenced
 * `--event-category-*` tokens are exposed in the admin theme by
 * `@repo/design-tokens`.
 */
export const EventCategoryBadge = ({ row }: { readonly row: Event }) => {
    const { t } = useTranslations();
    const category = typeof row.category === 'string' ? row.category : '';

    if (!category) {
        return <span className="text-muted-foreground">—</span>;
    }

    const Icon = getEventCategoryIcon({ category });
    const scheme = getEventCategoryColorScheme({ category, variant: 'contrast' });
    const labelKey = CATEGORY_LABEL_KEYS[category.toUpperCase()];
    const label = labelKey ? t(labelKey) : category;

    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium text-xs"
            style={{
                backgroundColor: scheme.bg,
                color: scheme.text,
                borderColor: scheme.border
            }}
        >
            <Icon
                size={14}
                weight="duotone"
                duotoneColor="currentColor"
                aria-hidden="true"
            />
            {label}
        </span>
    );
};
