/**
 * @file admin/index.ts
 * @description Admin geocoding proxy endpoints (SPEC-097, Phase 6).
 *
 * The admin location picker calls these endpoints instead of talking to
 * Photon/Nominatim directly. Centralising the proxy gives us:
 * - A single place to set the required Nominatim `User-Agent` header.
 * - Server-side LRU cache and rate limiting (shared across requests).
 * - A swap point for a future Mapbox Search migration without touching
 *   the frontend.
 */
import { PermissionEnum } from '@repo/schemas';
import { geocodingAutocomplete, geocodingForward, geocodingReverse } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createRouter } from '../../../utils/create-app.js';
import { env } from '../../../utils/env.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

const SuggestionSchema = z.object({
    label: z.string(),
    lat: z.number(),
    lng: z.number(),
    street: z.string().optional(),
    number: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postcode: z.string().optional()
});

const AutocompleteResponseSchema = z.object({
    suggestions: z.array(SuggestionSchema)
});

const ForwardResponseSchema = z.object({
    suggestion: SuggestionSchema.nullable()
});

const ReverseResponseSchema = z.object({
    suggestion: SuggestionSchema.nullable()
});

const userAgent = env.HOSPEDA_GEOCODING_USER_AGENT;

const adminAutocompleteRoute = createAdminRoute({
    method: 'get',
    path: '/autocomplete',
    summary: 'Geocoding autocomplete (Photon)',
    description:
        'Type-ahead address suggestions biased to Argentina. Proxies to Photon and caches identical queries server-side.',
    tags: ['Geocoding'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT],
    requestQuery: {
        q: z.string().min(1),
        locale: z.enum(['es', 'en', 'pt']).optional()
    },
    responseSchema: AutocompleteResponseSchema,
    handler: async (
        _ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const q = String(query?.q ?? '');
        const locale = (query?.locale as 'es' | 'en' | 'pt' | undefined) ?? undefined;
        const suggestions = await geocodingAutocomplete({ query: q, locale }, { userAgent });
        return { suggestions: [...suggestions] };
    }
});

const adminForwardRoute = createAdminRoute({
    method: 'get',
    path: '/forward',
    summary: 'Geocoding forward (Nominatim)',
    description:
        'Resolves a free-text address to coordinates and structured fields. Rate-limited to 1 req/s upstream.',
    tags: ['Geocoding'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT],
    requestQuery: { q: z.string().min(1) },
    responseSchema: ForwardResponseSchema,
    handler: async (
        _ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const q = String(query?.q ?? '');
        const suggestion = await geocodingForward({ query: q }, { userAgent });
        return { suggestion };
    }
});

const adminReverseRoute = createAdminRoute({
    method: 'get',
    path: '/reverse',
    summary: 'Geocoding reverse (Nominatim)',
    description:
        'Resolves coordinates to a structured address. Used after the host drags the location pin.',
    tags: ['Geocoding'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT],
    requestQuery: {
        lat: z.coerce.number().min(-90).max(90),
        lng: z.coerce.number().min(-180).max(180)
    },
    responseSchema: ReverseResponseSchema,
    handler: async (
        _ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const lat = Number(query?.lat);
        const lng = Number(query?.lng);
        const suggestion = await geocodingReverse({ lat, lng }, { userAgent });
        return { suggestion };
    }
});

const router = createRouter();
router.route('/', adminAutocompleteRoute);
router.route('/', adminForwardRoute);
router.route('/', adminReverseRoute);

export const adminGeocodingRoutes = router;
