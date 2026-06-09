/**
 * @file protected/index.ts
 * @description Protected geocoding proxy endpoints (SPEC-208, Phase C PR2).
 *
 * The web accommodation editor calls these endpoints instead of talking to
 * Photon/Nominatim directly. Same proxy pattern as the admin geocoding routes
 * but gated by session auth (no admin permissions required).
 *
 * - Autocomplete: type-ahead address suggestions via Photon
 * - Reverse: coordinates → structured address via Nominatim
 */
import { geocodingAutocomplete, geocodingReverse } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createRouter } from '../../../utils/create-app.js';
import { env } from '../../../utils/env.js';
import { createSimpleRoute } from '../../../utils/route-factory.js';

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

const ReverseResponseSchema = z.object({
    suggestion: SuggestionSchema.nullable()
});

const userAgent = env.HOSPEDA_GEOCODING_USER_AGENT;

const protectedAutocompleteRoute = createSimpleRoute({
    method: 'get',
    path: '/autocomplete',
    summary: 'Geocoding autocomplete (Photon)',
    description:
        'Type-ahead address suggestions biased to Argentina. Proxies to Photon and caches identical queries server-side.',
    tags: ['Protected - Geocoding'],
    responseSchema: AutocompleteResponseSchema,
    handler: async (ctx: Context) => {
        const url = new URL(ctx.req.url);
        const q = url.searchParams.get('q') ?? '';
        if (q.trim().length < 1) {
            return ctx.json(
                {
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'q parameter is required' }
                },
                400
            );
        }
        const locale =
            (url.searchParams.get('locale') as 'es' | 'en' | 'pt' | undefined) ?? undefined;
        const suggestions = await geocodingAutocomplete({ query: q, locale }, { userAgent });
        return { suggestions: [...suggestions] };
    },
    options: { skipAuth: true }
});

const protectedReverseRoute = createSimpleRoute({
    method: 'get',
    path: '/reverse',
    summary: 'Geocoding reverse (Nominatim)',
    description:
        'Resolves coordinates to a structured address. Used after the host drags the location pin.',
    tags: ['Protected - Geocoding'],
    responseSchema: ReverseResponseSchema,
    handler: async (ctx: Context) => {
        const url = new URL(ctx.req.url);
        const latStr = url.searchParams.get('lat');
        const lngStr = url.searchParams.get('lng');
        const lat = Number(latStr);
        const lng = Number(lngStr);
        if (
            !Number.isFinite(lat) ||
            lat < -90 ||
            lat > 90 ||
            !Number.isFinite(lng) ||
            lng < -180 ||
            lng > 180
        ) {
            return ctx.json(
                {
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Invalid coordinates' }
                },
                400
            );
        }
        const suggestion = await geocodingReverse({ lat, lng }, { userAgent });
        return { suggestion };
    },
    options: { skipAuth: true }
});

const router = createRouter();
router.route('/', protectedAutocompleteRoute);
router.route('/', protectedReverseRoute);

export const protectedGeocodingRoutes = router;
