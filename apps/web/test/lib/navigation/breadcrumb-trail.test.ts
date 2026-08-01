/**
 * @file breadcrumb-trail.test.ts
 * @description Unit tests for the visible breadcrumb trail builder.
 */

import { describe, expect, it } from 'vitest';
import { buildBreadcrumbTrail } from '../../../src/lib/navigation/breadcrumb-trail';

describe('buildBreadcrumbTrail', () => {
    describe('dropping the current page', () => {
        it('omits the last item, which is the current page', () => {
            // Arrange
            const items = [
                { label: 'Publicaciones', path: 'publicaciones' },
                { label: 'Fiesta Nacional de la Playa de Río en Concepción del Uruguay' }
            ];

            // Act
            const { entries } = buildBreadcrumbTrail({ items, locale: 'es', homeLabel: 'Inicio' });

            // Assert
            expect(entries.map((e) => e.label)).toEqual(['Inicio', 'Publicaciones']);
        });

        it('keeps every ancestor of a deep trail', () => {
            // Arrange
            const items = [
                { label: 'Destinos', path: 'destinos' },
                { label: 'Colón', path: 'destinos/colon' },
                { label: 'Eventos' }
            ];

            // Act
            const { entries } = buildBreadcrumbTrail({ items, locale: 'es', homeLabel: 'Inicio' });

            // Assert
            expect(entries.map((e) => e.label)).toEqual(['Inicio', 'Destinos', 'Colón']);
        });

        it('never emits aria-current-worthy state because the current page is gone', () => {
            // Arrange
            const items = [
                { label: 'Alojamientos', path: 'alojamientos' },
                { label: 'Casa del Río' }
            ];

            // Act
            const { entries } = buildBreadcrumbTrail({ items, locale: 'es', homeLabel: 'Inicio' });

            // Assert
            expect(entries.some((e) => e.label === 'Casa del Río')).toBe(false);
        });
    });

    describe('trails that carry no hierarchy', () => {
        it('returns no entries when the only item is the current page', () => {
            // Arrange — every top-level listing (/alojamientos/, /eventos/, …)
            const items = [{ label: 'Alojamientos' }];

            // Act
            const { entries } = buildBreadcrumbTrail({ items, locale: 'es', homeLabel: 'Inicio' });

            // Assert — home alone is not a trail
            expect(entries).toEqual([]);
        });

        it('returns no entries for an empty item list', () => {
            // Arrange / Act
            const { entries } = buildBreadcrumbTrail({
                items: [],
                locale: 'es',
                homeLabel: 'Inicio'
            });

            // Assert
            expect(entries).toEqual([]);
        });
    });

    describe('href resolution', () => {
        it('links home to the locale root', () => {
            // Arrange
            const items = [{ label: 'Eventos', path: 'eventos' }, { label: 'Fiesta' }];

            // Act
            const { entries } = buildBreadcrumbTrail({ items, locale: 'es', homeLabel: 'Inicio' });

            // Assert
            expect(entries[0]).toEqual({ label: 'Inicio', href: '/es/' });
        });

        it('prefixes every href with the active locale', () => {
            // Arrange
            const items = [{ label: 'Eventos', path: 'eventos' }, { label: 'Fiesta' }];

            // Act
            const { entries } = buildBreadcrumbTrail({ items, locale: 'en', homeLabel: 'Home' });

            // Assert
            expect(entries.map((e) => e.href)).toEqual(['/en/', '/en/eventos/']);
        });

        it('leaves an item without a path unlinked instead of pointing it at home', () => {
            // Arrange — "Autor" is a grouping level with no page of its own.
            // Regression: `path ?? ''` used to resolve it to the homepage.
            const items = [
                { label: 'Publicaciones', path: 'publicaciones' },
                { label: 'Autor' },
                { label: 'Leandro' }
            ];

            // Act
            const { entries } = buildBreadcrumbTrail({ items, locale: 'es', homeLabel: 'Inicio' });

            // Assert
            expect(entries[2]).toEqual({ label: 'Autor', href: undefined });
        });

        it('normalizes a path that already carries a trailing slash', () => {
            // Arrange — gastronomia/experiencias pass 'gastronomia/'
            const items = [
                { label: 'Gastronomía', path: 'gastronomia/' },
                { label: 'La Parrilla' }
            ];

            // Act
            const { entries } = buildBreadcrumbTrail({ items, locale: 'es', homeLabel: 'Inicio' });

            // Assert
            expect(entries[1]?.href).toBe('/es/gastronomia/');
        });
    });

    describe('input safety', () => {
        it('does not mutate the caller-supplied items array', () => {
            // Arrange
            const items = [{ label: 'Destinos', path: 'destinos' }, { label: 'Colón' }];

            // Act
            buildBreadcrumbTrail({ items, locale: 'es', homeLabel: 'Inicio' });

            // Assert
            expect(items).toHaveLength(2);
            expect(items[1]).toEqual({ label: 'Colón' });
        });
    });
});
