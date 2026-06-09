/**
 * @file useGeocoding.ts
 * @description Fetch-based hooks for the protected geocoding proxy (SPEC-208, Phase C PR2).
 *
 * No TanStack Query — uses native fetch + useState + useEffect, matching
 * the web app's convention for simple data fetching hooks.
 *
 * - useGeocodingSearch: debounced autocomplete search
 * - useGeocodingReverse: reverse geocode after pin drop
 */
import { useEffect, useRef, useState } from 'react';

/** Geocoding suggestion shape — matches the API response. */
export interface GeocodingSuggestion {
    readonly label: string;
    readonly lat: number;
    readonly lng: number;
    readonly street?: string;
    readonly number?: string;
    readonly city?: string;
    readonly state?: string;
    readonly country?: string;
    readonly postcode?: string;
}

const AUTOCOMPLETE_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;

/**
 * Debounced geocoding autocomplete search.
 * Returns suggestions as the user types, with a 300ms debounce.
 *
 * @param query - The search string (debounced internally)
 * @param locale - Optional locale for results
 * @returns suggestions, loading state, and error
 */
export function useGeocodingSearch({
    query,
    locale = 'es'
}: {
    readonly query: string;
    readonly locale?: 'es' | 'en' | 'pt';
}): {
    readonly suggestions: readonly GeocodingSuggestion[];
    readonly isLoading: boolean;
    readonly error: string | null;
} {
    const [suggestions, setSuggestions] = useState<readonly GeocodingSuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Clean up on unmount
        return () => {
            abortRef.current?.abort();
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < MIN_QUERY_LENGTH) {
            setSuggestions([]);
            setIsLoading(false);
            return;
        }

        // Debounce
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            setIsLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams({ q: trimmed, locale });
                const res = await fetch(
                    `/api/v1/protected/geocoding/autocomplete?${params.toString()}`,
                    {
                        credentials: 'include',
                        signal: controller.signal
                    }
                );
                if (!res.ok) {
                    throw new Error(`Geocoding request failed: ${res.status}`);
                }
                const data = (await res.json()) as {
                    data?: { suggestions?: GeocodingSuggestion[] };
                    suggestions?: GeocodingSuggestion[];
                };
                const items = data.data?.suggestions ?? data.suggestions ?? [];
                if (!controller.signal.aborted) {
                    setSuggestions(items);
                }
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                if (!controller.signal.aborted) {
                    setError(err instanceof Error ? err.message : 'Geocoding failed');
                    setSuggestions([]);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }, AUTOCOMPLETE_DEBOUNCE_MS);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query, locale]);

    return { suggestions, isLoading, error };
}

/**
 * Reverse geocode coordinates to a structured address.
 * Fires once when lat/lng change (not debounced — the caller debounces).
 *
 * @param lat - Latitude (null to skip)
 * @param lng - Longitude (null to skip)
 * @param enabled - Whether to fire the request
 * @returns suggestion, loading state, and error
 */
export function useGeocodingReverse({
    lat,
    lng,
    enabled = true
}: {
    readonly lat: number | null;
    readonly lng: number | null;
    readonly enabled?: boolean;
}): {
    readonly suggestion: GeocodingSuggestion | null;
    readonly isLoading: boolean;
    readonly error: string | null;
} {
    const [suggestion, setSuggestion] = useState<GeocodingSuggestion | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const lastKeyRef = useRef<string>('');

    useEffect(() => {
        return () => {
            abortRef.current?.abort();
        };
    }, []);

    useEffect(() => {
        if (
            !enabled ||
            lat == null ||
            lng == null ||
            !Number.isFinite(lat) ||
            !Number.isFinite(lng)
        ) {
            setSuggestion(null);
            return;
        }

        const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
        if (key === lastKeyRef.current) return;
        lastKeyRef.current = key;

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setIsLoading(true);
        setError(null);

        (async () => {
            try {
                const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
                const res = await fetch(
                    `/api/v1/protected/geocoding/reverse?${params.toString()}`,
                    {
                        credentials: 'include',
                        signal: controller.signal
                    }
                );
                if (!res.ok) {
                    throw new Error(`Reverse geocoding failed: ${res.status}`);
                }
                const data = (await res.json()) as {
                    data?: { suggestion?: GeocodingSuggestion | null };
                    suggestion?: GeocodingSuggestion | null;
                };
                const result = data.data?.suggestion ?? data.suggestion ?? null;
                if (!controller.signal.aborted) {
                    setSuggestion(result);
                }
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                if (!controller.signal.aborted) {
                    setError(err instanceof Error ? err.message : 'Reverse geocoding failed');
                    setSuggestion(null);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        })();

        return () => {
            controller.abort();
        };
    }, [lat, lng, enabled]);

    return { suggestion, isLoading, error };
}
