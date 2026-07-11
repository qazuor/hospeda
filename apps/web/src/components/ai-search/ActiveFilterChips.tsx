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
 * - `city` / `destinationId`: ONE merged chip — see {@link resolveCityDestinationChip}.
 * - `locationType`, `latitude`, `longitude`, `radius` → a separate generic
 *   "Ubicación" chip group (deduplicated the same way, but kept apart from
 *   city/destinationId since it has no specific value to show).
 * - Dates (`checkIn`, `checkOut`): formatted date string.
 * - `currency`: helper chip if set (rarely shown alone, no remove button).
 *
 * Applied-params filtering (HOS-111 T-006 / AC-6): `filters` is the raw LLM
 * intent, which may include slots the search mapper never forwards (e.g. a
 * model-extracted `maxGuests` — the mapper folds "for N guests" into a
 * min-only `capacity >= N` filter and drops `maxGuests` entirely). Rendering
 * a chip straight from `filters` would show a filter that was never actually
 * applied. When the optional `appliedParams` prop is provided, a chip only
 * renders when its underlying search param key is present in that object —
 * see {@link isKeyApplied}. Omit the prop to keep the legacy "show every
 * intent-derived chip" behavior (used by tests that don't care about this
 * distinction).
 *
 * @module ActiveFilterChips
 */

import type { SearchIntentEntities } from '@repo/schemas';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './ActiveFilterChips.module.css';
import { INTENT_TO_PARAM_KEY } from './useSearchChat';

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
 * @property appliedParams - The last server-resolved accommodation search
 *   params (HOS-111 T-006 / AC-6), i.e. what was ACTUALLY sent to the search,
 *   as opposed to the raw LLM `filters` intent. Deliberately typed as a loose
 *   `Record<string, unknown>` rather than `AccommodationSearchHttp` — this
 *   component only ever probes a handful of known keys (see
 *   {@link isKeyApplied}), so it does not need the full precise search-params
 *   shape. When provided, a chip only renders when its corresponding param
 *   key is present here. Omit to render every intent-derived chip (legacy
 *   behavior).
 */
export interface ActiveFilterChipsProps {
    readonly filters: SearchIntentEntities | null;
    readonly onRemove: (key: keyof SearchIntentEntities) => void;
    readonly locale: SupportedLocale;
    readonly destinations?: Readonly<Record<string, string>>;
    readonly appliedParams?: Readonly<Record<string, unknown>> | null;
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
 * `city` and `destinationId` are mutually exclusive location SIGNALS from the
 * model's perspective (HOS-111 follow-up fix) — the search mapper
 * (`mapIntentToSearchParams`, apps/api) picks AT MOST ONE location strategy
 * per turn, with priority `resolved-destination-from-city > entities.destinationId
 * > geo > city-as-keyword`. The model can still emit BOTH slots at once (e.g.
 * a real `city` that resolves server-side, plus a hallucinated unrelated
 * `destinationId`) — rendering both as independent chips showed the unused
 * hallucinated UUID as a second, phantom location chip. They are handled as
 * ONE group by {@link resolveCityDestinationChip} instead of the generic
 * per-key path.
 */
const CITY_DESTINATION_KEYS = new Set<keyof SearchIntentEntities>(['city', 'destinationId']);

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

/**
 * Whether an intent key's underlying filter was ACTUALLY forwarded to the
 * accommodations search (HOS-111 T-006 / AC-6).
 *
 * When `appliedParams` is `null`/`undefined` (caller didn't provide a
 * snapshot), every key is considered applied — this preserves the legacy
 * "render from raw intent" behavior for callers/tests that don't pass it.
 *
 * NOTE: `city` and `destinationId` are NOT checked here — they're handled as
 * one merged group by {@link resolveCityDestinationChip}, intercepted before
 * this function is ever called for those two keys (see the render loop).
 *
 * @param key - The `SearchIntentEntities` key being considered for a chip.
 * @param appliedParams - The last resolved accommodation search params, or
 *   `null`/`undefined` when unavailable.
 * @returns `true` when the chip should be rendered.
 */
function isKeyApplied(
    key: keyof SearchIntentEntities,
    appliedParams: Readonly<Record<string, unknown>> | null | undefined
): boolean {
    if (!appliedParams) return true;

    const params = appliedParams;

    // Location group: a single chip covers locationType/latitude/longitude/radius.
    // `locationType` is a mapper-internal hint and is NEVER forwarded as a query
    // param (see SearchIntentEntitiesSchema JSDoc) — check the coordinate/radius
    // params it actually controls instead.
    if (LOCATION_KEYS.has(key)) {
        return (
            params.latitude !== undefined ||
            params.longitude !== undefined ||
            params.radius !== undefined
        );
    }

    const paramKey = INTENT_TO_PARAM_KEY[key] ?? key;
    return params[paramKey as string] !== undefined;
}

/**
 * Resolves the single "location" chip shared by `city` and `destinationId`
 * (HOS-111 follow-up fix — see {@link CITY_DESTINATION_KEYS}).
 *
 * When `appliedParams` is available, the winning signal is read FROM THE
 * APPLIED PARAMS, never from the raw intent — this is the actual correctness
 * fix: the model can emit a `destinationId` that was never used (because
 * `city` independently resolved to a different destination server-side, or
 * vice versa), so trusting `filters.destinationId` directly can render a
 * chip for a UUID that had zero effect on the search. Priority mirrors the
 * mapper (`mapIntentToSearchParams`, apps/api): `destinationId` > `q` (city
 * keyword fallback).
 *
 * Without `appliedParams` (legacy callers/tests), falls back to the raw
 * intent with the same `destinationId` > `city` priority.
 *
 * @returns The chip's removal key + label, or `null` when neither slot is
 *   present, or (with `appliedParams`) neither actually applied.
 */
function resolveCityDestinationChip(
    filters: SearchIntentEntities,
    appliedParams: Readonly<Record<string, unknown>> | null | undefined,
    t: ReturnType<typeof createTranslations>['t'],
    destinations?: Readonly<Record<string, string>>
): { readonly key: keyof SearchIntentEntities; readonly label: string } | null {
    if (filters.destinationId === undefined && filters.city === undefined) return null;

    if (appliedParams) {
        if (typeof appliedParams.destinationId === 'string') {
            const descriptor = resolveChipLabel(
                'destinationId',
                appliedParams.destinationId,
                t,
                destinations
            );
            return descriptor.visible ? { key: 'destinationId', label: descriptor.label } : null;
        }
        if (typeof appliedParams.q === 'string') {
            const descriptor = resolveChipLabel('city', appliedParams.q, t, destinations);
            return descriptor.visible ? { key: 'city', label: descriptor.label } : null;
        }
        // Extracted but never applied (e.g. dropped in favor of geo, or the
        // turn used a different location strategy entirely).
        return null;
    }

    // Legacy mode (no applied-params snapshot) — best-effort from raw intent.
    if (filters.destinationId !== undefined) {
        const descriptor = resolveChipLabel(
            'destinationId',
            filters.destinationId,
            t,
            destinations
        );
        return descriptor.visible ? { key: 'destinationId', label: descriptor.label } : null;
    }
    const descriptor = resolveChipLabel('city', filters.city, t, destinations);
    return descriptor.visible ? { key: 'city', label: descriptor.label } : null;
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
    destinations,
    appliedParams
}: ActiveFilterChipsProps) {
    const { t } = createTranslations(locale);

    if (!filters) return null;

    const entries = Object.entries(filters) as [keyof SearchIntentEntities, unknown][];

    // Deduplicate location keys: we render a single chip for locationType,
    // latitude, longitude, and radius combined. Track whether we already
    // showed one.
    let locationChipRendered = false;
    // Deduplicate city/destinationId into a single chip (HOS-111 follow-up
    // fix) — see resolveCityDestinationChip.
    let cityDestinationChipRendered = false;

    const chips: Array<{ key: keyof SearchIntentEntities; label: string }> = [];

    for (const [key, value] of entries) {
        if (CITY_DESTINATION_KEYS.has(key)) {
            if (cityDestinationChipRendered) continue;
            cityDestinationChipRendered = true;
            const resolved = resolveCityDestinationChip(filters, appliedParams, t, destinations);
            if (resolved) chips.push(resolved);
            continue;
        }

        if (!isKeyApplied(key, appliedParams)) continue;

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
