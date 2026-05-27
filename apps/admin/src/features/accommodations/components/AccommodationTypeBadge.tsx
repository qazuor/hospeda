import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { getAccommodationTypeColorScheme, getAccommodationTypeIcon } from '@repo/icons';
import type { Accommodation } from '../schemas/accommodations.schemas';

/**
 * Maps each uppercase `AccommodationTypeEnum` value to its i18n label key.
 * Keys are spelled out (not built via template literals) so they stay within
 * the generated `TranslationKey` union. Note `COUNTRY_HOUSE` → `countryHouse`
 * (camelCase) per the existing admin i18n catalog.
 */
const TYPE_LABEL_KEYS: Readonly<Record<string, TranslationKey>> = {
    HOTEL: 'admin-entities.types.accommodation.hotel',
    HOSTEL: 'admin-entities.types.accommodation.hostel',
    APARTMENT: 'admin-entities.types.accommodation.apartment',
    HOUSE: 'admin-entities.types.accommodation.house',
    COUNTRY_HOUSE: 'admin-entities.types.accommodation.countryHouse',
    CABIN: 'admin-entities.types.accommodation.cabin',
    CAMPING: 'admin-entities.types.accommodation.camping',
    ROOM: 'admin-entities.types.accommodation.room',
    MOTEL: 'admin-entities.types.accommodation.motel',
    RESORT: 'admin-entities.types.accommodation.resort'
};

/**
 * Type cell for the accommodations list: a colored pill showing the
 * accommodation type's representative icon + localized label. The icon and
 * color tokens come from the cross-app single source of truth in `@repo/icons`
 * (also used by `apps/web`), so a type renders identically in admin and web.
 *
 * Colors are applied via inline style using the shared `oklch(from var(--token)
 * …)` scheme (bg 0.15 / border 0.30 / text var); the referenced brand tokens
 * (`--brand-accent`, `--hospeda-forest`, …) are exposed in the admin theme
 * scope by `@repo/design-tokens`.
 */
export const AccommodationTypeBadge = ({ row }: { readonly row: Accommodation }) => {
    const { t } = useTranslations();
    const type = typeof row.type === 'string' ? row.type : '';

    if (!type) {
        return <span className="text-muted-foreground">—</span>;
    }

    const Icon = getAccommodationTypeIcon({ type });
    const scheme = getAccommodationTypeColorScheme({ type, variant: 'contrast' });
    const labelKey = TYPE_LABEL_KEYS[type.toUpperCase()];
    const label = labelKey ? t(labelKey) : type;

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
