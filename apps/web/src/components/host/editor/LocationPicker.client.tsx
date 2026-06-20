import { Spinner } from '@/components/shared/feedback/Spinner';
import { useGeocodingReverse, useGeocodingSearch } from '@/hooks/useGeocoding';
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
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
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

/** Props for LocationPicker. */
export interface LocationPickerProps {
    readonly locale: SupportedLocale;
    readonly value: LocationPickerValue;
    readonly onChange: (value: LocationPickerValue) => void;
    readonly errors?: Readonly<{
        latitude?: string;
        longitude?: string;
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
        (suggestion: { lat: number; lng: number; label: string }) => {
            onChange({
                latitude: suggestion.lat,
                longitude: suggestion.lng
            });
            setSearchInput(suggestion.label);
            setShowSuggestions(false);
        },
        [onChange]
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
                        {suggestions.map((s, i) => (
                            <li key={`${s.lat}-${s.lng}-${i}`}>
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

            {/* Coordinate inputs */}
            <div className={styles.coordRow}>
                <div className={styles.field}>
                    <label
                        htmlFor="acc-latitude"
                        className={styles.fieldLabel}
                    >
                        {t('host.properties.editor.field.latitude', 'Latitud')}
                    </label>
                    <input
                        id="acc-latitude"
                        type="number"
                        className={styles.fieldInput}
                        value={value.latitude ?? ''}
                        min={-90}
                        max={90}
                        step="0.000001"
                        onChange={(e) => handleLatChange(e.target.value)}
                        disabled={disabled}
                        aria-invalid={Boolean(errors?.latitude)}
                        aria-describedby={errors?.latitude ? 'acc-latitude-error' : undefined}
                    />
                    {errors?.latitude && (
                        <span
                            id="acc-latitude-error"
                            className={styles.fieldError}
                            role="alert"
                        >
                            {errors.latitude}
                        </span>
                    )}
                </div>

                <div className={styles.field}>
                    <label
                        htmlFor="acc-longitude"
                        className={styles.fieldLabel}
                    >
                        {t('host.properties.editor.field.longitude', 'Longitud')}
                    </label>
                    <input
                        id="acc-longitude"
                        type="number"
                        className={styles.fieldInput}
                        value={value.longitude ?? ''}
                        min={-180}
                        max={180}
                        step="0.000001"
                        onChange={(e) => handleLngChange(e.target.value)}
                        disabled={disabled}
                        aria-invalid={Boolean(errors?.longitude)}
                        aria-describedby={errors?.longitude ? 'acc-longitude-error' : undefined}
                    />
                    {errors?.longitude && (
                        <span
                            id="acc-longitude-error"
                            className={styles.fieldError}
                            role="alert"
                        >
                            {errors.longitude}
                        </span>
                    )}
                </div>
            </div>
        </fieldset>
    );
}
