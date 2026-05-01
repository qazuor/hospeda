/**
 * @file useGeocoding.ts
 * @description TanStack Query wrappers for the admin geocoding proxy
 * (SPEC-097, Phase 6). All requests target `/api/v1/admin/geocoding/*`,
 * never the upstream providers directly — the server enforces auth, rate
 * limiting, caching and User-Agent.
 */
import { fetchApi } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';

export interface GeocodingSuggestion {
    label: string;
    lat: number;
    lng: number;
    street?: string;
    number?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
}

const AUTOCOMPLETE_DEBOUNCE_MS = 300;

/**
 * Type-ahead suggestions. Disabled until the query is at least 3 chars long
 * and the browser has been idle for the debounce window.
 */
export function useGeocodingAutocomplete({
    query,
    locale = 'es'
}: {
    query: string;
    locale?: 'es' | 'en' | 'pt';
}) {
    const trimmed = query.trim();
    return useQuery({
        queryKey: ['geocoding', 'autocomplete', locale, trimmed],
        queryFn: async () => {
            const params = new URLSearchParams({ q: trimmed, locale });
            const res = await fetchApi<{ suggestions?: GeocodingSuggestion[] }>({
                path: `/api/v1/admin/geocoding/autocomplete?${params.toString()}`
            });
            return (res.data?.suggestions ?? []) as GeocodingSuggestion[];
        },
        enabled: trimmed.length >= 3,
        staleTime: AUTOCOMPLETE_DEBOUNCE_MS * 10
    });
}

/**
 * Reverse geocoding for a (lat, lng) pair. Used after the user drags the
 * pin to a new location to refresh the structured address fields.
 */
export function useGeocodingReverse({
    lat,
    lng,
    enabled = true
}: {
    lat: number | null;
    lng: number | null;
    enabled?: boolean;
}) {
    return useQuery({
        queryKey: ['geocoding', 'reverse', lat, lng],
        queryFn: async () => {
            if (lat == null || lng == null) return null;
            const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
            const res = await fetchApi<{ suggestion?: GeocodingSuggestion | null }>({
                path: `/api/v1/admin/geocoding/reverse?${params.toString()}`
            });
            return res.data?.suggestion ?? null;
        },
        enabled: enabled && lat != null && lng != null
    });
}
