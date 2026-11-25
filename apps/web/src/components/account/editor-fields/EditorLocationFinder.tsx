/**
 * EditorLocationFinder — the address search and «use my location» helpers of
 * the shared location section (HOS-2496, spec HOS-2415 §6.8).
 *
 * Folded in from the accommodation editor's retired `LocationPicker`, so the
 * behaviour those tests pinned stays exactly as it was:
 *
 * - The search box only recentres the map; its text is never saved (HOS-795).
 *   Picking a suggestion places the pin and fills street and number when the
 *   geocoder returned them, never blanking what the owner typed (H-117).
 * - «Use my location» places the pin from the browser Geolocation API.
 * - While no pin is placed, a notice explains the map opens on the city centre
 *   only as a starting point (HOS-1767).
 * - Where the pin sits, reverse-geocoded, is read-only reference text and is
 *   never written back into a control (HOS-795).
 *
 * @module components/account/editor-fields/EditorLocationFinder
 */

import { LocationIcon } from '@repo/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/account/ui/Alert';
import { Button } from '@/components/account/ui/Button';
import { Field } from '@/components/account/ui/Field';
import { TextInput } from '@/components/account/ui/TextInput';
import { Spinner } from '@/components/shared/feedback/Spinner';
import {
    type GeocodingSuggestion,
    useGeocodingReverse,
    useGeocodingSearch
} from '@/hooks/useGeocoding';
import { createT, type SupportedLocale } from '@/lib/i18n';
import styles from './EditorLocationFinder.module.css';

/** A point the finder resolved, with the address parts the geocoder returned. */
export interface FoundLocation {
    readonly lat: number;
    readonly lng: number;
    readonly street?: string;
    readonly number?: string;
}

/** Props of {@link EditorLocationFinder}. */
export interface EditorLocationFinderProps {
    readonly locale: SupportedLocale;
    /** Field id prefix of the editor (`acc`, `ce`). */
    readonly idPrefix: string;
    /** The current pin, or `null` while none is placed. */
    readonly pin: { readonly lat: number; readonly lng: number } | null;
    /** Receives the point a suggestion or the browser resolved. */
    readonly onFound: (found: FoundLocation) => void;
    readonly disabled?: boolean;
}

/**
 * Address search, «use my location», the unplaced-pin notice and the pin's
 * reverse-geocoded reference.
 *
 * @param props - See {@link EditorLocationFinderProps}.
 * @returns The finder block, rendered above the map.
 */
export function EditorLocationFinder({
    locale,
    idPrefix,
    pin,
    onFound,
    disabled = false
}: EditorLocationFinderProps) {
    const t = createT(locale);
    const [query, setQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [geolocationError, setGeolocationError] = useState<string | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);

    const { suggestions, isLoading } = useGeocodingSearch({ query, locale });
    const { suggestion: reverse } = useGeocodingReverse({
        lat: pin?.lat ?? null,
        lng: pin?.lng ?? null,
        enabled: pin !== null
    });

    useEffect(() => {
        const handleOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    const handleSelect = useCallback(
        (suggestion: GeocodingSuggestion) => {
            onFound({
                lat: suggestion.lat,
                lng: suggestion.lng,
                street: suggestion.street,
                number: suggestion.number
            });
            setQuery(suggestion.label);
            setShowSuggestions(false);
        },
        [onFound]
    );

    const handleUseMyLocation = useCallback(() => {
        setGeolocationError(null);
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setGeolocationError(t('host.properties.editor.location.geolocationUnavailable'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) =>
                onFound({ lat: position.coords.latitude, lng: position.coords.longitude }),
            (error) =>
                setGeolocationError(
                    error.code === error.PERMISSION_DENIED
                        ? t('host.properties.editor.location.geolocationDenied')
                        : t('host.properties.editor.location.geolocationError')
                ),
            { enableHighAccuracy: true, timeout: 10_000 }
        );
    }, [onFound, t]);

    return (
        <div className={styles.root}>
            <div
                ref={wrapperRef}
                className={styles.search}
            >
                <Field
                    locale={locale}
                    label={t('host.properties.editor.location.searchOnMap')}
                    hint={t('host.properties.editor.location.searchHint')}
                    id={`${idPrefix}-location-search`}
                >
                    <TextInput
                        type="text"
                        autoComplete="off"
                        disabled={disabled}
                        placeholder={t('host.properties.editor.location.searchPlaceholder')}
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setShowSuggestions(true);
                        }}
                        onFocus={() => {
                            if (suggestions.length > 0) setShowSuggestions(true);
                        }}
                    />
                </Field>
                {isLoading ? (
                    <span className={styles.spinner}>
                        <Spinner
                            size="sm"
                            label={t('host.properties.editor.location.searching')}
                        />
                    </span>
                ) : null}
                {showSuggestions && suggestions.length > 0 ? (
                    <ul className={styles.suggestions}>
                        {suggestions.map((suggestion) => (
                            <li key={`${suggestion.lat}-${suggestion.lng}-${suggestion.label}`}>
                                <button
                                    type="button"
                                    className={styles.suggestion}
                                    onClick={() => handleSelect(suggestion)}
                                >
                                    {suggestion.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>

            <div className={styles.actions}>
                <Button
                    type="button"
                    variant="secondary"
                    disabled={disabled}
                    onClick={handleUseMyLocation}
                >
                    <LocationIcon
                        size={18}
                        aria-hidden="true"
                    />
                    {t('host.properties.editor.location.useMyLocation')}
                </Button>
                {geolocationError ? (
                    <span
                        className={styles.error}
                        role="alert"
                    >
                        {geolocationError}
                    </span>
                ) : null}
            </div>

            {pin && reverse?.label ? (
                <Alert
                    locale={locale}
                    tone="info"
                    title={t('host.properties.editor.location.pinAt')}
                >
                    {reverse.label}
                </Alert>
            ) : null}
        </div>
    );
}
