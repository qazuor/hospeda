/**
 * @file LocationPickerField.tsx
 * @description Admin location picker for accommodation hosts (SPEC-097, US-08/US-09).
 *
 * Combines:
 * - Address autocomplete (Photon via the admin proxy) with debounce.
 * - Interactive Leaflet map with a draggable Marker.
 * - "Use my current location" button (browser Geolocation API).
 * - Reverse geocoding after the user drops the pin to refresh the address.
 *
 * Controlled via `value`/`onChange` (RO-RO). The host can edit any structured
 * field manually too — typing those fields does NOT trigger geocoding.
 */
import { clientOnly } from '@tanstack/react-start';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
    type GeocodingSuggestion,
    useGeocodingAutocomplete,
    useGeocodingReverse
} from '../../../hooks/useGeocoding';

/**
 * Leaflet map lives in `LocationPickerMapInner.tsx` and is loaded via
 * `clientOnly(() => import(...))` inside `React.lazy`. The TanStack-Start
 * babel compiler strips the inner dynamic import from the server build
 * (replaced with a throwing arrow function), so the `leaflet` runtime
 * (which references `window` at module init) never reaches the SSR bundle.
 * The `isMounted` guard below keeps the component from rendering on the
 * server, which is what the throwing function would otherwise reject.
 */
const LazyLocationPickerMap = React.lazy(
    clientOnly(() =>
        import('./LocationPickerMapInner').then((mod) => ({ default: mod.LocationPickerMapInner }))
    )
);

export interface LocationPickerValue {
    coordinates?: { lat: string; long: string };
    street?: string;
    number?: string;
    floor?: string;
    apartment?: string;
}

export interface LocationPickerFieldProps {
    readonly value: LocationPickerValue;
    readonly onChange: (next: LocationPickerValue) => void;
    readonly defaultCenter?: [number, number];
    readonly defaultZoom?: number;
    readonly errors?: Partial<Record<keyof LocationPickerValue | 'coordinates', string>>;
    readonly disabled?: boolean;
}

const DEFAULT_CENTER: [number, number] = [-31.8, -58.5];
const DEFAULT_ZOOM = 13;
const REVERSE_DEBOUNCE_MS = 800;
const AUTOCOMPLETE_DEBOUNCE_MS = 300;

export function LocationPickerField({
    value,
    onChange,
    defaultCenter = DEFAULT_CENTER,
    defaultZoom = DEFAULT_ZOOM,
    errors,
    disabled
}: LocationPickerFieldProps) {
    const [autocompleteInput, setAutocompleteInput] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [pendingReverse, setPendingReverse] = useState<{ lat: number; lng: number } | null>(null);
    const [geolocationError, setGeolocationError] = useState<string | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            setDebouncedQuery(autocompleteInput);
        }, AUTOCOMPLETE_DEBOUNCE_MS);
        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, [autocompleteInput]);

    const { data: suggestions = [], isFetching: isAutocompleteFetching } = useGeocodingAutocomplete(
        { query: debouncedQuery }
    );

    const { data: reverseSuggestion } = useGeocodingReverse({
        lat: pendingReverse?.lat ?? null,
        lng: pendingReverse?.lng ?? null,
        enabled: pendingReverse != null
    });

    useEffect(() => {
        if (!reverseSuggestion) return;
        applySuggestion(reverseSuggestion, { keepCoordinates: true });
        setPendingReverse(null);
    }, [reverseSuggestion]);

    const lat = value.coordinates?.lat ? Number.parseFloat(value.coordinates.lat) : Number.NaN;
    const lng = value.coordinates?.long ? Number.parseFloat(value.coordinates.long) : Number.NaN;
    const hasValidCoords = Number.isFinite(lat) && Number.isFinite(lng);
    const markerPosition: [number, number] | null = hasValidCoords ? [lat, lng] : null;

    const center: [number, number] = hasValidCoords ? [lat, lng] : defaultCenter;

    const applySuggestion = useCallback(
        (suggestion: GeocodingSuggestion, options: { keepCoordinates?: boolean } = {}) => {
            const next: LocationPickerValue = {
                ...value,
                street: suggestion.street ?? value.street,
                number: suggestion.number ?? value.number
            };
            if (!options.keepCoordinates) {
                next.coordinates = {
                    lat: suggestion.lat.toFixed(6),
                    long: suggestion.lng.toFixed(6)
                };
            }
            onChange(next);
        },
        [value, onChange]
    );

    const handleSelectSuggestion = useCallback(
        (suggestion: GeocodingSuggestion) => {
            applySuggestion(suggestion);
            setAutocompleteInput(suggestion.label);
        },
        [applySuggestion]
    );

    const debouncedReverse = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handlePinMove = useCallback(
        (newLat: number, newLng: number) => {
            onChange({
                ...value,
                coordinates: {
                    lat: newLat.toFixed(6),
                    long: newLng.toFixed(6)
                }
            });
            if (debouncedReverse.current) clearTimeout(debouncedReverse.current);
            debouncedReverse.current = setTimeout(() => {
                setPendingReverse({ lat: newLat, lng: newLng });
            }, REVERSE_DEBOUNCE_MS);
        },
        [value, onChange]
    );

    const handleUseMyLocation = useCallback(() => {
        setGeolocationError(null);
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setGeolocationError('La geolocalización no está disponible en este navegador.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                handlePinMove(pos.coords.latitude, pos.coords.longitude);
            },
            (err) => {
                setGeolocationError(
                    err.code === err.PERMISSION_DENIED
                        ? 'Permiso denegado. Podés escribir la dirección manualmente.'
                        : 'No se pudo obtener la ubicación. Probá escribir la dirección.'
                );
            },
            { enableHighAccuracy: true, timeout: 10_000 }
        );
    }, [handlePinMove]);

    const updateField = useCallback(
        (field: keyof LocationPickerValue, raw: string) => {
            onChange({ ...value, [field]: raw });
        },
        [value, onChange]
    );

    const showSuggestionsList = suggestions.length > 0 && debouncedQuery.length >= 3;

    // SSR guard — Leaflet touches `window` during map init. Wait for client
    // mount before rendering the inner map; the rest of the form is safe to
    // SSR. Mirrors the pattern in apps/web LocationMap.client.tsx and the
    // other admin map components.
    const [isMounted, setIsMounted] = useState(false);
    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const mapNode = isMounted ? (
        <React.Suspense
            fallback={
                <div
                    aria-hidden="true"
                    className="w-full rounded-md border bg-muted"
                    style={{ height: 360 }}
                />
            }
        >
            <LazyLocationPickerMap
                center={center}
                defaultZoom={defaultZoom}
                markerPosition={markerPosition}
                disabled={disabled}
                onMove={handlePinMove}
            />
        </React.Suspense>
    ) : (
        <div
            aria-hidden="true"
            className="w-full rounded-md border bg-muted"
            style={{ height: 360 }}
        />
    );

    return (
        <div className="space-y-3">
            <div className="relative">
                <label
                    htmlFor="location-picker-search"
                    className="block font-medium text-foreground text-sm"
                >
                    Buscar dirección
                </label>
                <input
                    id="location-picker-search"
                    type="text"
                    value={autocompleteInput}
                    onChange={(e) => setAutocompleteInput(e.target.value)}
                    placeholder="Av. Belgrano 123, Concepción del Uruguay"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={disabled}
                    autoComplete="off"
                />
                {isAutocompleteFetching && (
                    <span className="absolute top-9 right-3 text-muted-foreground text-xs">
                        Buscando…
                    </span>
                )}
                {showSuggestionsList && (
                    <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
                        {suggestions.map((s) => (
                            <li key={`${s.lat},${s.lng},${s.label}`}>
                                <button
                                    type="button"
                                    className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-accent"
                                    onClick={() => handleSelectSuggestion(s)}
                                >
                                    {s.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleUseMyLocation}
                    disabled={disabled}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                >
                    📍 Usar mi ubicación actual
                </button>
                {geolocationError && (
                    <span className="text-destructive text-xs">{geolocationError}</span>
                )}
            </div>

            {mapNode}
            <p className="text-muted-foreground text-xs">
                Arrastrá el pin para ajustar la ubicación exacta. La dirección se completará
                automáticamente.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                    <label
                        htmlFor="lp-street"
                        className="block text-muted-foreground text-xs"
                    >
                        Calle
                    </label>
                    <input
                        id="lp-street"
                        type="text"
                        value={value.street ?? ''}
                        onChange={(e) => updateField('street', e.target.value)}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        disabled={disabled}
                    />
                    {errors?.street && (
                        <p className="mt-1 text-destructive text-xs">{errors.street}</p>
                    )}
                </div>
                <div>
                    <label
                        htmlFor="lp-number"
                        className="block text-muted-foreground text-xs"
                    >
                        Número
                    </label>
                    <input
                        id="lp-number"
                        type="text"
                        value={value.number ?? ''}
                        onChange={(e) => updateField('number', e.target.value)}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        disabled={disabled}
                    />
                    {errors?.number && (
                        <p className="mt-1 text-destructive text-xs">{errors.number}</p>
                    )}
                </div>
                <div>
                    <label
                        htmlFor="lp-floor"
                        className="block text-muted-foreground text-xs"
                    >
                        Piso
                    </label>
                    <input
                        id="lp-floor"
                        type="text"
                        value={value.floor ?? ''}
                        onChange={(e) => updateField('floor', e.target.value)}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        disabled={disabled}
                    />
                </div>
                <div>
                    <label
                        htmlFor="lp-apartment"
                        className="block text-muted-foreground text-xs"
                    >
                        Departamento
                    </label>
                    <input
                        id="lp-apartment"
                        type="text"
                        value={value.apartment ?? ''}
                        onChange={(e) => updateField('apartment', e.target.value)}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        disabled={disabled}
                    />
                </div>
                <div>
                    <label
                        htmlFor="lp-lat"
                        className="block text-muted-foreground text-xs"
                    >
                        Latitud
                    </label>
                    <input
                        id="lp-lat"
                        type="text"
                        value={value.coordinates?.lat ?? ''}
                        onChange={(e) =>
                            onChange({
                                ...value,
                                coordinates: {
                                    lat: e.target.value,
                                    long: value.coordinates?.long ?? ''
                                }
                            })
                        }
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                        disabled={disabled}
                    />
                </div>
                <div>
                    <label
                        htmlFor="lp-lng"
                        className="block text-muted-foreground text-xs"
                    >
                        Longitud
                    </label>
                    <input
                        id="lp-lng"
                        type="text"
                        value={value.coordinates?.long ?? ''}
                        onChange={(e) =>
                            onChange({
                                ...value,
                                coordinates: {
                                    lat: value.coordinates?.lat ?? '',
                                    long: e.target.value
                                }
                            })
                        }
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                        disabled={disabled}
                    />
                </div>
            </div>
            {errors?.coordinates && (
                <p className="text-destructive text-xs">{errors.coordinates}</p>
            )}
        </div>
    );
}
