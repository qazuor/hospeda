import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Spinner } from '@/components/shared/feedback/Spinner';
/**
 * @file LocationPicker.client.tsx
 * @description Location picker with Leaflet map and address autocomplete (SPEC-208, Phase C PR2).
 *
 * Combines:
 * - Address autocomplete with debounced geocoding search
 * - Interactive Leaflet map with a draggable Marker (raw Leaflet, not react-leaflet)
 * - "Use my current location" button (browser Geolocation API)
 * - Reverse geocoding after the user drops the pin
 *
 * Controlled via `value`/`onChange` (RO-RO). The host can edit lat/lng manually too.
 * Uses `client:only="react"` for SSR safety (Leaflet touches window at init).
 */
import { TextField } from '@/components/ui/TextField';
import { useGeocodingReverse, useGeocodingSearch } from '@/hooks/useGeocoding';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { ACCOMMODATION_FIELD_PREFIX } from './field-ids';
import styles from './LocationPicker.module.css';

// ---------------------------------------------------------------------------
// Lazy-loaded Leaflet map (SSR-safe)
// ---------------------------------------------------------------------------
// Using React.lazy since this component is rendered with client:only="react"
// in Astro — it never runs on the server.
const LocationPickerMap = lazy(() =>
    import('./LocationPickerMap.client').then((mod) => ({ default: mod.LocationPickerMap }))
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Location value shape. */
export interface LocationPickerValue {
    readonly latitude: number | null;
    readonly longitude: number | null;
}

/**
 * Exact postal address value (G7 smoke, H-117).
 *
 * Kept separate from {@link LocationPickerValue}: coordinates are set together
 * (map/geocoding) while the address fields are set independently of each other
 * and of the coordinates.
 */
export interface LocationAddressValue {
    readonly street: string;
    readonly number: string;
    readonly floor: string;
    readonly apartment: string;
}

/** Props for LocationPicker. */
export interface LocationPickerProps {
    readonly locale: SupportedLocale;
    readonly value: LocationPickerValue;
    readonly onChange: (value: LocationPickerValue) => void;
    /** Exact address value (G7 smoke, H-117). */
    readonly addressValue: LocationAddressValue;
    /** Fired when any single address field changes. */
    readonly onAddressChange: (field: keyof LocationAddressValue, value: string) => void;
    readonly errors?: Readonly<{
        latitude?: string;
        longitude?: string;
        street?: string;
        number?: string;
        floor?: string;
        apartment?: string;
    }>;
    readonly disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEFAULT_CENTER = { lat: -32.4825, lng: -58.2372 }; // Concepción del Uruguay
const REVERSE_DEBOUNCE_MS = 800;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function LocationPicker({
    locale,
    value,
    onChange,
    addressValue,
    onAddressChange,
    errors,
    disabled = false
}: LocationPickerProps) {
    const { t } = createTranslations(locale);

    const [searchInput, setSearchInput] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [geolocationError, setGeolocationError] = useState<string | null>(null);
    const reverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const suggestionsRef = useRef<HTMLUListElement | null>(null);

    // Close suggestions on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(e.target as Node) &&
                !(e.target as HTMLElement)?.closest(`.${styles.searchWrapper}`)
            ) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Geocoding search
    const { suggestions, isLoading: isSearching } = useGeocodingSearch({
        query: searchInput,
        locale
    });

    // Reverse geocode after pin drop
    const { suggestion: reverseSuggestion } = useGeocodingReverse({
        lat: value.latitude,
        lng: value.longitude,
        enabled: value.latitude != null && value.longitude != null
    });

    // Apply reverse suggestion — update search input to show resolved address
    useEffect(() => {
        if (reverseSuggestion?.label) {
            setSearchInput(reverseSuggestion.label);
        }
    }, [reverseSuggestion]);

    const lat = value.latitude;
    const lng = value.longitude;
    const hasValidCoords =
        lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

    const handleSelectSuggestion = useCallback(
        (suggestion: {
            lat: number;
            lng: number;
            label: string;
            street?: string;
            number?: string;
        }) => {
            onChange({
                latitude: suggestion.lat,
                longitude: suggestion.lng
            });
            // H-117 (G7 smoke): the search box already resolves a parsed
            // street/number — it used to be discarded here, showing the host a
            // full address on screen that never reached the PATCH body. Only
            // fill fields the geocoder actually returned; an empty response
            // leaves whatever the host already typed untouched.
            if (suggestion.street) onAddressChange('street', suggestion.street);
            if (suggestion.number) onAddressChange('number', suggestion.number);
            setSearchInput(suggestion.label);
            setShowSuggestions(false);
        },
        [onChange, onAddressChange]
    );

    const handleMapMove = useCallback(
        (newLat: number, newLng: number) => {
            onChange({ latitude: newLat, longitude: newLng });
            // Debounce reverse geocode
            if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
            reverseTimerRef.current = setTimeout(() => {
                // Reverse geocode is triggered by the useGeocodingReverse hook
                // when lat/lng change — no action needed here
            }, REVERSE_DEBOUNCE_MS);
        },
        [onChange]
    );

    const handleUseMyLocation = useCallback(() => {
        setGeolocationError(null);
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setGeolocationError(
                t(
                    'host.properties.editor.location.geolocationUnavailable',
                    'La geolocalización no está disponible.'
                )
            );
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                onChange({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude
                });
            },
            (err) => {
                setGeolocationError(
                    err.code === err.PERMISSION_DENIED
                        ? t(
                              'host.properties.editor.location.geolocationDenied',
                              'Permiso denegado.'
                          )
                        : t(
                              'host.properties.editor.location.geolocationError',
                              'No se pudo obtener la ubicación.'
                          )
                );
            },
            { enableHighAccuracy: true, timeout: 10_000 }
        );
    }, [onChange, t]);

    const handleLatChange = useCallback(
        (raw: string) => {
            const num = raw === '' ? null : Number(raw);
            onChange({ latitude: Number.isFinite(num) ? num : null, longitude: value.longitude });
        },
        [onChange, value.longitude]
    );

    const handleLngChange = useCallback(
        (raw: string) => {
            const num = raw === '' ? null : Number(raw);
            onChange({ latitude: value.latitude, longitude: Number.isFinite(num) ? num : null });
        },
        [onChange, value.latitude]
    );

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.section.location', 'Ubicación')}
            </legend>

            {/* Address search */}
            <div className={styles.searchWrapper}>
                <label
                    htmlFor="location-picker-search"
                    className={styles.fieldLabel}
                >
                    {t('host.properties.editor.location.searchAddress', 'Buscar dirección')}
                </label>
                <div className={styles.searchInputWrapper}>
                    <input
                        id="location-picker-search"
                        type="text"
                        className={styles.searchInput}
                        value={searchInput}
                        onChange={(e) => {
                            setSearchInput(e.target.value);
                            setShowSuggestions(true);
                        }}
                        onFocus={() => {
                            if (suggestions.length > 0) setShowSuggestions(true);
                        }}
                        placeholder={t(
                            'host.properties.editor.location.searchPlaceholder',
                            'Av. Belgrano 123, Concepción del Uruguay'
                        )}
                        disabled={disabled}
                        autoComplete="off"
                    />
                    {isSearching && (
                        <span className={styles.searchSpinner}>
                            <Spinner
                                size="sm"
                                label={t('host.properties.editor.location.searching', 'Buscando…')}
                            />
                        </span>
                    )}
                </div>
                {showSuggestions && suggestions.length > 0 && (
                    <ul
                        ref={suggestionsRef}
                        className={styles.suggestionsList}
                    >
                        {suggestions.map((s) => (
                            <li key={`${s.lat}-${s.lng}-${s.label}`}>
                                <button
                                    type="button"
                                    className={styles.suggestionItem}
                                    onClick={() => handleSelectSuggestion(s)}
                                >
                                    {s.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Use my location */}
            <div className={styles.locationActions}>
                <button
                    type="button"
                    className={styles.useLocationBtn}
                    onClick={handleUseMyLocation}
                    disabled={disabled}
                >
                    📍{' '}
                    {t('host.properties.editor.location.useMyLocation', 'Usar mi ubicación actual')}
                </button>
                {geolocationError && (
                    <span
                        className={styles.fieldError}
                        role="alert"
                    >
                        {geolocationError}
                    </span>
                )}
            </div>

            {/* Leaflet map */}
            <Suspense
                fallback={
                    <div
                        className={styles.mapPlaceholder}
                        aria-hidden="true"
                    >
                        Loading map...
                    </div>
                }
            >
                <LocationPickerMap
                    center={
                        hasValidCoords ? { lat: Number(lat), lng: Number(lng) } : DEFAULT_CENTER
                    }
                    markerPosition={hasValidCoords ? { lat: Number(lat), lng: Number(lng) } : null}
                    disabled={disabled}
                    onMove={handleMapMove}
                />
            </Suspense>

            <p className={styles.hint}>
                {t(
                    'host.properties.editor.location.mapHint',
                    'Arrastrá el pin para ajustar la ubicación exacta.'
                )}
            </p>

            {/*
             * Coordinate inputs.
             *
             * These take the wrapper; the Leaflet map above does not (HOS-385
             * OQ-2). The map is not a labelled control and has no Zod key —
             * `latitude`/`longitude` are edited by these two plain number
             * inputs, which is exactly what `<TextField>` is for.
             */}
            <div className={styles.coordRow}>
                <div className={styles.field}>
                    <TextField
                        prefix={ACCOMMODATION_FIELD_PREFIX}
                        name="latitude"
                        label={t('host.properties.editor.field.latitude', 'Latitud')}
                        labelClassName={styles.fieldLabel}
                        className={styles.fieldInput}
                        error={errors?.latitude}
                        type="number"
                        value={value.latitude ?? ''}
                        min={-90}
                        max={90}
                        step="0.000001"
                        onChange={(e) => handleLatChange(e.target.value)}
                        disabled={disabled}
                    />
                </div>

                <div className={styles.field}>
                    <TextField
                        prefix={ACCOMMODATION_FIELD_PREFIX}
                        name="longitude"
                        label={t('host.properties.editor.field.longitude', 'Longitud')}
                        labelClassName={styles.fieldLabel}
                        className={styles.fieldInput}
                        error={errors?.longitude}
                        type="number"
                        value={value.longitude ?? ''}
                        min={-180}
                        max={180}
                        step="0.000001"
                        onChange={(e) => handleLngChange(e.target.value)}
                        disabled={disabled}
                    />
                </div>
            </div>

            {/*
             * Exact postal address (G7 smoke, H-117). Owner decision 2026-08-14:
             * the host CAN store the exact address here — only its public
             * exposure stays gated (visitors only ever see the approximate pin;
             * SPEC-097 strips `location` from every non-owner reader response).
             */}
            <p className={styles.hint}>
                {t(
                    'host.properties.editor.location.addressHint',
                    'Dirección exacta. Los turistas solo ven una ubicación aproximada en el mapa público.'
                )}
            </p>
            <div className={styles.coordRow}>
                <div className={styles.field}>
                    <TextField
                        prefix={ACCOMMODATION_FIELD_PREFIX}
                        name="street"
                        label={t('host.properties.editor.field.street', 'Calle')}
                        labelClassName={styles.fieldLabel}
                        className={styles.fieldInput}
                        error={errors?.street}
                        type="text"
                        value={addressValue.street}
                        onChange={(e) => onAddressChange('street', e.target.value)}
                        disabled={disabled}
                    />
                </div>

                <div className={styles.field}>
                    <TextField
                        prefix={ACCOMMODATION_FIELD_PREFIX}
                        name="number"
                        label={t('host.properties.editor.field.number', 'Número')}
                        labelClassName={styles.fieldLabel}
                        className={styles.fieldInput}
                        error={errors?.number}
                        type="text"
                        value={addressValue.number}
                        onChange={(e) => onAddressChange('number', e.target.value)}
                        disabled={disabled}
                    />
                </div>
            </div>

            <div className={styles.coordRow}>
                <div className={styles.field}>
                    <TextField
                        prefix={ACCOMMODATION_FIELD_PREFIX}
                        name="floor"
                        label={t('host.properties.editor.field.floor', 'Piso')}
                        labelClassName={styles.fieldLabel}
                        className={styles.fieldInput}
                        error={errors?.floor}
                        type="text"
                        value={addressValue.floor}
                        onChange={(e) => onAddressChange('floor', e.target.value)}
                        disabled={disabled}
                    />
                </div>

                <div className={styles.field}>
                    <TextField
                        prefix={ACCOMMODATION_FIELD_PREFIX}
                        name="apartment"
                        label={t('host.properties.editor.field.apartment', 'Departamento')}
                        labelClassName={styles.fieldLabel}
                        className={styles.fieldInput}
                        error={errors?.apartment}
                        type="text"
                        value={addressValue.apartment}
                        onChange={(e) => onAddressChange('apartment', e.target.value)}
                        disabled={disabled}
                    />
                </div>
            </div>
        </fieldset>
    );
}
