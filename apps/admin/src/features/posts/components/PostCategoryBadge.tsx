import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { getPostCategoryColorScheme, getPostCategoryIcon } from '@repo/icons';
import type { Post } from '../schemas/posts.schemas';

/**
 * Maps each uppercase `PostCategoryEnum` value to its i18n label key. Spelled
 * out (not built via template literals) so they stay within the generated
 * `TranslationKey` union.
 */
const CATEGORY_LABEL_KEYS: Readonly<Record<string, TranslationKey>> = {
    EVENTS: 'admin-entities.types.postCategory.events',
    CULTURE: 'admin-entities.types.postCategory.culture',
    GASTRONOMY: 'admin-entities.types.postCategory.gastronomy',
    NATURE: 'admin-entities.types.postCategory.nature',
    TOURISM: 'admin-entities.types.postCategory.tourism',
    GENERAL: 'admin-entities.types.postCategory.general',
    SPORT: 'admin-entities.types.postCategory.sport',
    CARNIVAL: 'admin-entities.types.postCategory.carnival',
    NIGHTLIFE: 'admin-entities.types.postCategory.nightlife',
    HISTORY: 'admin-entities.types.postCategory.history',
    TRADITIONS: 'admin-entities.types.postCategory.traditions',
    WELLNESS: 'admin-entities.types.postCategory.wellness',
    FAMILY: 'admin-entities.types.postCategory.family',
    TIPS: 'admin-entities.types.postCategory.tips',
    ART: 'admin-entities.types.postCategory.art',
    BEACH: 'admin-entities.types.postCategory.beach',
    RURAL: 'admin-entities.types.postCategory.rural',
    FESTIVALS: 'admin-entities.types.postCategory.festivals'
};

/**
 * Category cell for the posts list: a colored pill showing the post
 * category's representative icon + localized label. The icon and color
 * tokens come from the cross-app single source of truth in `@repo/icons`,
 * so a category renders identically in admin and web. Colors are applied
 * via inline style using the shared `oklch(from var(--token) …)` scheme;
 * the referenced `--post-category-*` tokens are exposed in the admin
 * theme by `@repo/design-tokens`.
 */
export const PostCategoryBadge = ({ row }: { readonly row: Post }) => {
    const { t } = useTranslations();
    const category = typeof row.category === 'string' ? row.category : '';

    if (!category) {
        return <span className="text-muted-foreground">—</span>;
    }

    const Icon = getPostCategoryIcon({ category });
    const scheme = getPostCategoryColorScheme({ category, variant: 'contrast' });
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
