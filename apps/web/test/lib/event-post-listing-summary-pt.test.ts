/**
 * @file event-post-listing-summary-pt.test.ts
 * @description HOS-1800. The events and posts listing summaries used to be built
 * with `locale === 'pt' ? 'es' : locale`, so `/pt/eventos/` and `/pt/publicaciones/`
 * rendered Spanish. They now take `pt` natively.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildEventListingSummary, DEFAULT_EVENT_CATEGORIES } from '@/lib/event-listing-summary';
import { buildPostListingSummary, DEFAULT_POST_CATEGORIES } from '@/lib/post-listing-summary';

const SPANISH_MARKERS =
    /Mostrando 9 de 20 publicaciones|No se encontraron|sin filtros activos|ordenad/;

describe('buildPostListingSummary - pt', () => {
    it('renders the no-filters summary in Portuguese', () => {
        const out = buildPostListingSummary({
            locale: 'pt',
            filters: {},
            counts: { shown: 9, total: 20 },
            sort: { sortKey: 'newest' }
        });

        expect(out).toBe(
            'Mostrando 9 de 20 publicações, sem filtros ativos, ordenadas por publicação mais recente.'
        );
    });

    it('renders the zero-results summary in Portuguese', () => {
        const out = buildPostListingSummary({
            locale: 'pt',
            filters: { text: 'carnaval' },
            counts: { shown: 0, total: 0 }
        });

        expect(out).toBe(
            'Nenhum resultado encontrado para publicações que contêm "carnaval" no título ou no conteúdo.'
        );
    });

    it('localizes the category label', () => {
        const out = buildPostListingSummary({
            locale: 'pt',
            filters: { category: 'WELLNESS' },
            counts: { shown: 1, total: 1 },
            catalogs: { categories: DEFAULT_POST_CATEGORIES }
        });

        expect(out).toContain('bem-estar');
        expect(out).not.toMatch(SPANISH_MARKERS);
    });

    it('keeps es and en unchanged', () => {
        const base = { filters: {}, counts: { shown: 9, total: 20 }, sort: { sortKey: 'newest' } };

        expect(buildPostListingSummary({ ...base, locale: 'es' })).toBe(
            'Mostrando 9 de 20 publicaciones, sin filtros activos, ordenadas por publicación más reciente.'
        );
        expect(buildPostListingSummary({ ...base, locale: 'en' })).toBe(
            'Showing 9 of 20 posts, no active filters, sorted by most recently published.'
        );
    });
});

describe('buildEventListingSummary - pt', () => {
    it('renders the zero-results summary in Portuguese', () => {
        const out = buildEventListingSummary({
            locale: 'pt',
            filters: {},
            counts: { shown: 0, total: 0 }
        });

        expect(out).toBe('Nenhum resultado encontrado para eventos.');
    });

    it('renders the no-filters summary in Portuguese', () => {
        const out = buildEventListingSummary({
            locale: 'pt',
            filters: {},
            counts: { shown: 14, total: 14 },
            sort: { sortKey: 'upcoming' }
        });

        expect(out).toBe(
            'Mostrando 14 de 14 eventos, sem filtros ativos, ordenados por data mais próxima.'
        );
    });

    it('localizes category and destination', () => {
        const out = buildEventListingSummary({
            locale: 'pt',
            filters: { category: 'WORKSHOP', destinationId: 'd1' },
            counts: { shown: 2, total: 2 },
            catalogs: {
                categories: DEFAULT_EVENT_CATEGORIES,
                destinations: [{ key: 'd1', label: { es: 'Colón', en: 'Colón', pt: 'Colón' } }]
            }
        });

        expect(out).toContain('oficina');
        expect(out).toContain('Colón');
        expect(out).not.toMatch(SPANISH_MARKERS);
    });

    it('keeps es unchanged', () => {
        const out = buildEventListingSummary({
            locale: 'es',
            filters: {},
            counts: { shown: 0, total: 0 }
        });

        expect(out).toBe('No se encontraron eventos.');
    });
});

describe('listing pages - no pt to es clipping', () => {
    it.each(['eventos', 'publicaciones'])('%s/index.astro passes the real locale', (dir) => {
        const src = readFileSync(
            resolve(__dirname, `../../src/pages/[lang]/${dir}/index.astro`),
            'utf8'
        );

        expect(src).not.toMatch(/locale === 'pt' \? 'es'/);
    });
});
