/**
 * @file ActiveFilterChips.tsx
 * @description Removable filter chips for the conversational AI search panel.
 * SPEC-212 T-011.
 *
 * Renders one chip per active key in `SearchIntentEntities`. Each chip displays
 * a human-readable label and a keyboard-operable remove (×) button. Clicking
 * remove calls `onRemove(key)`, which drops the filter and re-runs the
 * accommodations search without starting a new LLM turn (the hook handles this).
 *
 * Label strategy:
 * - `accommodationType`: translated type name via `accommodations.types.*`
 * - Numeric ranges (`minGuests`, `maxPrice`, etc.): formatted with
 *   `aiSearch.chips.*` keys that accept a `{{value}}` interpolation.
 * - Booleans (`hasPool`, `hasWifi`, `allowsPets`, `hasParking`): fixed label
 *   per flag from `aiSearch.chips.*`.
 * - Arrays (`amenitySlugs`, `featureSlugs`): single chip showing item count
 *   or short join, removing the whole array.
 * - Location (`city`, `destinationId`): show the value directly or a generic
 *   label. `locationType`, `latitude`, `longitude`, `radius` → "Ubicación".
 * - Dates (`checkIn`, `checkOut`): formatted date string.
 * - `currency`: helper chip if set (rarely shown alone, no remove button).
 *
 * @module ActiveFilterChips
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { SearchIntentEntities } from '@repo/schemas';
import styles from './ActiveFilterChips.module.css';

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * Props for {@link ActiveFilterChips}.
 *
 * @property filters - Active filter intent state from `useSearchChat`.
 *   When null or empty, nothing is rendered.
 * @property onRemove - Callback invoked with the intent key to drop.
 *   The hook re-runs the accommodations search after removal.
 * @property locale - Active locale used for label translation.
 * @property destinations - Optional catalog of `{ [uuid]: name }` for
 *   resolving `destinationId` chips (SPEC-265 A3). When provided, the
 *   destination chip shows the real city name instead of "Destino filtrado".
 */
export interface ActiveFilterChipsProps {
    readonly filters: SearchIntentEntities | null;
    readonly onRemove: (key: keyof SearchIntentEntities) => void;
    readonly locale: SupportedLocale;
    readonly destinations?: Readonly<Record<string, string>>;
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Keys treated as location markers — all resolve to a single generic location
 * chip label instead of showing raw coordinates or internal enum values.
 */
const LOCATION_KEYS = new Set<keyof SearchIntentEntities>([
    'locationType',
    'latitude',
    'longitude',
    'radius'
]);

/**
 * Map from boolean field name to its i18n chip key.
 * The value is a ready-to-use string (no interpolation needed).
 */
const BOOLEAN_CHIP_KEYS: Partial<Record<keyof SearchIntentEntities, string>> = {
    hasPool: 'aiSearch.chips.hasPool',
    hasWifi: 'aiSearch.chips.hasWifi',
    allowsPets: 'aiSearch.chips.allowsPets',
    hasParking: 'aiSearch.chips.hasParking'
};

/**
 * Accommodation type enum value → `accommodations.types.*` i18n key suffix.
 * The enum values are uppercase; the i18n keys are lowercase.
 */
const ACCOMMODATION_TYPE_KEYS: Record<string, string> = {
    APARTMENT: 'accommodations.types.apartment',
    HOUSE: 'accommodations.types.house',
    COUNTRY_HOUSE: 'accommodations.types.country_house',
    CABIN: 'accommodations.types.cabin',
    HOTEL: 'accommodations.types.hotel',
    HOSTEL: 'accommodations.types.hostel',
    CAMPING: 'accommodations.types.camping',
    ROOM: 'accommodations.types.room',
    MOTEL: 'accommodations.types.motel',
    RESORT: 'accommodations.types.resort'
};

/**
 * Numeric range fields mapped to their i18n chip key (accept {{value}}).
 */
const NUMERIC_CHIP_KEYS: Partial<Record<keyof SearchIntentEntities, string>> = {
    minGuests: 'aiSearch.chips.minGuests',
    maxGuests: 'aiSearch.chips.maxGuests',
    minPrice: 'aiSearch.chips.minPrice',
    maxPrice: 'aiSearch.chips.maxPrice',
    minRating: 'aiSearch.chips.minRating',
    maxRating: 'aiSearch.chips.maxRating',
    minBedrooms: 'aiSearch.chips.minBedrooms',
    maxBedrooms: 'aiSearch.chips.maxBedrooms',
    minBathrooms: 'aiSearch.chips.minBathrooms',
    maxBathrooms: 'aiSearch.chips.maxBathrooms'
};

// ─── Label resolution ──────────────────────────────────────────────────────────

/**
 * Resolved chip descriptor — label text and whether the chip is renderable.
 */
interface ChipDescriptor {
    readonly label: string;
    readonly visible: boolean;
}

/**
 * Resolve the human-readable label for a single `SearchIntentEntities` key/value
 * pair.
 *
 * Returns `visible: false` for:
 * - Null / undefined values.
 * - Boolean fields that are `false` (no active filter).
 * - Empty arrays.
 * - The `currency` key (always a companion of price fields, not shown alone).
 *
 * @param key - The SearchIntentEntities key.
 * @param value - The raw value from the filters object.
 * @param t - Bound translation function.
 * @returns A chip descriptor with a label and visibility flag.
 */
function resolveChipLabel(
    key: keyof SearchIntentEntities,
    value: unknown,
    t: ReturnType<typeof createTranslations>['t'],
    destinations?: Readonly<Record<string, string>>
): ChipDescriptor {
    // Skip undefined/null.
    if (value === undefined || value === null) {
        return { label: '', visible: false };
    }

    // Currency is a companion field — never render it as a standalone chip.
    if (key === 'currency') {
        return { label: '', visible: false };
    }

    // Boolean shortcuts — skip when false.
    if (key in BOOLEAN_CHIP_KEYS) {
        if (value === false) return { label: '', visible: false };
        const i18nKey = BOOLEAN_CHIP_KEYS[key] as string;
        return { label: t(i18nKey, key), visible: true };
    }

    // Location geo/internal keys — merge into a generic "Ubicación" chip.
    if (LOCATION_KEYS.has(key)) {
        return {
            label: t('aiSearch.chips.location', 'Ubicación'),
            visible: true
        };
    }

    // Accommodation type — reuse canonical type label.
    if (key === 'accommodationType') {
        const typeVal = String(value);
        const typeI18nKey = ACCOMMODATION_TYPE_KEYS[typeVal];
        const typeLabel = typeI18nKey ? t(typeI18nKey, typeVal) : typeVal;
        return {
            label: t('aiSearch.chips.type', 'Tipo: {{value}}', { value: typeLabel }),
            visible: true
        };
    }

    // City — show value directly.
    if (key === 'city') {
        return {
            label: t('aiSearch.chips.city', 'Ciudad: {{value}}', { value: String(value) }),
            visible: true
        };
    }

    // Destination UUID — resolve to real name via catalog (SPEC-265 A3),
    // or fall back to the generic label when no catalog is provided.
    if (key === 'destinationId') {
        const uuid = String(value);
        const resolvedName = destinations?.[uuid];
        if (resolvedName) {
            return {
                label: t('aiSearch.chips.destinationName', 'Destino: {{value}}', {
                    value: resolvedName
                }),
                visible: true
            };
        }
        return {
            label: t('aiSearch.chips.destinationId', 'Destino filtrado'),
            visible: true
        };
    }

    // Numeric ranges.
    if (key in NUMERIC_CHIP_KEYS) {
        const i18nKey = NUMERIC_CHIP_KEYS[key] as string;
        return {
            label: t(i18nKey, `${key}: {{value}}`, { value: String(value) }),
            visible: true
        };
    }

    // Array fields: amenitySlugs / featureSlugs.
    if (key === 'amenitySlugs' || key === 'featureSlugs') {
        const arr = value as string[];
        if (arr.length === 0) return { label: '', visible: false };

        const chipKey =
            key === 'amenitySlugs' ? 'aiSearch.chips.amenities' : 'aiSearch.chips.features';
        const defaultFallback =
            key === 'amenitySlugs' ? 'Comodidades adicionales' : 'Características adicionales';

        const displayValue = arr.length === 1 ? arr[0] : `${arr[0]}, +${arr.length - 1}`;

        return {
            label: t(chipKey, defaultFallback, { value: displayValue }),
            visible: true
        };
    }

    // Date fields.
    if (key === 'checkIn') {
        return {
            label: t('aiSearch.chips.checkIn', 'Entrada: {{value}}', { value: String(value) }),
            visible: true
        };
    }

    if (key === 'checkOut') {
        return {
            label: t('aiSearch.chips.checkOut', 'Salida: {{value}}', { value: String(value) }),
            visible: true
        };
    }

    // Fallback for unknown or future keys.
    return { label: `${key}: ${String(value)}`, visible: true };
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * ActiveFilterChips — renders one removable chip per active filter key.
 *
 * Used inside `SearchChatPanel` (T-010) to display the user's accumulated
 * search intent as dismissible pills. Removing a chip calls `onRemove(key)`,
 * which drops that filter slot from the hook state and re-fires the
 * accommodations search without starting a new LLM turn.
 *
 * Renders nothing when `filters` is null or has no displayable keys.
 *
 * @example
 * ```tsx
 * <ActiveFilterChips
 *   filters={chat.currentFilters}
 *   onRemove={chat.removeFilter}
 *   locale={locale}
 * />
 * ```
 */
export function ActiveFilterChips({
    filters,
    onRemove,
    locale,
    destinations
}: ActiveFilterChipsProps) {
    const { t } = createTranslations(locale);

    if (!filters) return null;

    const entries = Object.entries(filters) as [keyof SearchIntentEntities, unknown][];

    // Deduplicate location keys: we render a single chip for locationType,
    // latitude, longitude, and radius combined. Track whether we already
    // showed one.
    let locationChipRendered = false;

    const chips: Array<{ key: keyof SearchIntentEntities; label: string }> = [];

    for (const [key, value] of entries) {
        if (LOCATION_KEYS.has(key)) {
            if (locationChipRendered) continue;
            // Only render if at least one location key has a non-null value.
            const descriptor = resolveChipLabel(key, value, t, destinations);
            if (!descriptor.visible) continue;
            // Use 'locationType' as the canonical key to remove for the location group.
            chips.push({ key: 'locationType', label: descriptor.label });
            locationChipRendered = true;
            continue;
        }

        const descriptor = resolveChipLabel(key, value, t, destinations);
        if (!descriptor.visible) continue;
        chips.push({ key, label: descriptor.label });
    }

    if (chips.length === 0) return null;

    return (
        <ul
            className={styles.chips}
            aria-label={t('aiSearch.chips.activeFiltersLabel', 'Filtros activos')}
        >
            {chips.map(({ key, label }) => (
                <li
                    key={key}
                    className={styles.chip}
                >
                    <span className={styles.chipLabel}>{label}</span>
                    <button
                        type="button"
                        className={styles.chipRemove}
                        onClick={() => onRemove(key)}
                        aria-label={`${t('aiSearch.chips.remove', 'Quitar filtro')}: ${label}`}
                    >
                        ×
                    </button>
                </li>
            ))}
        </ul>
    );
}
