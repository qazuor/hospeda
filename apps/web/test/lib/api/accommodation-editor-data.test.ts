/**
 * @file accommodation-editor-data.test.ts
 * @description Guards the shared editor SSR loader (HOS-318 T-003).
 *
 * The load-bearing assertion here is a NEGATIVE one: a page that only needs the
 * accommodation must issue no catalog request at all. That is the whole point of
 * the split — before it, every editor screen paid for the amenity catalog, the
 * feature catalog and the destinations list even to edit the price.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const amenitiesList = vi.fn();
const featuresList = vi.fn();
const destinationsList = vi.fn();
const faqsList = vi.fn();
const accommodationGetById = vi.fn();

vi.mock('@/lib/api/endpoints', () => ({
    amenitiesApi: { list: (...args: unknown[]) => amenitiesList(...args) },
    featuresApi: { list: (...args: unknown[]) => featuresList(...args) },
    destinationsApi: { list: (...args: unknown[]) => destinationsList(...args) }
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationEditApi: { getById: (...args: unknown[]) => accommodationGetById(...args) },
    accommodationFaqApi: { list: (...args: unknown[]) => faqsList(...args) }
}));

vi.mock('@/lib/api/transforms', () => ({
    transformAccommodationEdit: ({ item }: { item: Record<string, unknown> }) => ({
        name: item.name
    }),
    transformAccommodationMedia: () => ({ featuredImage: { id: 'img' }, gallery: [{ id: 'g' }] }),
    transformAccommodationTranslations: () => ({ locales: ['es'] }),
    transformAmenityList: ({ items }: { items: unknown[] }) => items,
    transformDestinationList: ({ items }: { items: unknown[] }) => items
}));

vi.mock('@/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn() }
}));

const { loadAccommodationEditorData } = await import('@/lib/api/accommodation-editor-data');

const COOKIE = 'session=abc';

/** Builds a successful accommodation response. */
function okAccommodation() {
    return { ok: true, data: { name: 'Casa del Sol' } };
}

beforeEach(() => {
    vi.clearAllMocks();
    accommodationGetById.mockResolvedValue(okAccommodation());
    amenitiesList.mockResolvedValue({ ok: true, data: { items: [{ id: 'a' }] } });
    featuresList.mockResolvedValue({ ok: true, data: { items: [{ id: 'f' }] } });
    destinationsList.mockResolvedValue({ ok: true, data: { items: [{ id: 'd' }] } });
    faqsList.mockResolvedValue({ ok: true, data: { faqs: [{ id: 'q' }] } });
});

describe('loadAccommodationEditorData — request scoping', () => {
    it('should issue NO catalog request when only the accommodation is needed', async () => {
        await loadAccommodationEditorData({ accommodationId: 'acc', cookieHeader: COOKIE });

        expect(accommodationGetById).toHaveBeenCalledTimes(1);
        expect(amenitiesList).not.toHaveBeenCalled();
        expect(featuresList).not.toHaveBeenCalled();
        expect(destinationsList).not.toHaveBeenCalled();
        expect(faqsList).not.toHaveBeenCalled();
    });

    it('should fetch both catalogs only when `catalog` is requested', async () => {
        await loadAccommodationEditorData({
            accommodationId: 'acc',
            cookieHeader: COOKIE,
            need: ['catalog']
        });

        expect(amenitiesList).toHaveBeenCalledTimes(1);
        expect(featuresList).toHaveBeenCalledTimes(1);
        expect(destinationsList).not.toHaveBeenCalled();
    });

    it('should scope both catalogs to the accommodation vertical (SPEC-266)', async () => {
        await loadAccommodationEditorData({
            accommodationId: 'acc',
            cookieHeader: COOKIE,
            need: ['catalog']
        });

        expect(amenitiesList).toHaveBeenCalledWith(
            expect.objectContaining({ applicableVertical: 'accommodation' })
        );
        expect(featuresList).toHaveBeenCalledWith(
            expect.objectContaining({ applicableVertical: 'accommodation' })
        );
    });

    it('should fetch FAQs only when requested', async () => {
        await loadAccommodationEditorData({
            accommodationId: 'acc',
            cookieHeader: COOKIE,
            need: ['faqs']
        });

        expect(faqsList).toHaveBeenCalledWith({ accommodationId: 'acc', cookieHeader: COOKIE });
        expect(amenitiesList).not.toHaveBeenCalled();
    });

    it('should fetch destinations only when requested', async () => {
        await loadAccommodationEditorData({
            accommodationId: 'acc',
            cookieHeader: COOKIE,
            need: ['destinations']
        });

        expect(destinationsList).toHaveBeenCalledTimes(1);
        expect(amenitiesList).not.toHaveBeenCalled();
    });

    // H-107 (smoke agosto 2026): the Destino dropdown listed all 26 live
    // destinations, but only 22 are cities. The other four — Argentina
    // (COUNTRY), Entre Rios (PROVINCE), Litoral Argentino (REGION) and
    // Departamento Uruguay (DEPARTMENT) — render identically to a city and are
    // rejected on save by `_assertDestinationIsCity` (SPEC-095). Picking one
    // was a dead end: a legitimate-looking option that can never be saved.
    //
    // The server rule is correct and stays; the list is what has to reflect it.
    it('should scope the destinations list to CITY (H-107)', async () => {
        await loadAccommodationEditorData({
            accommodationId: 'acc',
            cookieHeader: COOKIE,
            need: ['destinations']
        });

        expect(destinationsList).toHaveBeenCalledWith(
            expect.objectContaining({ destinationType: 'CITY' })
        );
    });
});

describe('loadAccommodationEditorData — payload shape', () => {
    it('should return empty defaults for payloads that were not requested', async () => {
        const result = await loadAccommodationEditorData({
            accommodationId: 'acc',
            cookieHeader: COOKIE
        });

        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;

        expect(result.data.amenities).toEqual([]);
        expect(result.data.features).toEqual([]);
        expect(result.data.destinations).toEqual([]);
        expect(result.data.faqs).toEqual([]);
        expect(result.data.translations).toBeNull();
        expect(result.data.featuredImage).toBeNull();
        expect(result.data.gallery).toEqual([]);
    });

    it('should only compute media when `media` is requested', async () => {
        const withMedia = await loadAccommodationEditorData({
            accommodationId: 'acc',
            cookieHeader: COOKIE,
            need: ['media']
        });

        expect(withMedia.status).toBe('ok');
        if (withMedia.status !== 'ok') return;

        expect(withMedia.data.featuredImage).not.toBeNull();
        expect(withMedia.data.gallery).toHaveLength(1);
    });

    it('should only compute translations when `translations` is requested', async () => {
        const result = await loadAccommodationEditorData({
            accommodationId: 'acc',
            cookieHeader: COOKIE,
            need: ['translations']
        });

        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;

        expect(result.data.translations).not.toBeNull();
    });
});

describe('loadAccommodationEditorData — failure handling', () => {
    it.each([404, 403, 410])('should redirect on %i rather than erroring', async (status) => {
        accommodationGetById.mockResolvedValue({ ok: false, error: { status } });

        const result = await loadAccommodationEditorData({
            accommodationId: 'acc',
            cookieHeader: COOKIE
        });

        expect(result.status).toBe('redirect');
    });

    it('should report an error for a 500, not a redirect', async () => {
        // A server fault is not "this is not yours" — collapsing the two would
        // quietly bounce the host to the list on every outage.
        accommodationGetById.mockResolvedValue({ ok: false, error: { status: 500 } });

        const result = await loadAccommodationEditorData({
            accommodationId: 'acc',
            cookieHeader: COOKIE
        });

        expect(result.status).toBe('error');
    });

    it('should redirect when there is no session cookie', async () => {
        const result = await loadAccommodationEditorData({ accommodationId: 'acc' });

        expect(result.status).toBe('redirect');
        expect(accommodationGetById).not.toHaveBeenCalled();
    });

    it('should NOT fail the page when a secondary catalog fails', async () => {
        // A broken amenity catalog must never stop a host from editing photos.
        amenitiesList.mockResolvedValue({ ok: false, error: { status: 500 } });

        const result = await loadAccommodationEditorData({
            accommodationId: 'acc',
            cookieHeader: COOKIE,
            need: ['catalog']
        });

        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;

        expect(result.data.amenities).toEqual([]);
        expect(result.data.features).toHaveLength(1);
    });

    it('should NOT fail the page when the FAQ fetch fails', async () => {
        faqsList.mockResolvedValue({ ok: false, error: { status: 500 } });

        const result = await loadAccommodationEditorData({
            accommodationId: 'acc',
            cookieHeader: COOKIE,
            need: ['faqs']
        });

        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;

        expect(result.data.faqs).toEqual([]);
    });

    it('should report an error when a request throws', async () => {
        accommodationGetById.mockRejectedValue(new Error('network down'));

        const result = await loadAccommodationEditorData({
            accommodationId: 'acc',
            cookieHeader: COOKIE
        });

        expect(result.status).toBe('error');
    });
});
