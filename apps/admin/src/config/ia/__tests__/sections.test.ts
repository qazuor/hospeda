/**
 * Tests for apps/admin/src/config/ia/sections.ts (T-007, extended T-039)
 *
 * Verifies that all sections (7 original + 4 HOST) parse correctly against
 * SectionSchema and that canonical IDs and sidebar references are consistent.
 */

import { describe, expect, it } from 'vitest';
import { SectionSchema } from '../schema';
import { sections } from '../sections';

// All sidebar IDs referenced in the sections registry
const ALL_SIDEBAR_IDS = [
    'inicioSidebar',
    'catalogoSidebar',
    'editorialSidebar',
    'comunidadSidebar',
    'comercialSidebar',
    'plataformaSidebar',
    'analisisSidebar',
    'miCuentaSidebar',
    'misAlojamientosSidebar',
    'consultasSidebar',
    'miFacturacionSidebar'
] as const;

// Original 7 section IDs
const ORIGINAL_SECTION_IDS = [
    'inicio',
    'catalogo',
    'editorial',
    'comunidad',
    'comercial',
    'plataforma',
    'analisis'
] as const;

// HOST sections added in T-039
const HOST_SECTION_IDS = ['miCuenta', 'misAlojamientos', 'consultas', 'miFacturacion'] as const;

describe('sections', () => {
    describe('registry shape', () => {
        it('should export exactly 11 sections (7 original + 4 HOST)', () => {
            // Arrange
            const keys = Object.keys(sections);

            // Assert
            expect(keys).toHaveLength(11);
        });

        it('should contain all original section IDs', () => {
            // Arrange
            const keys = Object.keys(sections);

            // Assert
            for (const id of ORIGINAL_SECTION_IDS) {
                expect(keys).toContain(id);
            }
        });

        it('should contain all HOST section IDs (T-039)', () => {
            // Arrange
            const keys = Object.keys(sections);

            // Assert
            for (const id of HOST_SECTION_IDS) {
                expect(keys).toContain(id);
            }
        });
    });

    describe('schema validation', () => {
        it('should parse all sections against SectionSchema without errors', () => {
            // Arrange + Act + Assert
            for (const [key, section] of Object.entries(sections)) {
                const result = SectionSchema.safeParse(section);
                expect(
                    result.success,
                    `section '${key}' failed schema validation: ${JSON.stringify(result.error?.issues)}`
                ).toBe(true);
            }
        });

        it('should have id matching the registry key for every section', () => {
            // Assert
            for (const [key, section] of Object.entries(sections)) {
                expect(section.id).toBe(key);
            }
        });
    });

    describe('routes', () => {
        it('should have route starting with "/" for every section', () => {
            // Assert
            for (const [key, section] of Object.entries(sections)) {
                expect(section.route, `section '${key}' has invalid route`).toMatch(/^\//);
            }
        });

        it('should have defaultRoute starting with "/" when present', () => {
            // Assert
            for (const [key, section] of Object.entries(sections)) {
                if (section.defaultRoute !== undefined) {
                    expect(
                        section.defaultRoute,
                        `section '${key}' has invalid defaultRoute`
                    ).toMatch(/^\//);
                }
            }
        });
    });

    describe('sidebar references', () => {
        it('should reference a known sidebar ID for every section', () => {
            // Assert
            for (const [key, section] of Object.entries(sections)) {
                expect(section.sidebar, `section '${key}' has null sidebar`).not.toBeNull();

                expect(
                    ALL_SIDEBAR_IDS,
                    `section '${key}' references unknown sidebar '${section.sidebar}'`
                ).toContain(section.sidebar);
            }
        });

        it('should map each original section to its matching sidebar', () => {
            // Assert exact pairings for original 7
            expect(sections.inicio.sidebar).toBe('inicioSidebar');
            expect(sections.catalogo.sidebar).toBe('catalogoSidebar');
            expect(sections.editorial.sidebar).toBe('editorialSidebar');
            expect(sections.comunidad.sidebar).toBe('comunidadSidebar');
            expect(sections.comercial.sidebar).toBe('comercialSidebar');
            expect(sections.plataforma.sidebar).toBe('plataformaSidebar');
            expect(sections.analisis.sidebar).toBe('analisisSidebar');
        });

        it('should map each HOST section to its matching sidebar (T-039)', () => {
            // Assert exact pairings for HOST 4
            expect(sections.miCuenta.sidebar).toBe('miCuentaSidebar');
            expect(sections.misAlojamientos.sidebar).toBe('misAlojamientosSidebar');
            expect(sections.consultas.sidebar).toBe('consultasSidebar');
            expect(sections.miFacturacion.sidebar).toBe('miFacturacionSidebar');
        });
    });

    describe('i18n labels', () => {
        it('should have non-empty es, en, and pt labels for every section', () => {
            // Assert
            for (const [key, section] of Object.entries(sections)) {
                expect(section.label.es, `section '${key}' missing es label`).toBeTruthy();
                expect(section.label.en, `section '${key}' missing en label`).toBeTruthy();
                expect(section.label.pt, `section '${key}' missing pt label`).toBeTruthy();
            }
        });
    });

    describe('inicio section', () => {
        it('should have /dashboard as route', () => {
            expect(sections.inicio.route).toBe('/dashboard');
        });

        it('should have /dashboard as defaultRoute', () => {
            expect(sections.inicio.defaultRoute).toBe('/dashboard');
        });
    });

    describe('HOST sections (T-039)', () => {
        it('should have miCuenta pointing to /me/profile', () => {
            expect(sections.miCuenta.route).toBe('/me/profile');
            expect(sections.miCuenta.defaultRoute).toBe('/me/profile');
        });

        it('should have misAlojamientos pointing to /me/accommodations', () => {
            expect(sections.misAlojamientos.route).toBe('/me/accommodations');
            expect(sections.misAlojamientos.defaultRoute).toBe('/me/accommodations');
        });

        it('should have consultas pointing to /conversations', () => {
            expect(sections.consultas.route).toBe('/conversations');
            expect(sections.consultas.defaultRoute).toBe('/conversations');
        });

        it('should have miFacturacion pointing to /billing/subscriptions', () => {
            expect(sections.miFacturacion.route).toBe('/billing/subscriptions');
            expect(sections.miFacturacion.defaultRoute).toBe('/billing/subscriptions');
        });
    });
});
